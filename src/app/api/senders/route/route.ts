import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { fileSender } from "@/lib/engine/filing";
import { CATEGORY_IDS } from "@/lib/policy/schema";
import type { FileCategory } from "@/lib/policy/routes";

export const maxDuration = 120;

/** File a sender into a category: updates your routes and syncs Gmail's filters. Undoable as one run. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { sender?: string; category?: string };
  const category = body.category as FileCategory | undefined;
  if (!body.sender || !category || category === ("other" as string) || !CATEGORY_IDS.includes(category)) return NextResponse.json({ error: "sender and category required" }, { status: 400 });
  try {
    return NextResponse.json(await fileSender(userId, body.sender, category));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
