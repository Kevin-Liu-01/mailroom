import type { GmailClient, GmailMessageMeta, GmailThreadMessage } from "@/lib/gmail/client";
import { mapLimit } from "@/lib/gmail/client";

/** One conversation in a result set: the latest matched message stands for the thread. */
export type ThreadRow = {
  threadId: string;
  latest: GmailMessageMeta;
  messageIds: string[];
  matched: number;
  unread: number;
  participants: string[];
  /** Filled by addThreadContext. */
  total?: number;
  lastFromMe?: boolean;
  anyFromMe?: boolean;
  repliedAfterLatest?: boolean;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
};

const addressOf = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
export function isMe(from: string, userEmail: string): boolean {
  return addressOf(from) === userEmail.trim().toLowerCase();
}
const nameOf = (from: string) => from.replace(/<[^>]+>/, "").replace(/["']/g, "").trim() || addressOf(from);

/** Collapse messages into threads, newest message first, newest thread first. */
export function groupThreads(metas: GmailMessageMeta[]): ThreadRow[] {
  const byThread = new Map<string, GmailMessageMeta[]>();
  for (const m of metas) byThread.set(m.threadId, [...(byThread.get(m.threadId) ?? []), m]);
  const rows: ThreadRow[] = [];
  for (const [threadId, msgs] of byThread) {
    msgs.sort((a, b) => Number(b.internalDate) - Number(a.internalDate));
    const participants = [...new Set(msgs.map((m) => nameOf(m.headers["from"] ?? "")))].filter(Boolean).slice(0, 3);
    rows.push({ threadId, latest: msgs[0], messageIds: msgs.map((m) => m.id), matched: msgs.length, unread: msgs.filter((m) => m.labelIds.includes("UNREAD")).length, participants });
  }
  rows.sort((a, b) => Number(b.latest.internalDate) - Number(a.latest.internalDate));
  return rows;
}

/** Pure summary of who spoke last, so it can be unit tested. */
export function summarizeThread(messages: GmailThreadMessage[], userEmail: string) {
  const ordered = [...messages].sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
  const last = ordered[ordered.length - 1];
  const inbound = ordered.filter((m) => !isMe(m.from, userEmail));
  const outbound = ordered.filter((m) => isMe(m.from, userEmail));
  const lastInbound = inbound[inbound.length - 1];
  const lastOutbound = outbound[outbound.length - 1];
  return {
    total: ordered.length,
    lastFromMe: last ? isMe(last.from, userEmail) : false,
    anyFromMe: outbound.length > 0,
    repliedAfterLatest: Boolean(lastInbound && lastOutbound && Number(lastOutbound.internalDate) > Number(lastInbound.internalDate)),
    lastInboundAt: lastInbound ? new Date(Number(lastInbound.internalDate)).toISOString() : null,
    lastOutboundAt: lastOutbound ? new Date(Number(lastOutbound.internalDate)).toISOString() : null,
  };
}

/** Fetch each thread's headers and record who spoke last. Failures leave the row without context. */
export async function addThreadContext(gmail: GmailClient, rows: ThreadRow[], userEmail: string): Promise<void> {
  await mapLimit(rows, 8, async (row) => {
    try {
      const t = await gmail.getThreadMeta(row.threadId);
      Object.assign(row, summarizeThread(t.messages, userEmail));
    } catch { /* keep the row without thread context */ }
  });
}
