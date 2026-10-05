/**
 * Where the owner's Gmail filters stand against the policy: how many Mailroom owns, what a sync would change, which
 * hand-made filters could be adopted as routes, which are left alone and why, and any route conflicts. Read-only.
 *   set -a; . ./.env.local; set +a; pnpm filters:audit
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { filterStatus } from "@/lib/engine/filing";

async function main() {
  const owner = process.env.OWNER_EMAIL?.toLowerCase();
  const [user] = owner
    ? await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, owner)).limit(1)
    : await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (!user) throw new Error("no user");
  const s = await filterStatus(user.id);
  console.log(`routes want ${s.wanted} filters · ${s.managed} in place · sync would create ${s.toCreate} and remove ${s.toRemove}`);
  console.log(`\n${s.adoptable.length} hand-made filters can be adopted as routes:`);
  for (const a of s.adoptable) console.log(`  ${a.labels.join(", ")}  <-  ${a.senders.slice(0, 110)}`);
  console.log(`\n${s.kept.length} left alone:`);
  for (const k of s.kept) console.log(`  ${k.labels.join(", ") || "(no label)"}: ${k.reason}`);
  console.log(`\n${s.conflicts.length} conflicts:`);
  for (const c of s.conflicts) console.log(`  ${c.sender} is filed as ${c.categories.join(" and ")}`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
