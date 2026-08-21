# AGENTS.md

GraphQL Goodreads — a minimal GraphQL API for authors and their books, backed by a swappable
provider layer: **Open Library** (default, key-free JSON) and the legacy **Goodreads** XML API.
Stack: Express 4 + `graphql-http` 1.23 + `graphql` 16 (+ `xml2js` for the Goodreads provider
only), native `fetch` (Node 18+), Node 20+ (CI runs 20/22/24).

Sources of truth (read in order): `README.md`, `AGENTS.md`, `docs/lessons.md`, `package.json`.
Re-read the relevant parts before starting any task.

## Critical rules (never violate)

1. **GOLDEN RULE — documentation never drifts.** Documentation is part of the deliverable. Any
   change that affects behaviour, stack, commands, architecture or project status MUST leave
   `README.md`, `AGENTS.md` and `CHANGELOG.md` (plus `docs/lessons.md` when a durable rule was
   learned) describing the **new** reality — in the same change set, or an immediate follow-up
   commit. Never claim work DONE while any doc still describes the previous state as current.
   Found drift? Fix it in the same task or flag it to the human immediately — never ignore it.
2. **English only.** Code, identifiers, comments, commit messages, documentation and log messages
   in English.
3. **Never commit secrets.** The Goodreads API key is read from the `GOODREADS_API_KEY`
   environment variable — never hardcoded, never committed. `.env` and `.env.*` are gitignored;
   `.env.example` is the tracked template.
4. **No new npm dependency without explicit human approval.** Prefer Node built-ins (e.g. the
   global `fetch` instead of `node-fetch`).
5. **Tests** use Node's built-in test runner (`node --test`, **no path argument** — see
   `docs/lessons.md`) + `supertest`. Mock the global `fetch` with `t.mock.method`. Never make real
   network calls in tests; the suite must stay offline and deterministic.
6. **Node >= 20.** CI runs the matrix 20/22/24. Do not bump `graphql` to 17 (requires Node 22+)
   or change `engines` without updating CI accordingly.
7. **Commit `package-lock.json` whenever `npm install` mutates it.** Before pushing, verify:
   `rm -rf node_modules && npm ci` must complete cleanly.
8. **Keep `npm audit --audit-level=high` clean** (CI gate). If a high/critical advisory cannot be
   fixed in the same change set, flag it to the human instead of weakening the gate.
9. **Do not push to the remote unless the human explicitly asks.**
10. **Known technical debt is documented, not silently "fixed"** — see below. Flag violations to
    the human; do not expand them.

## Commands

| Purpose | Command |
| :--- | :--- |
| Install dependencies | `npm install` |
| Run the dev server (port 4000) | `npm start` |
| Run the test suite (once) | `npm test` |
| Run tests in watch mode | `npm run test:watch` |
| Test coverage (built-in V8 report) | `npm run test:coverage` |
| Security audit | `npm audit` |

> `npm start` runs key-free with the default Open Library provider. It fails fast at startup on
> invalid configuration — unknown `BOOK_PROVIDER`, or `BOOK_PROVIDER=goodreads` without
> `GOODREADS_API_KEY`:
> `BOOK_PROVIDER=goodreads GOODREADS_API_KEY=your-key npm start`.

## Architecture

```
graphql-goodreads/
├── server.js     Express app + graphql-http at /graphql (GraphiQL on GET). Exports the app;
│                 listens on port 4000 only when run directly (require.main === module);
│                 fails fast at startup on invalid configuration (unknown BOOK_PROVIDER, or
│                 BOOK_PROVIDER=goodreads without GOODREADS_API_KEY).
├── schema.js     GraphQL schema factory — builds the typed schema (Author, Book) on top of the
│                 selected BookProvider. Never talks to the network; maps the normalized
│                 provider shape into GraphQL types.
├── providers/    Swappable data sources behind author(id):
│   ├── index.js  BOOK_PROVIDER selection (+ per-provider TTL cache wiring)
│   ├── openlibrary.js  Default provider — Open Library JSON API, no key needed
│   └── goodreads.js    Legacy provider — Goodreads XML API, needs GOODREADS_API_KEY
├── lib/
│   ├── upstream.js   fetchUpstream(): native fetch + AbortController timeout (10 s default,
│   │                 UPSTREAM_TIMEOUT_MS) + non-OK handling
│   └── cache.js      TTLCache (Map + timestamps, lazy eviction) and memoize() helper
└── test/         node:test suites (offline, deterministic — fetch is always mocked):
                  goodreads, openlibrary, providers, cache, server + fixtures/ (canned XML/JSON).
```

- `server.js` is pure glue: mount the schema handler, serve GraphiQL, listen on 4000. It knows
  nothing about providers or upstream APIs.
- `schema.js` never talks to the network; providers own their id semantics, upstream URLs and
  payload parsing. Failures surface as descriptive GraphQL errors.
- Successful author lookups are cached in memory for one hour (keyed by provider and id).
- No database.

## Known technical debt (resolve later; flag, don't silently fix)

- No pagination controls for large authors (currently all works are resolved in one query) — see
  README Roadmap.
- Only one query so far (`author(id)`): no book by key/id, no author search (Open Library
  `search/authors.json`), no covers.
- No Dockerfile (CI pipeline already in place via GitHub Actions).
- Plain JavaScript — TypeScript migration is a candidate backlog item.

## Notes

- Secrets live in `.env` / environment variables only — never committed.
- For current project status and pending work, see `README.md` ("Current State" / "Roadmap").
- Hard-won engineering rules live in `docs/lessons.md`.
- One-off AI engineering prompts live under `tasks/` (see
  `tasks/ai-engineer-prompt-remaining-improvements.md`).
