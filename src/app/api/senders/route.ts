import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { gmailFor } from "@/lib/engine/run";
import { mapLimit } from "@/lib/gmail/client";

export const maxDuration = 120;

// Suggest heavy promotional senders: the most frequent domains in the last 300 Promotions-tab messages.
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { gmail } = await gmailFor(userId);
    const ids = await gmail.listMessageIds("category:promotions newer_than:90d", 300);
    const metas = await mapLimit(ids, 8, (id) => gmail.getMessageMeta(id, ["From"]).catch(() => null));
    const counts = new Map<string, number>();
    for (const m of metas) {
      const from = m?.headers["from"] ?? "";
      const domain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
      if (domain) counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
    const suggestions = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([domain, count]) => ({ domain, count }));
    return NextResponse.json({ sampled: ids.length, suggestions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
