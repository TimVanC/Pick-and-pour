import type { Side } from "@/lib/app-types";
import { body, requireStaff, respond } from "@/server/api";
import {
  UserError,
  applyPick,
  closePick,
  createPick,
  lockPick,
  undoPick,
  voidPick,
} from "@/server/picks";

/** Everything a bartender does to a pick: create, lock, close, apply, undo, void. */
export async function POST(request: Request) {
  return respond(async () => {
    const { venue, staff } = await requireStaff();
    const input = await body(request);
    const pickId = String(input.pickId ?? "");

    switch (String(input.action ?? "")) {
      case "create": {
        const id = await createPick(venue, staff, {
          gameId: String(input.gameId ?? ""),
          side: input.side as Side,
          tabLabel: String(input.tabLabel ?? ""),
          seat: String(input.seat ?? ""),
          subtotalCents: Number(input.subtotalCents) || 0,
          posOrderId: typeof input.posOrderId === "string" ? input.posOrderId : undefined,
          posCheckId: typeof input.posCheckId === "string" ? input.posCheckId : undefined,
        });
        return { ok: true, pickId: id };
      }
      case "lock":
        await lockPick(venue, staff, pickId);
        return { ok: true };
      case "close":
        await closePick(venue, staff, pickId);
        return { ok: true };
      case "apply":
        await applyPick(venue, staff, pickId, Number(input.subtotalCents) || 0);
        return { ok: true };
      case "undo":
        await undoPick(venue, staff, pickId);
        return { ok: true };
      case "void":
        await voidPick(venue, staff, pickId);
        return { ok: true };
      default:
        throw new UserError("Unknown action.");
    }
  });
}
