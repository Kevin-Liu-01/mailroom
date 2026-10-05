import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { filterStatus } from "@/lib/engine/filing";

export const maxDuration = 60;

/** Where Gmail's filters stand against the policy: drift to sync, hand-made filters to adopt, conflicts. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await filterStatus(userId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
