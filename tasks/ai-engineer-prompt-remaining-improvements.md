# GraphQL Goodreads — Remaining Improvements (AI Agent Task)

## Role

You are a senior Node.js engineer. You are working on the public GitHub repository
`daniel-castilho/graphql-goodreads`, a minimal GraphQL API that wraps the Goodreads XML API
(exposing authors and their books through a typed schema with a GraphiQL interface).

Your job is to implement the remaining improvements listed below, **incrementally, in English,
with tests**, keeping the existing CI green and the repository in a clean, shippable state.

## Sources of truth (read in order, before starting)

1. `AGENTS.md` — project rules for AI-assisted development (non-negotiable; follow it).
2. `README.md` — overview, setup, API documentation, Current State, Roadmap.
3. `docs/lessons.md` — hard-won rules (test runner invocation, git add, npm overrides, lockfile,
   Dependabot lag).
4. `package.json` and `.github/workflows/ci.yml` — scripts, dependencies, CI gate.
5. Code: `server.js`, `schema.js`, `test/schema.test.js`, `test/server.test.js`.

## Repository context

- **Stack:** Node.js (`engines.node: ">=20"`, CI matrix 20/22/24), Express 4, `express-graphql`
  0.11, `graphql` 15, `xml2js`, native global `fetch` (Node 18+).
- **Secrets:** the Goodreads API key is already read from the `GOODREADS_API_KEY` environment
  variable; `server.js` fails fast at startup when it is missing. `.env.example` is the tracked
  template; `.env` / `.env.*` are gitignored.
