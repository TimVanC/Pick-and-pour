import type { PosCheckView, SettlementPreview } from "@/lib/app-types";
import { body, requireStaff, respond } from "@/server/api";
import { db } from "@/server/db";
import { UserError, applyPosPick, previewPosSettlement } from "@/server/picks";
import { addSampleRound, openSampleChecks, posForVenue } from "@/server/pos";

/**
 * The venue's POS, as the bartender app sees it.
 *   GET            open checks to attach a pick to
 *   GET ?pickId=   what settling that pick would take off its check, line by line
 */
export async function GET(request: Request) {
  return respond(async (): Promise<{ checks: PosCheckView[] } | SettlementPreview> => {
    const { venue } = await requireStaff();
    const pos = posForVenue(venue);
    if (!pos) throw new UserError("This venue is not connected to a POS.");

    const pickId = new URL(request.url).searchParams.get("pickId");
    if (pickId) {
      const { check, discount } = await previewPosSettlement(venue, pickId);
      return { check, discount };
    }

    const checks = await pos.provider.listOpenChecks(pos.restaurantId);
    const active = await db()`
      select id, pos_check_id from picks
      where venue_id = ${venue.id} and pos_check_id is not null
        and status in ('open', 'locked', 'settled')
    `;
    const pickByCheck = new Map(active.map((row) => [String(row.pos_check_id), String(row.id)]));
    return {
      checks: checks.map((check) => ({
        ...check,
        activePickId: pickByCheck.get(check.checkId) ?? null,
      })),
    };
  });
}

/**
 *   apply   post a pick's discount to its POS check
 *   seed    (mock POS, manager) open sample tabs
 *   round   (mock POS) ring a round in on a check
 */
export async function POST(request: Request) {
  return respond(async () => {
    const { venue, staff } = await requireStaff();
    const input = await body(request);
    const pos = posForVenue(venue);
    if (!pos) throw new UserError("This venue is not connected to a POS.");

    switch (String(input.action ?? "")) {
      case "apply":
        await applyPosPick(venue, staff, String(input.pickId ?? ""));
        break;
      case "seed":
        if (staff.role !== "manager") throw new UserError("Only a manager can do that.");
        if (!pos.mock) throw new UserError("Sample tabs are only for the mock POS.");
        await openSampleChecks(pos);
        break;
      case "round": {
        if (!pos.mock) throw new UserError("Ring items in on the POS itself.");
        const check = await pos.provider.getCheck(
          pos.restaurantId,
          String(input.orderId ?? ""),
          String(input.checkId ?? ""),
        );
        if (!check || !check.open) throw new UserError("That check is not open.");
        await addSampleRound(pos, check);
        break;
      }
      default:
        throw new UserError("Unknown action.");
    }
    return { ok: true };
  });
}
