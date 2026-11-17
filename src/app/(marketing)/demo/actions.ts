"use server";

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { headers } from "next/headers";
import { Resend } from "resend";
import {
  HONEYPOT_FIELD,
  parseLead,
  type DemoFormState,
  type Lead,
} from "@/lib/leads";

/** At most this many demo requests per IP per window. */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Fallback limiter for when the database is unreachable or not configured.
 * It is per server instance, so the database count below is the real limit.
 */
const recentByIp = new Map<string, number[]>();

function overMemoryLimit(ipHash: string): boolean {
  const now = Date.now();
  const recent = (recentByIp.get(ipHash) ?? []).filter(
    (time) => now - time < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX) {
    recentByIp.set(ipHash, recent);
    return true;
  }
  recentByIp.set(ipHash, [...recent, now]);
  return false;
}

async function hashedIp(): Promise<string> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";
  return createHash("sha256")
    .update(`${process.env.LEADS_IP_SALT ?? ""}:${ip}`)
    .digest("hex");
}

/** SQL client for the Neon Postgres database, or null when DATABASE_URL is not set. */
function database() {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : null;
}

async function sendLeadEmail(lead: Lead): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEADS_NOTIFY_EMAIL;
  const from = process.env.LEADS_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    console.warn("[leads] Email not configured; skipping new-lead email.");
    return;
  }
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to,
    replyTo: lead.email,
    subject: `New demo request: ${lead.barName} (${lead.cityState})`,
    // Plain text on purpose: nothing a visitor types is rendered as HTML.
    text: [
      `Name: ${lead.name}`,
      `Bar: ${lead.barName}`,
      `City and state: ${lead.cityState}`,
      `Role: ${lead.role}`,
      `Phone: ${lead.phone || "-"}`,
      `Email: ${lead.email}`,
      `Sports: ${lead.sports.join(", ") || "-"}`,
      `TVs: ${lead.tvCount || "-"}`,
      "",
      "Notes:",
      lead.notes || "-",
    ].join("\n"),
  });
  if (error) throw new Error(error.message);
}

export async function submitDemoRequest(
  _previous: DemoFormState,
  formData: FormData,
): Promise<DemoFormState> {
  // Honeypot: bots fill every field. Pretend it worked and store nothing.
  if (formData.get(HONEYPOT_FIELD)) return { status: "success" };

  const { lead, fieldErrors } = parseLead(formData);
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", error: "invalid", fieldErrors, values: lead };
  }

  const ipHash = await hashedIp();
  if (overMemoryLimit(ipHash)) {
    return { status: "error", error: "rateLimited", values: lead };
  }

  const sql = database();
  if (!sql) {
    if (process.env.NODE_ENV === "production") {
      console.error("[leads] DATABASE_URL is not set; demo request lost.");
      return { status: "error", error: "generic", values: lead };
    }
    // Local development without a database: log instead of saving.
    console.info("[leads] DATABASE_URL not set. Demo request (dev only):", lead);
    return { status: "success" };
  }

  try {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const [{ count }] = await sql`
      select count(*)::int as count
      from leads
      where ip_hash = ${ipHash} and created_at >= ${since}
    `;
    if (count >= RATE_LIMIT_MAX) {
      return { status: "error", error: "rateLimited", values: lead };
    }

    await sql`
      insert into leads
        (name, bar_name, city_state, role, phone, email, sports, tv_count, notes, ip_hash)
      values (
        ${lead.name}, ${lead.barName}, ${lead.cityState}, ${lead.role},
        ${lead.phone || null}, ${lead.email}, ${lead.sports},
        ${lead.tvCount || null}, ${lead.notes || null}, ${ipHash}
      )
    `;
  } catch (error) {
    console.error("[leads] Saving the demo request failed:", error);
    return { status: "error", error: "generic", values: lead };
  }

  // The lead is saved, so an email failure must not fail the request.
  try {
    await sendLeadEmail(lead);
  } catch (error) {
    console.error("[leads] New-lead email failed:", error);
  }

  return { status: "success" };
}
