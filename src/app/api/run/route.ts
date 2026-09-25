import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { runMailbox } from "@/lib/engine/run";
import { GmailAuthError } from "@/lib/gmail/client";

export const maxDuration = 300;

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode === "apply" ? "apply" : "dry-run";
  try {
    const result = await runMailbox({ userId, mode, trigger: "manual" });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof GmailAuthError ? 409 : 500;
    return NextResponse.json({ error: message, needsReauth: err instanceof GmailAuthError }, { status });
  }
}
