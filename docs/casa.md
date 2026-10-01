# CASA AL1: what Google asked for, what is true about Mailroom, what is left to do

Google's Trust and Safety team cleared every other verification requirement on 2026-10-01 and asked for one more thing:
an **ADA-CASA AL1** security assessment (formerly "Tier 2"), due **December 29, 2026**, renewed annually, because
`gmail.modify` is a restricted scope. After the lab issues its Letter of Validation, reply to Google's email to finish.

## The process

- **AL1 is a verified self-assessment.** The developer supplies evidence and statements of compliance for each CASA
  requirement; an ADA-authorized lab reviews the evidence. The lab does not test the app itself (that is AL2).
- **Lab:** TAC Security is Google's preferred partner at a negotiated rate. As of 2026-10-01 their site lists
  **AL1 at $675 one time** (list $1,800) with two revalidation cycles, remediation support, and the Letter of
  Validation; their stated timeline is 2 to 4 weeks. Any other ADA-authorized lab also works
  (appdefensealliance.org/certification/authorized-labs). AL2 is $5,400 and up and is not required.
- **Steps only Kevin can do:** create the TAC Security account (casa.tacsecurity.com), pay, register the application
  (URL `https://mailroom.kevinliu.studio`, GCP project `mailroom-kevinliu`, project number 212770317862), answer the
  CASA questionnaire from the table below, run whatever scan their platform asks for (their flow usually includes a
  dynamic scan of the URL and, optionally, a source scan via GitHub), fix anything it flags, receive the Letter of
  Validation, then reply to Google's email with it attached.
- **Spec:** github.com/appdefensealliance/ASA-WG, `CASA/CASA Specification.md`. Twenty requirements, derived from
  OWASP ASVS, listed below with Mailroom's answer and where the evidence lives.

## Evidence, requirement by requirement

