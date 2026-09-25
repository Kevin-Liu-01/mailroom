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
    <div className="section space-y-10">
      <div>
        <Link href="/app" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <h1 className="mt-3 text-[clamp(30px,4vw,48px)] font-bold leading-tight tracking-[-0.02em]">Who fills your mailbox</h1>
        <p className="max-w-2xl text-[17px] text-muted">Ninety days of senders, how much you read, and your standing decision.</p>
      </div>
      <ScanButton label={senders.length ? "Rescan senders" : "Scan senders"} />
      <SenderTable rows={senders.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null, decision: s.decision ?? null }))} mode="all" />
    </div>
  );
}
