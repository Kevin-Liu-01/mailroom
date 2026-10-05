import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { reconcileMail } from "@/lib/engine/filing";

export const maxDuration = 300;

/** File existing mail the way the routes would today. `apply: false` only counts; `apply: true` records an undoable run. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { days?: number; apply?: boolean };
  const days = Math.min(Math.max(Number(body.days ?? 90) || 90, 1), 365);
  try {
    return NextResponse.json(await reconcileMail(userId, { days, apply: body.apply === true }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
