# GraphQL Goodreads

![Node](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![GraphQL](https://img.shields.io/badge/GraphQL-16-E10098?style=for-the-badge&logo=graphql&logoColor=white)
![Open Library](https://img.shields.io/badge/Open_Library_API-default-EF5C25?style=for-the-badge&logo=openlibrary&logoColor=white)

GraphQL Goodreads is a minimal **GraphQL API for authors and their books**. Instead of digging
through raw upstream payloads, clients query a small, typed GraphQL schema — `author(id)` returns
an author and their books with proper types and interactive documentation (GraphiQL).

Data comes from a **swappable provider layer**:

- **Open Library** (default) — live, JSON-based and **key-free**.
- **Goodreads** (legacy) — the original XML API. It is retired (no new developer keys since
  December 2020), so it is kept as an optional provider for existing keys.

The project is deliberately small: no database, no framework magic. Upstream responses are cached
in memory for one hour; everything else is fetched live. It works great as a study project for
GraphQL schemas, resolvers and integrating third-party APIs behind a clean interface.

**Project docs:** [AGENTS.md](AGENTS.md) (rules for solo/AI-assisted development) ·
[docs/lessons.md](docs/lessons.md) (engineering lessons) · [CHANGELOG.md](CHANGELOG.md).

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Commands](#commands)
- [Testing](#testing)
- [API & Documentation](#api--documentation)
- [Current State](#current-state)
- [Roadmap](#roadmap)

## Tech Stack

| Category | Technology |
| :--- | :--- |
| **Language & Runtime** | ![Node](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white) |
| **Web framework** | ![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white) |
| **GraphQL server** | ![GraphQL](https://img.shields.io/badge/GraphQL-16-E10098?style=for-the-badge&logo=graphql&logoColor=white) ![graphql-http](https://img.shields.io/badge/graphql--http-1.x-E10098?style=for-the-badge&logo=graphql&logoColor=white) |
| **HTTP client** | Native `fetch` (Node 18+, no dependency) |
| **XML parsing** | `xml2js` 0.6 (Goodreads provider only) |
| **Data sources** | [Open Library API](https://openlibrary.org/developers/api) (default, key-free) · [Goodreads XML API](https://www.goodreads.com/api) (legacy, key required) |
| **Dev tooling** | `nodemon` 2 |

- **GraphQL:** schema built with `graphql` 16 primitives (`GraphQLSchema`, `GraphQLObjectType`,
  `GraphQLList`) and served by [`graphql-http`](https://github.com/graphql/graphql-http) at
  `/graphql` (the successor of the deprecated `express-graphql`).
- **Interactive docs:** a self-contained GraphiQL page (assets from unpkg) is served on
  `GET /graphql` when the client accepts `text/html`.
- **Upstream resilience:** every upstream request runs under an `AbortController` timeout
  (10s default) and non-OK responses map to descriptive GraphQL errors.

## Architecture

The application stays flat and small — a thin HTTP layer, a schema factory and a swappable
provider layer:

```
graphql-goodreads/
├── server.js              HTTP entrypoint — Express + graphql-http at /graphql (GraphiQL on GET),
│                          listening on port 4000; fails fast on invalid configuration
├── schema.js              GraphQL schema factory — builds the typed schema (Author, Book) on top
│                          of the selected BookProvider
├── providers/             Swappable data sources behind author(id)
│   ├── index.js           BOOK_PROVIDER selection (+ per-provider TTL cache wiring)
│   ├── openlibrary.js     Default provider — Open Library JSON API, no key needed
│   └── goodreads.js       Legacy provider — Goodreads XML API, needs GOODREADS_API_KEY
├── lib/
│   ├── upstream.js        fetchUpstream(): native fetch + AbortController timeout + non-OK handling
│   └── cache.js           TTLCache (Map + timestamps, lazy eviction) and memoize() helper
├── test/                  node:test suites (offline, deterministic — fetch is always mocked)
└── fixtures/…             Canned Goodreads XML and Open Library JSON responses
```

**Provider contract:** every provider exposes `name`, `idType` (`int` or `string`) and
`getAuthor(id)`, returning a normalized shape:

```json
{ "id": "…", "name": "…", "books": [{ "title": "…", "isbn": "…" }] }
```

**Data flow:**

```
Browser / GraphiQL / curl
      │  GraphQL query  (POST /graphql)
      ▼
graphql-http  (server.js)
      │  resolver execution
      ▼
schema.js — Query.author(id)
      │
      ▼
providers/index.js — selected provider + 1h in-memory cache
      │  cache miss
      ▼
lib/upstream.js — fetchUpstream() with timeout
      │
      ├─▶ Open Library   (default): authors/{id}.json → works.json → editions.json
      └─▶ Goodreads      (legacy):  author/show.xml?id={id}&key={key} → xml2js
```

**Boundary rules:**

- `server.js` is pure glue: mount the schema handler, serve GraphiQL, listen on `4000`. It knows
  nothing about providers or upstream APIs.
- `schema.js` never talks to the network; it maps the normalized provider shape into GraphQL types.
- Providers own their id semantics, upstream URLs and payload parsing; failures surface as
  descriptive GraphQL errors.

## Requirements

- Node.js **20+** (CI runs the test matrix on Node 20, 22 and 24)
- npm (bundled with Node.js)
- **No API key needed** for the default Open Library provider. A Goodreads developer key is only
  required when explicitly switching to the legacy provider (see [Getting Started](#getting-started)).

## Getting Started

### 1. Clone and install

```sh
git clone https://github.com/daniel-castilho/graphql-goodreads.git
cd graphql-goodreads
npm install
```

### 2. Configure the environment (optional)

```sh
cp .env.example .env
```

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `BOOK_PROVIDER` | `openlibrary` | Data source: `openlibrary` or `goodreads`. |
| `GOODREADS_API_KEY` | — | Only required when `BOOK_PROVIDER=goodreads`. The server fails fast without it. |
| `UPSTREAM_TIMEOUT_MS` | `10000` | Timeout applied to every upstream request. |

> **Note on Goodreads:** Goodreads stopped issuing new developer keys in December 2020 and has
> retired the API, so even existing keys may be rejected (HTTP 401). The legacy provider surfaces
> this as a clean GraphQL error.

### 3. Run the server

```sh
npm start                                   # Open Library (default, no key)
BOOK_PROVIDER=goodreads GOODREADS_API_KEY=your_key npm start   # legacy Goodreads
```

You should see `Listening on http://localhost:4000/graphql (provider: …)` and the API will be
available at [http://localhost:4000/graphql](http://localhost:4000/graphql).

### 4. Try it

Open the GraphiQL interface and run:

```graphql
# Open Library (default): id is an Open Library author key
{
  author(id: "OL23919A") {
    name
    books {
      title
      isbn
    }
  }
}
```

Or from the terminal:

```sh
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ author(id: \"OL23919A\") { name books { title isbn } } }"}'
```

With the legacy Goodreads provider the same query uses a numeric id:

```graphql
{
  author(id: 1077326) {
    name
    books {
      title
      isbn
    }
  }
}
```

## Commands

| Purpose | Command |
| :--- | :--- |
| Install dependencies | `npm install` |
| Run the dev server on port 4000 | `npm start` |
| Run the test suite | `npm test` |
| Run tests in watch mode | `npm run test:watch` |
| Check dependency security | `npm audit` |

## Testing

Automated tests run with **Node's built-in test runner** (`node:test`) plus `supertest` for HTTP
integration. The global `fetch` is mocked with `t.mock.method`, so the suite is fast,
deterministic and works fully offline — **no network connection and no API key are required**.

Current total: **34 tests** across five suites.

| File | Scope |
| :--- | :--- |
| `test/goodreads.test.js` | Legacy provider through the GraphQL layer: XML parsing, happy path, invalid XML, HTTP errors, missing key, timeout and id validation (`BOOK_PROVIDER=goodreads`). |
| `test/openlibrary.test.js` | Default provider through the GraphQL layer: works → editions resolution, ISBN fallback rules, unknown author, empty book list, malformed JSON, network error, timeout and id validation. |
| `test/providers.test.js` | `BOOK_PROVIDER` selection logic: defaults, case-insensitivity and unknown values. |
| `test/cache.test.js` | TTL cache units (hit, miss, expiry, failure eviction) and cached provider lookups. |
| `test/server.test.js` | HTTP integration with `supertest`: GraphiQL page, end-to-end query, upstream failure mapping and malformed-query behaviour. |
| `test/fixtures/` | Canned Goodreads XML and Open Library JSON responses shared by the suites. |

```sh
npm test            # run the full suite once
npm run test:watch  # re-run on file changes
```

## API & Documentation

### Interactive documentation (GraphiQL)

With the server running, open:

- **URL:** [http://localhost:4000/graphql](http://localhost:4000/graphql)

Every query, argument and type can be explored and executed directly in the browser.

### Schema summary

| Type | Field | Type | Description |
| :--- | :--- | :--- | :--- |
| **Query** | `author` | `Author` | Fetches an author and their books. |
| `Query.author` | `id` | `Int` *or* `String` | Provider-dependent: a positive integer (Goodreads) or an Open Library author key such as `OL23919A` (Open Library). |
| **Author** | `id` | `String` | The author identifier, as resolved by the provider. |
| | `name` | `String` | The author's name. |
| | `books` | `[Book!]!` | The list of books written by the author. |
| **Book** | `title` | `String` | The book title. |
| | `isbn` | `String` | The book ISBN (nullable — see provider semantics below). |

### `author(id)` semantics per provider

| | Open Library (default) | Goodreads (legacy) |
| :--- | :--- | :--- |
| **Accepted `id`** | Non-empty string — an Open Library author key, e.g. `"OL23919A"` | Positive integer — a Goodreads author id, e.g. `1077326` |
| **Where it comes from** | The `…/authors/{key}` URL on openlibrary.org (also shown in author page URLs) | The Goodreads author page URL |
| **How books are resolved** | `authors/{id}/works.json`; each work's first ISBN-13 across `works/{key}/editions.json` (ISBN-10 fallback) | Parsed from the single `author/show.xml` response |
| **Missing ISBN** | `isbn` is `null` (never fails the query) | `null` when absent in the XML |
| **Unknown id** | Descriptive GraphQL error (`not found on Open Library`) | Descriptive GraphQL error with the HTTP status |

Successful results are cached in memory for **1 hour**, keyed by provider and id.

### Example response

```json
{
  "data": {
    "author": {
      "id": "OL23919A",
      "name": "J. K. Rowling",
      "books": [
        { "title": "Harry Potter and the Philosopher's Stone", "isbn": "9780747532699" },
        { "title": "Fantastic Beasts and Where to Find Them", "isbn": null }
      ]
    }
  }
}
```

> Values above are illustrative — the real payload comes from the configured provider and depends
> on the author requested.

## Current State

- **Working query** — `author(id)` returns `{ id, name, books { title, isbn } }` from the selected
  provider.
- **Provider abstraction** — Open Library (JSON, key-free) is the default data source; the legacy
  Goodreads XML provider remains selectable via `BOOK_PROVIDER=goodreads`.
- **Maintained GraphQL stack** — `graphql` 16 served by `graphql-http`, with a self-contained
  GraphiQL page on `GET /graphql`.
- **Input validation** — ids are validated per provider (positive integer vs non-empty author key)
  with descriptive GraphQL errors.
- **Upstream resilience** — 10s `AbortController` timeout (tunable via `UPSTREAM_TIMEOUT_MS`),
  non-OK statuses, timeouts, unknown authors and malformed payloads all map to clean GraphQL
  errors.
- **In-memory caching** — successful author lookups are cached for one hour (lazy eviction,
  concurrent lookups share the in-flight request).
- **Automated tests** — 34 offline tests across five suites using `node:test` built-in mocks
  (`t.mock.method`) and `supertest`; CI runs them on Node 20/22/24.
- **Secrets hygiene** — `GOODREADS_API_KEY` is read from the environment (never hardcoded) and is
  only required for the legacy provider; `.env` is gitignored and `.env.example` documents the
  expected shape.
- **Dependency hygiene** — `npm audit --audit-level=high` reports **0 vulnerabilities** (CI gate).

## Roadmap

Deliberately not implemented yet (candidate backlog):

- Pagination controls for large authors (currently all works are resolved in one query)
- More queries: book by key/id, author search (Open Library `search/authors.json`), covers
- Dockerfile (CI pipeline already in place via GitHub Actions)
- TypeScript migration
