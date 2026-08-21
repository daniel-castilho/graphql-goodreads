# Lessons — GraphQL Goodreads

Durable engineering rules learned the hard way in this project. Each entry states the failure
mode and the rule that prevents it. Add a new entry only when a rule proves itself; keep entries
short and actionable.

---

## `node --test` must not be called with a directory argument (2026-08-21)

`node --test test/` worked on Node 20 but broke on Node 21+ with
`Error: Cannot find module .../test` — the runner treats the path argument as a module to
execute, not as a directory to scan.

**Rule:** invoke the test runner as plain `node --test` (it auto-discovers `*.test.js` under
`test/` and `**/*.test.js`). Verified green on Node 20, 22 and 24. The npm scripts use
`"test": "node --test"` and `"test:watch": "node --test --watch"`.

---

## `git add` with a nonexistent pathspec aborts the whole batch (2026-08-21)

`git add package.json package-lock.json yarn.lock pnpm-lock.yaml` failed silently when
`yarn.lock`/`pnpm-lock.yaml` did not exist: the entire command errored, nothing was staged, and a
script that swallowed the error with `|| true` reported "nothing to commit" while the lockfile
was modified and left uncommitted.

**Rule:** add files individually when the set is conditional —
`for f in a b c; do [ -f "$f" ] && git add -- "$f"; done` — or only ever pass paths known to
exist. Never batch `git add` with paths that may not exist.

---

## npm `overrides` on a direct dependency must match the normalized spec (2026-08-21)

`npm install brace-expansion@^5.0.7 --save` writes `"brace-expansion": "^5.0.9"` into
`package.json` (npm normalizes the caret to the installed version). Adding
`"overrides": { "brace-expansion": "^5.0.7" }` afterwards fails with
`EOVERRIDE: Override for brace-expansion@^5.0.9 conflicts with direct dependency`.

**Rule:** when overriding a **direct** dependency, read the spec back from `package.json` after
the install and use exactly that string in the override. For transitive-only overrides any valid
range works.

---

## A pinned transitive dependency may need a targeted override (2026-08-21)

`nodemon@2.x` → `simple-update-notifier@1.1.0` pins `semver ~7.0.0` (vulnerable ReDoS, fixed in
7.5.2+). `npm audit fix` could not reach it because the vulnerable range is pinned by an upstream
that had not patched.

**Rule:** force the fixed version with a scoped root `overrides` entry instead of an audit
allowlist —
`"overrides": { "simple-update-notifier": { "semver": "^7.5.2" } }` —
then run the full gate (tests + `npm audit`) before committing. Drop the override once the
upstream releases a version that resolves it on its own.

---

## Lockfile generation is npm-version-sensitive (2026-08-21)

Regenerating `package-lock.json` with a different npm than CI's can resolve the optional/
transitive tree differently, so `npm ci` can pass locally and fail on CI.

**Rule:** regenerate the lockfile with the exact npm that CI uses (match `.nvmrc`/CI Node), and
sanity-check with `rm -rf node_modules && npm ci` before pushing. A locally green `npm ci` on a
different npm version is not evidence the lockfile is CI-clean.

---

## `graphql()` takes a single args object since graphql 16 (2026-08-21)

Calling `graphql(schema, source)` — the positional signature of graphql ≤ 15 — on graphql 16
fails with the misleading `Error: Expected undefined to be a GraphQL schema`: the schema object
is interpreted as the args object, so `args.schema` is `undefined`. There is no dual-signature
shim.

**Rule:** after upgrading to graphql 16, call `graphql({ schema, source, ... })` everywhere,
including tests that exercise the schema directly.

---

## graphql-http answers parse/validation failures with HTTP 200 (2026-08-21)

Migrating from `express-graphql` to `graphql-http`, the "malformed query → 400" test broke:
`graphql-http` follows the GraphQL over HTTP spec and reports document parse/validation problems
in the body as a GraphQL `errors` array with status 200 (only request-level problems, e.g. bad
JSON bodies, get 4xx).

**Rule:** when swapping GraphQL HTTP servers, probe the real status-code behaviour and assert on
reality; do not carry over status assertions from the previous server.

---

## A provider-level cache makes same-key tests order-dependent (2026-08-21)

After wiring the TTL cache into the shared schema instance, every error-path test reusing the
same author id as an earlier happy-path test silently received the cached success and failed.

**Rule:** when results are cached by key, give each test scenario its own key (or inject a fresh
cache/schema per test) so suites stay independent of execution order.

---

## GitHub Dependabot counts lag the push (2026-08-21)

After pushing a fixed lockfile, the push message and the Dependabot page can briefly show stale
counts (observed: 35 → 2 → 0 over a few minutes) because scans are asynchronous.

**Rule:** treat `npm audit` locally and the lockfile on the default branch as the source of
truth; give Dependabot a few minutes to re-scan before investigating alert counts or pushing
further changes.
