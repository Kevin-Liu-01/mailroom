import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { senderOverview } from "@/lib/engine/senders";
import { ScanButton, SenderTable } from "@/components/app/SenderTable";

export const dynamic = "force-dynamic";

export default async function SendersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const [mb] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, session.user.id)).limit(1);
  if (!mb) redirect("/");
  const senders = await senderOverview(session.user.id, mb.policy);
  return (
    <div className="section space-y-6">
      <div>
        <Link href="/app" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <p className="eyebrow mt-3">Senders</p>
        <h1 className="text-3xl font-bold tracking-tight">Who fills your mailbox</h1>
        <p className="max-w-2xl text-muted">Every sender from the last 90 days with volume, how much of it you read, Jev&apos;s judgment, and your standing decision. Decisions become policy: protected senders are never touched, trash decisions run daily.</p>
      </div>
      <ScanButton label={senders.length ? "Rescan senders" : "Scan senders"} />
      <SenderTable rows={senders.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null, decision: s.decision ?? null }))} mode="all" />
    </div>
  );
}
