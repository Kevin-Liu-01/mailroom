import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { resolveKey, verifyKey } from "@/lib/ai/client";

/** The signed-in user's TypeSafe key: status, set (after a live check), or remove. The key itself never comes back. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const k = await resolveKey(userId);
  return NextResponse.json({ hasKey: Boolean(k), source: k?.source ?? null, last4: k?.source === "own" ? k.key.slice(-4) : null });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const key = body.key?.trim() ?? "";
  if (key.length < 16 || /\s/.test(key)) return NextResponse.json({ error: "That does not look like a TypeSafe key." }, { status: 400 });
  try {
    const models = await verifyKey(key);
    await db.update(schema.users).set({ typesafeKey: encryptSecret(key) }).where(eq(schema.users.id, userId));
    return NextResponse.json({ ok: true, last4: key.slice(-4), models });
  } catch (err) {
    return NextResponse.json({ error: `TypeSafe rejected that key: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await db.update(schema.users).set({ typesafeKey: null }).where(eq(schema.users.id, userId));
  return NextResponse.json({ ok: true });
}
