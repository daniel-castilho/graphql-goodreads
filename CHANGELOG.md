# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `npm run test:coverage` — built-in V8 coverage report via
  `node --test --experimental-test-coverage` (no new dependency).

### Changed
- Docs reconciliation with the v1.0.0 state: `AGENTS.md` now describes the provider-based
  architecture (intro, Commands, Architecture, technical-debt list) and elevates doc sync to
  **GOLDEN RULE #1 — documentation never drifts**; the archived task prompt under `tasks/`
  carries a status banner marking its steps as implemented.
- Test suite hardening: each GraphQL-layer scenario builds a fresh schema/provider instance
  (no shared TTL cache between tests), the cache expiry test uses a deterministic frozen clock
  (`t.mock.timers`) instead of real sleeps, and two HTTP routing tests were added (GET
  fall-through to graphql-http, JSON content-type on POST). 34 → 36 tests.

## [1.0.0] - 2026-08-21

### Security
- Fixed GHSA-3jxr-9vmj-r5cp / CVE-2026-13149 (brace-expansion exponential-time DoS) and the
  other `brace-expansion`, `minimatch`, `semver`, `express`, `xml2js` advisories. `npm audit`
  reports **0 vulnerabilities**.
- Removed the hardcoded Goodreads API key. The key is now read from the `GOODREADS_API_KEY`
  environment variable, `server.js` fails fast at startup when it is missing, and upstream
  non-OK responses map to a descriptive GraphQL error.
- Replaced `node-fetch` with the native global `fetch`; removed `proxyquire` from the tree.

### Added
- Automated test suite using Node's built-in test runner + `supertest`, with the global `fetch`
  mocked via `t.mock.method` — offline and deterministic.
- README with setup, API documentation and roadmap.
- GitHub Actions CI (`.github/workflows/ci.yml`) running `npm ci` → `npm test` →
  `npm audit --audit-level=high` on Node 20/22/24.
- `.env.example` template; `.gitignore` hardened for secrets (`.env.*` ignored, `.env.example`
  exception).
- `package.json` metadata: `description`, `engines.node: ">=20"`, `keywords`.
- `AGENTS.md` — project rules for solo and AI-assisted development.
- `docs/lessons.md` — durable engineering lessons learned the hard way.
- `.nvmrc` pinning Node 24 for local development.
- Provider layer (`providers/`) with a swappable `BookProvider` contract behind `author(id)`:
  **Open Library** (default, JSON, key-free) and the legacy **Goodreads** XML provider, selected
  at runtime via `BOOK_PROVIDER=openlibrary|goodreads`.
- Open Library mapping: `author(id)` accepts an author key such as `OL23919A`; books come from
  `works.json` and each ISBN from the work's first ISBN-13 across its editions (ISBN-10 fallback,
  `null` otherwise).
- Input validation on `author(id)` per provider (positive integer vs non-empty author key) with
  descriptive GraphQL errors.
- Upstream resilience: 10s `AbortController` timeout on every upstream request (tunable via
  `UPSTREAM_TIMEOUT_MS`); timeouts, non-OK statuses, unknown authors and malformed payloads map
  to clean GraphQL errors.
- In-memory TTL cache (1 hour) for successful author lookups, keyed by provider + id, with lazy
  eviction and shared in-flight requests (`lib/cache.js`).
- Self-contained GraphiQL page served on `GET /graphql` when the client accepts `text/html`.
- Test suites for both providers, provider selection and the cache — 34 offline tests total.

### Changed
- `server.js` now exports the Express app and listens only when run directly
  (`require.main === module`), enabling HTTP integration tests.
- `.env.example` expanded with guidance and production-bar notes.
- Replaced the unmaintained `express-graphql` with `graphql-http`; upgraded `graphql` from 15 to
  16 (17 requires Node 22+, which would break the Node 20 CI job).
- Malformed GraphQL documents now return HTTP 200 with an `errors` array, per the GraphQL over
  HTTP spec implemented by `graphql-http` (`express-graphql` used to return 400).
- `GOODREADS_API_KEY` is only required (and only fails fast at startup) when
  `BOOK_PROVIDER=goodreads`.

### Removed
- `express-graphql` dependency.

[1.0.0]: https://github.com/daniel-castilho/graphql-goodreads/releases/tag/v1.0.0
