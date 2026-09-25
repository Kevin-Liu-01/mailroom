import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { senderOverview } from "@/lib/engine/senders";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [mb] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, userId)).limit(1);
  if (!mb) return NextResponse.json({ error: "no mailbox" }, { status: 404 });
  return NextResponse.json({ senders: await senderOverview(userId, mb.policy) });
}
