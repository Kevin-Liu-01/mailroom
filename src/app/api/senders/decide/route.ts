import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { applyManual } from "@/lib/engine/actions";
import { gmailFor } from "@/lib/engine/run";
import type { SenderDecision } from "@/db/schema";
import type { PolicyConfig } from "@/lib/policy/schema";

export const maxDuration = 120;
const DECISIONS: SenderDecision[] = ["protect", "trash-old", "trash-all", "heavy-promo", "work", "family", null];

/** Record a standing decision about a sender, mirror it into the policy, and optionally act on the backlog now. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { domain?: string; decision?: SenderDecision; trashAfterDays?: number; applyNow?: boolean };
  if (!body.domain || !DECISIONS.includes(body.decision ?? null)) return NextResponse.json({ error: "domain and decision required" }, { status: 400 });
  const domain = body.domain.toLowerCase();
  const days = Math.min(Math.max(body.trashAfterDays ?? 30, 1), 3650);
  const [mb] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, userId)).limit(1);
  if (!mb) return NextResponse.json({ error: "no mailbox" }, { status: 404 });
  const policy: PolicyConfig = JSON.parse(JSON.stringify(mb.policy));
  const s = policy.senders;
  const drop = (arr: string[]) => arr.filter((d) => d !== domain);
  s.protected = drop(s.protected); s.heavyPromo = drop(s.heavyPromo); s.work = drop(s.work); s.family = drop(s.family); delete s.trashAfterDays[domain];
  switch (body.decision) {
    case "protect": s.protected.push(domain); break;
    case "trash-old": s.trashAfterDays[domain] = days; break;
    case "trash-all": s.trashAfterDays[domain] = 1; break;
    case "heavy-promo": s.heavyPromo.push(domain); break;
    case "work": s.work.push(domain); break;
    case "family": s.family.push(domain); break;
  }
  await db.update(schema.mailboxes).set({ policy, updatedAt: new Date() }).where(eq(schema.mailboxes.userId, userId));
  await db.insert(schema.senderProfiles).values({ userId, domain, decision: body.decision ?? null, trashAfterDays: body.decision === "trash-old" ? days : body.decision === "trash-all" ? 1 : null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [schema.senderProfiles.userId, schema.senderProfiles.domain], set: { decision: body.decision ?? null, trashAfterDays: body.decision === "trash-old" ? days : body.decision === "trash-all" ? 1 : null, updatedAt: new Date() } });

  let applied: { runId: string; messages: number } | null = null;
  if (body.applyNow && (body.decision === "trash-old" || body.decision === "trash-all")) {
    const { gmail } = await gmailFor(userId);
    const q = body.decision === "trash-all" ? `from:${domain} -in:trash -is:starred` : `from:${domain} older_than:${days}d -in:trash -is:starred`;
    const ids = await gmail.listMessageIds(q, policy.aging.maxTrashPerRule);
    if (ids.length) applied = await applyManual(userId, ids, "trash");
    else applied = { runId: "", messages: 0 };
  }
  const [profile] = await db.select().from(schema.senderProfiles).where(and(eq(schema.senderProfiles.userId, userId), eq(schema.senderProfiles.domain, domain))).limit(1);
  return NextResponse.json({ ok: true, profile, applied });
}
