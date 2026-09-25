import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { revokeToken } from "@/lib/gmail/client";

// Revokes Google access and deletes everything we hold about the user (accounts, runs, judgments cascade).
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [acct] = await db.select().from(schema.accounts).where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "google"))).limit(1);
  if (acct?.refresh_token) {
    try { await revokeToken(decryptSecret(acct.refresh_token)); } catch { /* best effort */ }
  }
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  return NextResponse.json({ ok: true });
}