- **Tests:** Node's built-in test runner (`node --test` — **no directory argument**, see
  `docs/lessons.md`) + `supertest`. The global `fetch` is mocked with `t.mock.method` — tests
  never hit the real network.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci` → `npm test` →
  `npm audit --audit-level=high` on Node 20 / 22 / 24 for every push to `master` and every PR.
- **Current feature set:** a single query `author(id)` returning
  `{ name, books { title, isbn } }`, fetched live from the Goodreads XML API.
- **Important:** the Goodreads public API is **retired** (no new developer keys since Dec 2020,
  API in shutdown). The project already surfaces this as a clean GraphQL error.

## Constraints (non-negotiable)

1. All deliverables in English.
2. Obey `AGENTS.md` (English only, no secrets in code, doc-sync is part of Done, no push
   without being asked).
3. Keep **Node >= 20 support** (CI matrix 20/22/24). Do not bump engines to something that
   breaks Node 20; do not use `graphql@17` (requires Node 22+).
4. Tests use `node --test` + `supertest` and mock the global `fetch` with `t.mock.method`.
   Never make real network calls in tests.
5. `npm audit --audit-level=high` must stay clean (exit 0, 0 vulnerabilities).
6. Work incrementally: **one concern per commit**, conventional commit messages
   (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
7. Prefer Node built-ins. Avoid new dependencies unless strictly necessary; if you add one,
   justify it in the commit message and it still needs explicit human approval.
8. Do **not** rewrite git history. Do **not** run destructive commands. Do not touch unrelated
   files.
9. Before changing anything, establish the baseline: `git status`, `git log --oneline -8`,
   `npm test`, `npm audit`.

## Step 0 — Assess the current state

Run and record:

```sh
git status
git log --oneline -8
cat package.json            # dependencies / scripts / engines
npm test
npm audit
ls -la .github/workflows/   # CI present?
ls -la .env.example .nvmrc  # env template / node pin present?
grep -rn "GOODREADS_API_KEY\|node-fetch\|proxyquire" schema.js server.js package.json test/
```

Then implement **only what is missing**, in the order below. Skip any step that is already done
and say so in your summary.

## Step 1 — Secrets & native fetch (verify; expected already applied)

Verify the following are true; implement any that are missing:

- `schema.js` reads the key from `process.env.GOODREADS_API_KEY` (no hardcoded key).
- `server.js` fails fast at startup when `GOODREADS_API_KEY` is missing (exit 1, clear message).
- `schema.js` uses the global native `fetch` (no `node-fetch` dependency).
- `node-fetch` is removed from `dependencies`; `proxyquire` is removed from `devDependencies`
  (tests use `t.mock.method` instead).
- `.env.example` exists (tracked template); `.env` / `.env.*` are gitignored.

Acceptance: `GOODREADS_API_KEY= npm start` exits 1 with a clear message; `npm test` passes.

## Step 2 — Migrate to a maintained GraphQL server

- Replace `express-graphql` (unmaintained/archived) with **`graphql-http`** (maintained).
- Upgrade `graphql` to **`^16`** — do **not** use `graphql@17`, which requires Node 22+
  and would break the Node 20 CI job and the `engines: ">=20"` contract.
- In `server.js`:
  - Use `createHandler` from `graphql-http` for the `/graphql` endpoint.
  - **Preserve the interactive documentation experience:** serve a GraphiQL page on
    `GET /graphql` (Accept: text/html). You may inline a small self-contained GraphiQL HTML page
    (e.g. loading GraphiQL/React from a CDN like unpkg) — keep it minimal and dependency-free in
    the repo.
- Update tests to match the new server behaviour:
  - `GET /graphql` (Accept text/html) returns the GraphiQL page.
  - `POST /graphql` with a valid query returns the resolved data.
  - Malformed query behaviour — verify what `graphql-http` actually returns and assert on it
    (adjust the existing "malformed query -> 400" test to the real behaviour).

Acceptance: `npm test` green; GraphiQL still reachable; `npm audit` clean.

## Step 3 — Input validation

- `author(id)`:
  - For the Goodreads provider: `id` must be a positive integer (> 0). Reject missing/empty,
    non-numeric, and non-positive values with a descriptive GraphQL error.
  - For the Open Library provider (Step 5): `id` must be a non-empty string (author key).
- Add tests for invalid/missing ids (both providers if applicable).

## Step 4 — Upstream resilience

- Add a **timeout** to upstream requests (e.g. 10s via `AbortController`) and map a timeout to a
  descriptive GraphQL error.
- Keep the existing handling of non-OK responses and malformed XML/JSON (verify it still works).
- Add a test for the timeout path.

## Step 5 — Data provider abstraction + Open Library provider

Introduce a small provider layer so the data source is swappable:

- Layout (choose a simple one, e.g. `providers/` at the project root):
  - `BookProvider` — a contract with `getAuthor(id)` returning a normalized shape
    `{ id, name, books: [{ title, isbn }] }`.
  - `GoodreadsProvider` — keeps the current XML behaviour (uses `GOODREADS_API_KEY`).
  - `OpenLibraryProvider` — new, JSON-based, **no API key required**; becomes the **default**.
- Runtime selection via env var `BOOK_PROVIDER=goodreads|openlibrary` (default `openlibrary`).
  `GOODREADS_API_KEY` is only required when `BOOK_PROVIDER=goodreads`.
- Open Library endpoints (reference — verify exact shapes at implementation time):
  - Author: `https://openlibrary.org/authors/{id}.json`
  - Works by author: `https://openlibrary.org/authors/{id}/works.json`
  - Editions (for ISBNs): `https://openlibrary.org/works/{workKey}/editions.json`
  - Search authors: `https://openlibrary.org/search/authors.json?q={name}`
- Design decisions to make and **document in the README**:
  - How `author(id)` maps to an Open Library author key (e.g. `OL23919A`). The GraphQL field name
    stays `author(id)`, but the accepted id format changes for the Open Library provider —
    document this clearly (including in the API section and example queries).
  - How `books` obtains `title` and `isbn`: e.g. works from `works.json`, and the first ISBN-13
    from each work's `editions.json`. `isbn` may be null/omitted when not available. Keep the
    field nullable rather than failing the whole query.
- Tests: mock the global `fetch` with Open Library JSON fixtures; cover happy path, unknown
  author, author with no books, network error, timeout, and the `BOOK_PROVIDER` selection logic.

