import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { gmailFor } from "@/lib/engine/run";
import { latestSnapshot, snapshotMailbox } from "@/lib/engine/stats";

export const maxDuration = 120;

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ stats: await latestSnapshot(userId) });
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { gmail } = await gmailFor(userId);
    return NextResponse.json({ stats: await snapshotMailbox(gmail, userId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
