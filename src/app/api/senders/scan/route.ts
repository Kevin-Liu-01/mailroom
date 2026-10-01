import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { gmailFor } from "@/lib/engine/run";
import { scanSenders } from "@/lib/engine/senders";
import { NoKeyError, withUserKey } from "@/lib/ai/client";

export const maxDuration = 300;

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { days?: number; maxMessages?: number };
  try {
    const { gmail } = await gmailFor(userId);
    const result = await withUserKey(userId, () => scanSenders({ gmail, userId, days: Math.min(body.days ?? 90, 365), maxMessages: Math.min(body.maxMessages ?? 1500, 3000) }));
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NoKeyError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