Acceptance: with `BOOK_PROVIDER=openlibrary` (default) the API returns real data shape without
any key; `BOOK_PROVIDER=goodreads` still works against a mocked/valid key; `npm test` green.

## Step 6 — Caching (recommended)

- Add a simple **in-memory TTL cache** (e.g. 1 hour) for upstream responses, keyed by
  provider + request args.
- No new dependency: a `Map` with timestamps is fine; evict lazily on access.
- Unit tests: cache hit, cache miss, expiry.

## Step 7 — Documentation sync (required, doc-sync is part of Done)

Update the documentation to reflect the **final** state (all in English):

- **README.md** — rewrite/update so it accurately reflects the final state:
  - Title/badges reflect the stack (GraphQL 16, graphql-http, Open Library API, Node).
  - Intro mentions the provider abstraction; Open Library is the default key-free data source,
    Goodreads is an optional legacy provider.
  - Tech Stack table: replace `express-graphql` with `graphql-http`; add Open Library API and
    native `fetch`; remove anything obsolete.
  - Architecture: include the `providers/` layout and the updated data flow.
  - Requirements: Node >= 20; no API key needed for the default (Open Library) provider.
  - Getting Started: `BOOK_PROVIDER`, `GOODREADS_API_KEY` (only for Goodreads), `.env` /
    `.env.example`, start commands, example query per provider.
  - Commands table: keep `npm install / start / test / test:watch / audit` accurate.
  - Testing: describe the suites and update the test counts to the real numbers after you run
    them.
  - API & Documentation: document `author(id)` semantics per provider, example queries and
    responses, GraphiQL URL.
  - Current State: accurate list of what is implemented.
  - Roadmap: remove completed items; keep/refine the rest (e.g. TypeScript migration, more
    queries, Dockerfile, pagination).
- **CHANGELOG.md** — add an entry under `[Unreleased]` for the new work.
- **AGENTS.md** — update "Known technical debt" (clear what you resolved, add nothing new).
- **docs/lessons.md** — add an entry only if a durable rule was learned.
- Keep the structure/tone consistent with the existing docs.

## Stop and ask the human if...

- A new npm dependency seems required (beyond `graphql-http` and `graphql@16`).
- Enforcing the GraphiQL replacement would drop the interactive docs and no clean alternative
  exists.
- Any change would force a `graphql@17`/Node 22+ bump or otherwise violate the Node 20 contract.
- The scope of a step grows beyond what is described here (e.g. auth, database, new endpoints
  beyond the roadmap).
- Anything in this prompt conflicts with reality (e.g. `graphql-http` behaves differently than
  described) — in that case follow the reality, adjust the tests, and document the deviation in
  your report rather than stopping.

## Done report (mandatory — reply in this format)

```markdown
## Summary
- State assessed: <baseline results — commits, tests, audit>

## Implemented
- Step 1 (secrets/fetch): <done | already applied>
- Step 2 (graphql-http + graphql 16):
- Step 3 (input validation):
- Step 4 (timeout):
- Step 5 (provider abstraction + Open Library):
- Step 6 (cache):
- Step 7 (docs sync):

## Tests added/updated
<list; final count>

## Quality gates
- npm ci: <ok>
- npm test: <count pass/fail>
- npm audit --audit-level=high: <ok>
- smoke (BOOK_PROVIDER=openlibrary npm start + curl): <result>

## Design decisions
- id format for Open Library:
- how books/isbn are resolved:
- GraphiQL approach after the migration:
- cache TTL and strategy:
- default BOOK_PROVIDER:

## Residual risks / follow-ups
<list>

## Docs touched
- README.md / CHANGELOG.md / AGENTS.md / docs/lessons.md: <what changed>
```

## Notes for the agent

- Read files fully before editing; keep changes minimal and focused.
- If a step is already implemented in the repo, skip it and note it — do not redo working code.
- Keep every commit green on its own where practical (tests pass at each step).
- Do not push to the remote unless the human explicitly asks.
