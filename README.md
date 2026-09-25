# Mailroom

An opinionated Gmail suite. Deterministic rules (labels, filters, aging) keep a mailbox sorted for free;
[TypeSafe](https://typesafe.ai)'s Jev model answers four narrow, typed questions about whatever the rules
could not place, for roughly four cents per thousand emails. Every run previews first, writes a receipt, and
can be undone. Live at <https://mailroom.kevinliu.studio>.

## How it works

1. **Rules.** `src/lib/policy/rules.ts` turns a `PolicyConfig` into Gmail searches plus label changes
   (archive stragglers, trash expired codes and old notifications, mark old promotions read, demote heavy
   promotional senders) and into standing Gmail filters. Trash means Gmail Trash; nothing is ever deleted
   permanently, sent, or unsubscribed.
2. **AI triage.** `src/lib/ai/triage.ts` sends metadata only (sender, subject, snippet, bulk headers) to
   TypeSafe with one Choice (category) and three Nouls (automated, needs action, time-sensitive). Code applies
   the thresholds in the policy. Each message is judged once and cached in `ai_judgments`.
3. **Receipts and undo.** Every `batchModify` is recorded in `run_batches`; undo replays the inverse.

4. **Natural-language search.** `src/lib/search/compile.ts` finds candidates in code (known senders, explicit
   dates, status words, leftover topic words), asks TypeSafe to select among them (category, time window,
   sender, four intents), and assembles a Gmail query that is shown and editable. `src/lib/search/rerank.ts`
   asks one small question per result for the signal the query needs (relevance, needs reply, human,
   disposable). Bulk actions on results go through `src/lib/engine/actions.ts` and are undoable runs.
5. **What to trash.** `src/lib/engine/senders.ts` aggregates 90 days of mail by sender, judges each sender once
   (category, safe to trash after a month, transactional, human), and combines that with your own reading
   behavior into a recommendation: protect, trash after 30 days, trash all, keep. Decisions become policy
   (`senders.protected`, `senders.trashAfterDays`) and run daily.
6. **Mailbox map.** `src/lib/engine/stats.ts` snapshots label sizes, tab sizes, and 14 days of volume after
   every daily run and on demand.

The engine is `src/lib/engine/run.ts`. `POST /api/run` runs it for the signed-in user (preview or apply);
`GET /api/cron` runs every scheduled mailbox once a day (Vercel Cron, `vercel.json`).

## Stack

Next.js 16 (App Router), Auth.js v5 with Google, Drizzle + Postgres (Neon through the Vercel Marketplace),
`@typesafe-ai/sdk`, Tailwind v4, Vitest.

## Setup

1. Create a **Web application** OAuth client in Google Cloud > Google Auth Platform > Clients with
   authorized origins `https://<your-domain>` and `http://localhost:3000`, and redirect URIs
   `https://<your-domain>/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`.
   The consent screen must be External and, for tokens that do not expire weekly, In production.
   Until Google verifies the app, users see an "unverified app" notice and the project is capped at 100 users.
2. Copy `.env.example` to `.env.local` and fill it in (`openssl rand -base64 32` for the two keys).
3. `pnpm install`, `pnpm db:push` (creates the tables), `pnpm dev`.

## Deploy

`vercel link`, `vercel integration add neon --plan free_v3` (or any Postgres as `DATABASE_URL`), set the
variables from `.env.example` with `vercel env add`, then `vercel deploy --prod`. The cron in `vercel.json`
calls `/api/cron` with `Authorization: Bearer $CRON_SECRET`.

## Safety properties

- Only metadata leaves Google: no bodies are fetched, stored, or sent to TypeSafe.
- Refresh tokens are AES-256-GCM encrypted at rest (`TOKEN_ENCRYPTION_KEY`).
- Trash rules refuse to run above `maxTrashPerRule` matches and never name a protected category.
- Starred mail is never trashed; `-from:me` mail is never judged.
- Disconnect revokes the Google token and deletes the user's rows.

## Scripts

`pnpm test` (Vitest), `pnpm typecheck`, `pnpm db:push`, `pnpm db:studio`, `pnpm smoke:triage`, `pnpm smoke:search`.
