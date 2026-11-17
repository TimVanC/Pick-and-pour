import type { Role } from "@/lib/app-types";
import { body, requireStaff, respond } from "@/server/api";
import {
  addStaff,
  featureWindow,
  newDemoSlate,
  newReplaySlate,
  openLockWindow,
  removeStaff,
  reportForDay,
  reportRows,
  setFeatured,
  todayFor,
  updateSettings,
} from "@/server/manager";
import { UserError } from "@/server/picks";

function validDate(value: string | null, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

/** The game-day report, as JSON or as a CSV download (?format=csv). */
export async function GET(request: Request) {
  return respond(async () => {
    const { venue } = await requireStaff("manager");
    const url = new URL(request.url);
    const date = validDate(url.searchParams.get("date"), todayFor(venue));
    if (url.searchParams.get("format") === "csv") {
      return new Response(await reportRows(venue, date), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pick-and-pour-${date}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return reportForDay(venue, date);
  });
}

/** Manager-only changes: settings, featured games, lock-in window, staff, demo slate. */
export async function POST(request: Request) {
  return respond(async () => {
    const { venue, staff } = await requireStaff("manager");
    const input = await body(request);

    switch (String(input.action ?? "")) {
      case "settings":
        await updateSettings(venue, staff.id, {
          jurisdictionCode:
            typeof input.jurisdictionCode === "string" ? input.jurisdictionCode : undefined,
          scale: typeof input.scale === "number" ? input.scale : undefined,
          cap: typeof input.cap === "number" ? input.cap : undefined,
          maxCoveredCents:
            typeof input.maxCoveredCents === "number" ? input.maxCoveredCents : undefined,
          lateCutoffPeriod:
            typeof input.lateCutoffPeriod === "number" ? input.lateCutoffPeriod : undefined,
          posProvider:
            input.posProvider === "mock-toast" || input.posProvider === "manual"
              ? input.posProvider
              : undefined,
        });
        break;
      case "feature":
        await setFeatured(venue, staff.id, String(input.gameId ?? ""), Boolean(input.featured));
        break;
      case "featureWindow":
        await featureWindow(venue, staff.id, String(input.windowLabel ?? ""));
        break;
      case "lockWindow":
        await openLockWindow(venue, staff.id, Number(input.minutes) || 0);
        break;
      case "newSlate":
        await newDemoSlate(venue, staff.id);
        break;
      case "newReplay":
        await newReplaySlate(venue, staff.id, String(input.date ?? ""), Number(input.speed) || 30);
        break;
      case "addStaff":
        await addStaff(venue, staff.id, {
          name: String(input.name ?? ""),
          role: input.role as Role,
          pin: String(input.pin ?? ""),
        });
        break;
      case "removeStaff":
        await removeStaff(venue, staff.id, String(input.staffId ?? ""));
        break;
      default:
        throw new UserError("Unknown action.");
    }
    return { ok: true };
  });
}
