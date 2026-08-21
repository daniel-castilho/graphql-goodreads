# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `AGENTS.md` — project rules for solo and AI-assisted development.
- `docs/lessons.md` — durable engineering lessons learned the hard way.
- `.nvmrc` pinning Node 24 for local development.

### Changed
- `.env.example` expanded with guidance and production-bar notes.

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
- Automated test suite (10 tests) using Node's built-in test runner + `supertest`, with the
  global `fetch` mocked via `t.mock.method` — offline and deterministic.
- README with setup, API documentation and roadmap.
- GitHub Actions CI (`.github/workflows/ci.yml`) running `npm ci` → `npm test` →
  `npm audit --audit-level=high` on Node 20/22/24.
- `.env.example` template; `.gitignore` hardened for secrets (`.env.*` ignored, `.env.example`
  exception).
- `package.json` metadata: `description`, `engines.node: ">=20"`, `keywords`.

### Changed
- `server.js` now exports the Express app and listens only when run directly
  (`require.main === module`), enabling HTTP integration tests.
