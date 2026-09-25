import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { applyManual, type ManualAction } from "@/lib/engine/actions";

export const maxDuration = 120;
const ACTIONS: ManualAction[] = ["archive", "trash", "read", "unread", "star", "unstar", "inbox", "label"];

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: string[]; action?: ManualAction; label?: string };
  if (!Array.isArray(body.ids) || !body.action || !ACTIONS.includes(body.action)) return NextResponse.json({ error: "ids and a valid action are required" }, { status: 400 });
  try {
    return NextResponse.json(await applyManual(userId, body.ids, body.action, body.label));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
