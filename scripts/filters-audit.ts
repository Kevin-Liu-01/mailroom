/**
 * Compare the Gmail filters on the owner's account with the filters the policy wants. Prints each wanted filter, the
 * existing filters with the same criteria, and whether their actions match. Read-only.
 *   set -a; . ./.env.local; set +a; pnpm filters:audit
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { gmailFor } from "@/lib/engine/run";
import { buildFilters } from "@/lib/policy/rules";

async function main() {
  const owner = process.env.OWNER_EMAIL?.toLowerCase();
  const [user] = owner
    ? await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, owner)).limit(1)
    : await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (!user) throw new Error("no user");
  const [mb] = await db.select({ policy: schema.mailboxes.policy }).from(schema.mailboxes).where(eq(schema.mailboxes.userId, user.id)).limit(1);
  const { gmail } = await gmailFor(user.id);
  const labels = new Map((await gmail.listLabels()).map((l) => [l.name, l.id]));
  const existing = await gmail.listFilters();
  console.log(`${existing.length} filters in Gmail\n`);
  const same = (a: string[] = [], b: string[] = []) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
  for (const spec of buildFilters(mb.policy)) {
    const add = spec.action.addLabelNames.map((n) => labels.get(n) ?? n);
    const matches = existing.filter((f) => (f.criteria.from ?? "") === (spec.criteria.from ?? "") && (f.criteria.subject ?? "") === (spec.criteria.subject ?? "") && (f.criteria.query ?? "") === (spec.criteria.query ?? ""));
    const ok = matches.some((f) => same(f.action.addLabelIds, add) && same(f.action.removeLabelIds, spec.action.removeLabelIds));
    console.log(`${ok ? "ok  " : "DIFF"} ${spec.id}: wants add=[${spec.action.addLabelNames.join(",")}] remove=[${spec.action.removeLabelIds.join(",")}] · ${matches.length} matching by criteria`);
    for (const f of matches) console.log(`      existing ${f.id}: add=[${(f.action.addLabelIds ?? []).map((id) => [...labels.entries()].find(([, v]) => v === id)?.[0] ?? id).join(",")}] remove=[${(f.action.removeLabelIds ?? []).join(",")}]`);
  }
  const wanted = new Set(buildFilters(mb.policy).map((s) => `${s.criteria.from ?? ""}|${s.criteria.subject ?? ""}|${s.criteria.query ?? ""}`));
  const strangers = existing.filter((f) => !wanted.has(`${f.criteria.from ?? ""}|${f.criteria.subject ?? ""}|${f.criteria.query ?? ""}`));
  console.log(`\n${strangers.length} filters not from this policy (left alone):`);
  for (const f of strangers) console.log(`  ${f.id}: ${JSON.stringify(f.criteria).slice(0, 110)} -> add=[${(f.action.addLabelIds ?? []).join(",")}] remove=[${(f.action.removeLabelIds ?? []).join(",")}]`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
