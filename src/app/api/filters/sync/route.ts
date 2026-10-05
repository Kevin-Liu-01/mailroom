import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { syncFiltersNow } from "@/lib/engine/filing";

export const maxDuration = 120;

/** Bring Gmail's filters in line with the policy now, instead of at the next run. */
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await syncFiltersNow(userId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