| # | Requirement | Mailroom | Evidence |
| --- | --- | --- | --- |
| 1.1 | Strong password security | Not applicable. Mailroom has no passwords. The only sign-in is Google OAuth; Google enforces its own brute-force protection and MFA. | `src/auth.ts` (single Google provider) |
| 1.2 | No default accounts | None exist. Accounts are created only by a successful Google sign-in. | `src/auth.ts`, `src/db/schema.ts` |
| 1.3 | Out-of-band verifiers random, single-use | Not applicable. Mailroom sends no codes or emails; it never sends mail at all. | Product policy in `README`/landing |
| 2.1 | No authentication material in URLs | Session is a cookie. The OAuth code is exchanged server-side by Auth.js; access and refresh tokens never leave the server. Search text appears in `/app/search?q=` but it is the user's own question, not a credential. | `src/auth.ts`, `src/app/api/*` |
| 2.2 | Session invalidation on logout | Database sessions (Auth.js, 30-day max age). Sign out deletes the session row. Disconnect revokes the Google refresh token (best effort) and deletes the user row, which cascades to accounts, sessions, policy, runs, judgments. | `src/auth.ts` (`strategy: "database"`), `src/app/api/disconnect/route.ts` |
| 2.3 | Secure session tokens | Auth.js cookies in production: `__Secure-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`. Tokens are random, generated server-side. | Auth.js defaults; verify with the browser's cookie inspector |
| 2.4 | Protect sensitive account modifications | Every write requires a valid session (`requireUserId`). Destructive actions (apply, trash, disconnect) use a two-step confirm control. Gmail access itself is granted by Google's consent screen. | `src/lib/session.ts`, `src/components/Confirm.tsx` |
| 3.1 | Access control on data and APIs | Every API route resolves the user from the session and scopes each query by `userId` (runs, batches, policy, saved searches, judgments). Gmail is reached only with that user's own token. | `src/app/api/**/route.ts`, `src/lib/engine/run.ts` (`gmailFor`) |
| 3.2 | Secure OAuth integration | Authorization Code flow with PKCE and `state` via Auth.js v5. `access_type=offline`, `prompt=consent`. Scopes requested: `gmail.modify`, `gmail.settings.basic`, `openid email profile`. Refresh and access tokens encrypted at rest with AES-256-GCM before storage. | `src/auth.ts`, `src/lib/crypto.ts` |
| 3.3 | MFA on administrative interfaces | Mailroom has no admin interface. The infrastructure consoles (Vercel, Neon, Google Cloud, GitHub) are personal accounts; **Kevin to confirm MFA is enabled on each**. | Account settings of each provider |
| 4.1 | Strong cryptography, TLS | TLS 1.2+ terminated by Vercel; HSTS `max-age=63072000; includeSubDomains; preload`. Postgres on Neon is encrypted at rest; OAuth tokens are additionally encrypted with AES-256-GCM, key in `TOKEN_ENCRYPTION_KEY` (Vercel encrypted env). | `next.config.ts`, `src/lib/crypto.ts`; run Qualys SSL Labs on the domain for the report |
| 5.1 | Input validation and sanitation | Request bodies are parsed and type-checked in code; the policy document is validated with zod. All SQL goes through Drizzle's parameterized queries. React escapes all output; no `dangerouslySetInnerHTML` anywhere. Redirects are internal only; Auth.js validates callback URLs. State-changing API requests must carry a same-origin `Origin` header (middleware). | `src/lib/policy/schema.ts`, `src/middleware.ts`, Drizzle usage throughout |
| 5.2 | Untrusted file handling | Not applicable. Mailroom accepts no file uploads. | |
| 6.1 | Components up to date | `pnpm audit --prod` reports no known vulnerabilities (2026-10-01). Next.js 16, React 19, Auth.js 5. Enable Dependabot alerts on the GitHub repo to keep it that way. | `package.json`, `pnpm-lock.yaml` |
| 6.2 | Debug modes off in production | Production builds only; no debug flags; the `X-Powered-By` header is removed. Errors returned to the client are messages, never stack traces. | `next.config.ts` (`poweredByHeader: false`), `src/app/api/search/route.ts` |
| 6.3 | Origin header not used for authentication | Correct. The `Origin` check in middleware only refuses cross-site writes; it never grants access. Authentication is the session cookie, always. | `src/middleware.ts` |
| 6.4 | No subdomain takeover | `mailroom.kevinliu.studio` is a CNAME to Vercel with the project bound. **Kevin to confirm no dangling records under `kevinliu.studio`** (a CNAME to a service that no longer serves it). | DNS zone for kevinliu.studio |
| 6.5 | No credentials or payment details in logs | Nothing logs tokens or secrets. The one diagnostic log on search failures records the question text and the error message only. No payments exist. | `src/app/api/search/route.ts` |
| 6.6 | Client storage cleared on logout | Browser storage holds only the theme preference (no user data). The session cookie is cleared on sign out. | `src/components/ThemeToggle.tsx`, Auth.js sign-out |
| 6.7 | Server-side secrets stored securely | All secrets live in Vercel's encrypted environment variables (`TYPESAFE_API_KEY`, `AUTH_SECRET`, Google client id and secret, `DATABASE_URL`, `CRON_SECRET`, `TOKEN_ENCRYPTION_KEY`). OAuth tokens are encrypted in the database. Nothing secret is committed. | Vercel project settings; `src/lib/crypto.ts` |

Security headers sent on every response (added 2026-10-01): `Content-Security-Policy` (self-only scripts and styles,
inline allowed for Next and Tailwind, `frame-ancestors 'none'`, `object-src 'none'`), `Strict-Transport-Security`
with preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` denying camera, microphone, geolocation, payment, and USB, `Cross-Origin-Opener-Policy: same-origin`.

## Data handling statements the questionnaire usually asks for

- Mailroom reads Gmail **metadata only** (headers, labels, snippets) and never message bodies. Metadata is sent to
  TypeSafe's Jev for typed judgments. Nothing is used to train models.
- Mailroom **never sends mail, never unsubscribes, never permanently deletes**. Trash is Gmail's own Trash with 30-day
  recovery; every run previews first and can be undone.
- Stored per user: Google account id and email, encrypted OAuth tokens, the policy, run receipts (message ids and label
  changes), AI judgments (category, probabilities), sender profiles (domains and counts). Disconnect deletes all of it.
- Hosting: Vercel (US), Neon Postgres (US). Third parties with access to data: Google (source), TypeSafe (metadata for
  judgments), Vercel and Neon (infrastructure).
