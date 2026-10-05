# Contributing

Mailroom is a small personal project that happens to be open. Issues and pull requests are welcome; keep them small.

- `pnpm install`, copy `.env.example` to `.env.local`, `pnpm db:push`, `pnpm dev`. The full setup is in the README.
- Before a pull request: `pnpm typecheck`, `pnpm lint`, `pnpm test`. The GitHub Actions workflow that runs the same three lives in `docs/ci-workflow.yml`; copy it to `.github/workflows/ci.yml` to enable it.
- Tests live under `tests/`. Pure logic (the search compiler, the route compiler and adoption planner, thread summaries, label expansion) has tests; Gmail and TypeSafe calls are not mocked, they are kept thin.
- Built-in routes in `src/lib/policy/routes.ts` list generic, widely used services only. A test fails if two of them file the same sender into different categories without a subject to tell them apart. Personal senders belong in a policy, never in code.
- The non-negotiables are in `SECURITY.md`: nothing in a change may send mail, unsubscribe, delete permanently, or move message bodies off Google.
- Type is part of the design. Headings and prose are Camber, data and chrome are Berkeley Mono, numbers are tabular. Logos stay in color.
