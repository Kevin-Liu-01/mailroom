// Creates (or removes) a throwaway signed-in user so the app pages can be reviewed without a Gmail consent.
// Run: pnpm tsx --tsconfig tsconfig.json scripts/seed-preview-user.ts [--remove]
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { defaultPolicy } from "@/lib/policy/schema";

const EMAIL = "preview@mailroom.local";
const TOKEN = "preview-session-token-do-not-use-in-prod";

async function main() {
  const remove = process.argv.includes("--remove");
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, EMAIL)).limit(1);
  if (remove) {
    if (existing) await db.delete(schema.users).where(eq(schema.users.id, existing.id));
    console.log("removed preview user");
    process.exit(0);
  }
  let userId = existing?.id;
  if (!userId) {
    const [u] = await db.insert(schema.users).values({ name: "Preview User", email: EMAIL }).returning({ id: schema.users.id });
    userId = u.id;
  }
  await db.insert(schema.mailboxes).values({ userId, email: EMAIL, policy: defaultPolicy() }).onConflictDoNothing();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  await db.insert(schema.sessions).values({ sessionToken: TOKEN, userId, expires: new Date(Date.now() + 86400_000) });
  await db.insert(schema.senderProfiles).values([
    { userId, domain: "em.target.com", displayName: "Target", messages: 214, unread: 211, inInbox: 40, lastSeenAt: new Date(), sampleSubjects: ["Weekend deals", "20% off home"], judgment: { category: "marketing", categoryConfidence: 0.98, safeToTrashOld: 0.96, transactional: 0.03, human: 0.01 } },
    { userId, domain: "chase.com", displayName: "Chase", messages: 12, unread: 9, inInbox: 12, lastSeenAt: new Date(), sampleSubjects: ["Your statement is ready"], judgment: { category: "finance", categoryConfidence: 0.99, safeToTrashOld: 0.2, transactional: 0.9, human: 0.02 } },
    { userId, domain: "gmail.com", displayName: "Mom", messages: 6, unread: 0, inInbox: 6, lastSeenAt: new Date(), sampleSubjects: ["dinner sunday?"], judgment: { category: "personal", categoryConfidence: 0.97, safeToTrashOld: 0.05, transactional: 0.02, human: 0.97 } },
  ]).onConflictDoNothing();
  await db.insert(schema.mailboxSnapshots).values({ userId, stats: { takenAt: new Date().toISOString(), profile: { messagesTotal: 38509, threadsTotal: 32388 }, inbox: { threads: 16045, unread: 152 }, system: { TRASH: { threads: 24758, unread: 0 } }, tabs: { Primary: 3774, Promotions: 11541, Updates: 970, Social: 0, Forums: 0 }, labels: { "Marketing & Deals": { threads: 13045, unread: 35 }, Newsletters: { threads: 5099, unread: 55 }, "Banking & Finance": { threads: 2972, unread: 56 }, Receipts: { threads: 1669, unread: 11 }, Recruiting: { threads: 165, unread: 0 } }, daily: Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10), received: 30 + ((i * 37) % 40) })) } });
  console.log(`seeded ${userId}; cookie: authjs.session-token=${TOKEN}`);
  process.exit(0);
}
main();
