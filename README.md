<p align="center">
  <img src="https://mailroom.kevinliu.studio/og.png" alt="Your Gmail, sorted. Mail rides a belt into the Jev sorter and drops into labeled buckets." width="100%">
</p>

# Mailroom

Rules you can read. Typed AI judgments for pennies. A straight answer to what to trash.

Mailroom keeps a Gmail mailbox sorted. Deterministic rules do the bulk for free: label on arrival, archive stragglers,
trash expired codes and stale notifications, mark old promotions read. Whatever the rules cannot place goes to
[TypeSafe](https://typesafe.ai)'s Jev, a System One model that answers five narrow typed questions per email with
probabilities instead of prose, for about $0.042 per million input tokens. Every run previews first, writes a receipt,
and can be undone. Nothing is ever sent, unsubscribed, or deleted for good.

Live at [mailroom.kevinliu.studio](https://mailroom.kevinliu.studio). It is a personal deployment: sign-in shows
Google's "unverified app" warning (click Advanced, then Go to mailroom), Jev is bring-your-own-key, and the project is
capped at 100 users by Google. If that is not for you, clone it and run your own; the setup below takes an hour.

## What it does

| | |
| --- | --- |
| **Rules, then Jev, then a receipt** | A policy you can read in one screen becomes Gmail searches and label changes. Jev judges only the Primary-tab mail the rules left alone, once per message, cached forever. Every change is a row in a receipt. |
| **Ask in plain words** | "Receipts from Uber last month", "who hasn't replied to me", "unread from real people". Code finds the senders, dates, and status words; Jev picks the category, window, and intent; you get a Gmail query you can edit, and conversations ranked by the signal you asked for, with every probability shown. |
| **Decide sender by sender** | Ninety days of mail aggregated by sender, judged once, crossed with how much of it you actually open. You click protect, keep, trash after 30 days, or trash all; it becomes a standing rule. |
| **Filing you can read** | Routes say where mail from a sender goes: a category, an optional sub-label, optionally only for certain subject words. Each becomes a Gmail filter, so new mail is filed the moment it lands. Built-in routes cover common services; yours add to them. Already have hand-made Gmail filters? Adopt them in one click and one system owns filing from then on. |
| **Grade what happened** | On any receipt, ask Jev whether each trashed or filed email was handled right. Disagreements come pre-selected, and one click reverses just those. |
| **Thirteen fixed labels** | Work, Personal, Banking & Finance, Receipts, Trips & Travel, Events, Recruiting, School, Dev Notifications, Social Media, Newsletters, Marketing & Deals, Accounts & Security. Nothing custom, so search always works. |

## How filing resolves overlaps

Gmail applies every filter that matches, so two routes that both match a message would both label it. Mailroom
resolves that when it compiles the filters, by three rules:

1. **A more specific sender wins.** If `o.delta.com` is filed as Marketing, the `delta.com` Travel route excludes it,
   so Delta's promos stop landing in Travel while boarding passes still do.
2. **A subject-qualified route keeps its slice.** Uber receipts filed as Receipts are excluded from an unqualified
   `uber.com` Marketing route; the rest of Uber's mail stays Marketing. A route's exceptions go back with it: the
   built-in Receipts route skips promo phrasing such as "your next order", so "40% off your next order" stays Marketing.
3. **Your routes beat the built-ins.** File `delta.com` as Marketing and the built-in Travel route drops it.

Anything left, the same sender in two of your own routes with nothing to tell them apart, is shown as a conflict on the
policy page. Gmail lets a filter apply one user label, so a route with a sub-label becomes two filters with the same
criteria. Mailroom tracks the filters it creates and only ever changes those; filters that do something routes cannot
express (forwarding, never-spam, Gmail tabs, labels outside the categories) are left alone. Every sync, adoption, and
reconcile is a run with a receipt, and Undo puts the filters, the labels, and the policy back.

Filters only see new mail. **File existing mail** on the policy page previews, then applies, the routes to recent
mail. Missing labels go on. A label comes off only where a filter Mailroom replaced could have put it and today's
routes file the message in another category, so labels you, Jev, or an earlier cleanup applied stay put.

## Safety properties

- Metadata only. Headers, labels, and snippets are read; message bodies are never fetched, stored, or sent to anyone.
- Never sends mail, never unsubscribes, never deletes permanently. Trash is Gmail's Trash with 30-day recovery.
- Every run previews first; every apply writes a receipt; every receipt has Undo, whole or per message.
- Starred mail is never trashed. Mail you wrote is never judged. Trash rules refuse to run past a per-rule cap.
- OAuth tokens and TypeSafe keys are AES-256-GCM encrypted at rest. Disconnect revokes the Google token and deletes everything.
- Strict Content Security Policy, HSTS, same-origin checks on every write. See `SECURITY.md` and `docs/casa.md`.

## Run your own

You need a Google Cloud project, a Postgres database, a Vercel account (or anywhere Next.js runs with a cron), and a
TypeSafe key for Jev.

1. **Google OAuth.** In Google Cloud, Google Auth Platform: create an External app in Production (Testing mode makes
   refresh tokens expire weekly, which breaks the daily run), then a Web application client with origins
   `https://<your-domain>` and `http://localhost:3000` and redirect URIs `<origin>/api/auth/callback/google` for both.
   Enable the Gmail API. Add the Gmail scopes `gmail.modify` and `gmail.settings.basic` under Data Access.
   Until Google verifies your app you will see the unverified warning; verification for these restricted scopes
   requires an annual CASA assessment (`docs/casa.md` explains the trade-off). For a mailbox or two, unverified is fine.
2. **Environment.** `cp .env.example .env.local` and fill it in. `openssl rand -base64 32` for `AUTH_SECRET` and
   `TOKEN_ENCRYPTION_KEY`. `TYPESAFE_API_KEY` and `OWNER_EMAIL` are optional: set them and the owner's account uses the
   house key, everyone else adds their own key in the dashboard.
3. **Fonts.** The hosted site uses two licensed typefaces that are not in this repo. Drop your own Berkeley Mono and
   Camber `.woff2` files into `src/app/fonts/` (see `.gitignore` for the filenames), or run `pnpm fonts:fallback` to
   fetch open stand-ins (JetBrains Mono and Figtree) under those names.
4. **Database.** Any Postgres. `pnpm install && pnpm db:push` creates the tables.
5. **Run.** `pnpm dev`, sign in, add a TypeSafe key if you are not the owner, press Preview.
6. **Deploy.** `vercel link`, `vercel env add` each variable, `vercel --prod`. The cron in `vercel.json` calls
   `/api/cron` daily at 13:00 UTC with `Authorization: Bearer $CRON_SECRET`.

## How it is built

Next.js 16 (App Router, Turbopack), React 19, Auth.js v5 with Google, Drizzle on Postgres, `@typesafe-ai/sdk`,
Tailwind v4, Vitest. Type is Camber for words and Berkeley Mono for data.

```
src/lib/policy      the policy schema (zod), the thirteen categories, rules, routes compiled to Gmail filters
src/lib/engine      run.ts (rules, then triage, then receipts), filters.ts (sync), filing.ts (adopt, reconcile)
src/lib/ai          client.ts (bring-your-own-key context), triage.ts, grade.ts
src/lib/search      lexicon.ts, compile.ts (words to a Gmail query), threads.ts, rerank.ts
src/lib/gmail       a thin Gmail REST client: metadata reads, batchModify, labels, filters
src/app/api         one route per action; every write requires a session and is scoped to that user
src/app/app         the dashboard, search, what-to-trash, senders, policy, run receipts
src/components      the landing diagrams (isometric SVG), the app bits, the type system
tests               pure logic: compiler, lexicon, thread summaries, label expansion
docs                verification notes, the share image recipe, the CASA evidence table
```

Jev is used the way TypeSafe recommends: code owns the workflow, finds candidates, and applies thresholds; the model
answers atomic questions (Choice for the category, Noul for yes-or-no facts, Score for graded relevance) over
metadata, and every probability is shown in the UI rather than hidden behind a verdict.

## Scripts

`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm db:push`, `pnpm db:studio`,
`pnpm smoke:search` (compiles thirty questions and prints the queries), `pnpm smoke:triage`, `pnpm filters:audit`
(where your Gmail filters stand against the routes: in place, to sync, adoptable, left alone, conflicts).
`scripts/seed-preview-user.ts` creates a throwaway signed-in user so the app pages can be reviewed without Gmail; run
it with `--remove` afterwards.

## License

MIT for the code. The fonts are not included: Berkeley Mono (Berkeley Graphics) and Camber (Emtype) are licensed to
the hosted instance only. `pnpm fonts:fallback` gives you open stand-ins.
