import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { parsePolicy } from "@/lib/policy/schema";
import { buildFilters, buildRules } from "@/lib/policy/rules";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [mb] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, userId)).limit(1);
  if (!mb) return NextResponse.json({ error: "no mailbox" }, { status: 404 });
  return NextResponse.json({ policy: mb.policy, scheduleEnabled: mb.scheduleEnabled, rules: buildRules(mb.policy), filters: buildFilters(mb.policy) });
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { policy?: unknown; scheduleEnabled?: boolean } | null;
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  try {
    const patch: Partial<typeof schema.mailboxes.$inferInsert> = { updatedAt: new Date() };
    if (body.policy !== undefined) patch.policy = parsePolicy(body.policy);
    if (typeof body.scheduleEnabled === "boolean") patch.scheduleEnabled = body.scheduleEnabled;
    await db.update(schema.mailboxes).set(patch).where(eq(schema.mailboxes.userId, userId));
    const [mb] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, userId)).limit(1);
    return NextResponse.json({ policy: mb.policy, scheduleEnabled: mb.scheduleEnabled, rules: buildRules(mb.policy) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
