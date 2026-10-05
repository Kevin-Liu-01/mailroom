import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { adoptFilters } from "@/lib/engine/filing";

export const maxDuration = 120;

/** Turn hand-made filters that file into the categories into routes Mailroom owns. Undoable as one run. */
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await adoptFilters(userId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
