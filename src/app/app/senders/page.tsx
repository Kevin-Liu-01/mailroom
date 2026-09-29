import { CalendarClock, Eye, Gavel, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { senderOverview } from "@/lib/engine/senders";
import { ScanButton, SenderTable } from "@/components/app/SenderTable";
import { Meta, PageHead } from "@/components/app/Bits";

export const dynamic = "force-dynamic";

export default async function SendersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const [mb] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, session.user.id)).limit(1);
  if (!mb) redirect("/");
  const senders = await senderOverview(session.user.id, mb.policy);
  return (
    <div className="section space-y-10">
      <PageHead icon={<Users size={26} />} title="Who fills your mailbox" actions={<ScanButton label={senders.length ? "Rescan senders" : "Scan senders"} />}>
        <Meta icon={CalendarClock}>Ninety days of senders</Meta>
        <Meta icon={Eye}>How much you read</Meta>
        <Meta icon={Gavel}>Your standing decision</Meta>
      </PageHead>
      <SenderTable rows={senders.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null, decision: s.decision ?? null }))} mode="all" />
    </div>
  );
}
