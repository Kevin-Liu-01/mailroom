import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { GmailClient } from "@/lib/gmail/client";
import { ALL_TAXONOMY_LABELS } from "@/lib/policy/rules";
import { ACTION_LABEL } from "@/lib/policy/schema";
import type { MailboxStats } from "@/db/schema";

const SYSTEM = ["INBOX", "UNREAD", "STARRED", "IMPORTANT", "SPAM", "TRASH", "SENT", "DRAFT"];
const TABS: Record<string, string> = { CATEGORY_PERSONAL: "Primary", CATEGORY_PROMOTIONS: "Promotions", CATEGORY_UPDATES: "Updates", CATEGORY_SOCIAL: "Social", CATEGORY_FORUMS: "Forums" };

const fmt = (d: Date) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;

export async function snapshotMailbox(gmail: GmailClient, userId: string): Promise<MailboxStats> {
  const profile = await gmail.profile();
  const labels = await gmail.listLabels();
  const byName = new Map(labels.map((l) => [l.name, l]));
  const system: MailboxStats["system"] = {};
  for (const name of SYSTEM) {
    const l = byName.get(name);
    if (!l) continue;
    const full = await gmail.getLabel(l.id);
    system[name] = { threads: full.threadsTotal ?? 0, unread: full.threadsUnread ?? 0 };
  }
  const tabs: MailboxStats["tabs"] = {};
  for (const label of Object.values(TABS)) {
    const ids = await gmail.listMessageIds(`in:inbox category:${label.toLowerCase()}`, 2000);
    tabs[label] = ids.length;
  }
  const userLabels: MailboxStats["labels"] = {};
  for (const name of [...ALL_TAXONOMY_LABELS, ACTION_LABEL]) {
    const l = byName.get(name);
    if (!l) continue;
    const full = await gmail.getLabel(l.id);
    userLabels[name] = { threads: full.threadsTotal ?? 0, unread: full.threadsUnread ?? 0 };
  }
  const daily: MailboxStats["daily"] = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(Date.now() - i * 86400_000); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400_000);
    const ids = await gmail.listMessageIds(`after:${fmt(start)} before:${fmt(end)} -from:me -in:trash -in:spam`, 1000);
    daily.push({ date: start.toISOString().slice(0, 10), received: ids.length });
  }
  const stats: MailboxStats = {
    takenAt: new Date().toISOString(),
    profile: { messagesTotal: profile.messagesTotal, threadsTotal: profile.threadsTotal },
    inbox: system.INBOX ?? { threads: 0, unread: 0 },
    system, tabs, labels: userLabels, daily,
  };
  await db.insert(schema.mailboxSnapshots).values({ userId, stats });
  return stats;
}

export async function latestSnapshot(userId: string): Promise<MailboxStats | null> {
  const [row] = await db.select().from(schema.mailboxSnapshots).where(eq(schema.mailboxSnapshots.userId, userId)).orderBy(desc(schema.mailboxSnapshots.takenAt)).limit(1);
  return row?.stats ?? null;
}
