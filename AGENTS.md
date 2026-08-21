# AGENTS.md

GraphQL Goodreads — a minimal GraphQL API that wraps the Goodreads XML API, exposing authors and
their books through a typed GraphQL schema with a GraphiQL interface. Stack: Express 4 +
`express-graphql` 0.11 + `graphql` 15 + `xml2js`, native `fetch` (Node 18+), Node 20+ (CI runs
20/22/24).

Sources of truth (read in order): `README.md`, `AGENTS.md`, `docs/lessons.md`, `package.json`.
Re-read the relevant parts before starting any task.

## Critical rules (never violate)

1. **English only.** Code, identifiers, comments, commit messages, documentation and log messages
   in English.
2. **Never commit secrets.** The Goodreads API key is read from the `GOODREADS_API_KEY`
   environment variable — never hardcoded, never committed. `.env` and `.env.*` are gitignored;
   `.env.example` is the tracked template.
3. **No new npm dependency without explicit human approval.** Prefer Node built-ins (e.g. the
   global `fetch` instead of `node-fetch`).
4. **Tests** use Node's built-in test runner (`node --test`, **no path argument** — see
   `docs/lessons.md`) + `supertest`. Mock the global `fetch` with `t.mock.method`. Never make real
   network calls in tests; the suite must stay offline and deterministic.
5. **Node >= 20.** CI runs the matrix 20/22/24. Do not bump `graphql` to 17 (requires Node 22+)
   or change `engines` without updating CI accordingly.
6. **Commit `package-lock.json` whenever `npm install` mutates it.** Before pushing, verify:
   `rm -rf node_modules && npm ci` must complete cleanly.
7. **Doc sync is part of Done.** After milestone-sized work (a new feature, a behaviour change, a
   dependency/stack change, a security fix), the same change set — or an immediate follow-up
   commit — MUST update `README.md` ("Current State"), `CHANGELOG.md`, and `docs/lessons.md`
   (only when a durable rule was learned). Do **not** claim work DONE while any of those files
   still describes the previous state as current.
8. **Keep `npm audit --audit-level=high` clean** (CI gate). If a high/critical advisory cannot be
   fixed in the same change set, flag it to the human instead of weakening the gate.
9. **Do not push to the remote unless the human explicitly asks.**
10. **Known technical debt is documented, not silently "fixed"** — see below. Flag violations to
    the human; do not expand them.

## Commands

| Purpose | Command |
| :--- | :--- |
| Install dependencies | `npm install` |
| Run the dev server (port 4000) | `npm start` — requires `GOODREADS_API_KEY` |
| Run the test suite (once) | `npm test` |
| Run tests in watch mode | `npm run test:watch` |
| Security audit | `npm audit` |

> `npm start` fails fast with a clear message when `GOODREADS_API_KEY` is missing:
> `GOODREADS_API_KEY=your-key npm start`.

## Architecture

```
graphql-goodreads/
├── server.js     Express app + express-graphql at /graphql (GraphiQL on). Exports the app;
│                 listens on port 4000 only when run directly (require.main === module);
│                 fails fast at startup when GOODREADS_API_KEY is missing.
├── schema.js     GraphQL schema and resolvers. The author(id) resolver is the ONLY module that
│                 talks to the Goodreads XML API (native fetch + xml2js). Reads the key from
│                 process.env.GOODREADS_API_KEY; non-OK upstream responses map to a descriptive
│                 GraphQL error.
└── test/         schema.test.js (resolver unit tests), server.test.js (HTTP integration via
                  supertest), fixtures/goodreads-response.xml (canned XML).
```

- `server.js` is pure glue: mount the schema, enable GraphiQL, listen on 4000.
- `schema.js` is the only integration boundary; every request calls the upstream XML API live.
- No database, no caching (planned — see README Roadmap).

## Known technical debt (resolve later; flag, don't silently fix)

- `express-graphql` 0.11 is deprecated/unmaintained — migrate to `graphql-http` and upgrade
  `graphql` to 16 (not 17: Node 22+ requirement).
- No input validation on `author(id)` (accepts missing/non-positive ids).
- No timeout on upstream requests.
- The Goodreads API is **retired** (no new keys since Dec 2020); the API surfaces a clean error,
  but a live, key-free data source (e.g. Open Library) behind a small provider abstraction is the
  planned direction — see README Roadmap.
- No in-memory TTL cache for upstream responses.

## Notes

- Secrets live in `.env` / environment variables only — never committed.
- For current project status and pending work, see `README.md` ("Current State" / "Roadmap").
- Hard-won engineering rules live in `docs/lessons.md`.
- One-off AI engineering prompts live under `tasks/` (see
  `tasks/ai-engineer-prompt-remaining-improvements.md`).
