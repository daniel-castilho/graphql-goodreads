# GraphQL Goodreads

![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![GraphQL](https://img.shields.io/badge/GraphQL-15-E10098?style=for-the-badge&logo=graphql&logoColor=white)
![Goodreads](https://img.shields.io/badge/Goodreads_API-372213?style=for-the-badge&logo=goodreads&logoColor=white)

GraphQL Goodreads is a minimal **GraphQL wrapper around the Goodreads XML API**. Instead of
downloading raw XML and digging through `GoodreadsResponse` documents, clients query a small,
typed GraphQL schema — `author(id)` returns an author and their books with proper types,
descriptions and interactive documentation (GraphiQL).

The project is deliberately small: two files, no database, no caching. Every query hits the
upstream Goodreads XML API live and maps the response into GraphQL types. It works great as a
study project for GraphQL schemas, resolvers and integrating a legacy XML API behind a modern
interface.

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
| **Language & Runtime** | ![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white) |
| **Web framework** | ![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white) |
| **GraphQL server** | ![GraphQL](https://img.shields.io/badge/GraphQL-15-E10098?style=for-the-badge&logo=graphql&logoColor=white) ![express-graphql](https://img.shields.io/badge/express--graphql-0.11-E10098?style=for-the-badge&logo=graphql&logoColor=white) |
| **HTTP client** | `node-fetch` 2 |
| **XML parsing** | `xml2js` 0.6 |
| **Data source** | [Goodreads XML API](https://www.goodreads.com/api) (`author/show.xml`) |
| **Dev tooling** | `nodemon` 2 |

- **GraphQL:** schema built with `graphql` 15 primitives (`GraphQLSchema`, `GraphQLObjectType`,
  `GraphQLList`) and served by `express-graphql` 0.11 at `POST /graphql`.
- **Upstream:** the `author` resolver fetches `https://www.goodreads.com/author/show.xml?id={id}&key={key}`
  with `node-fetch`, reads the body as text and parses it with `xml2js.parseString` (promisified).
- **Interactive docs:** GraphiQL is enabled, so the endpoint doubles as living documentation.

## Architecture

The application is intentionally flat — two files with clear responsibilities and a single
integration boundary:

```
graphql-goodreads/
├── server.js     HTTP entrypoint — Express app + express-graphql; exposes /graphql with GraphiQL,
│                 listening on port 4000
└── schema.js     GraphQL schema and resolvers — defines the types (Author, Book) and the only
│                 place that talks to the Goodreads XML API and parses XML
├── package.json
└── package-lock.json
```

**Data flow:**

```
Browser / GraphiQL
      │  GraphQL query  (POST /graphql)
      ▼
express-graphql  (server.js)
      │  resolver execution
      ▼
schema.js — Query.author(id) resolver
      │  node-fetch  GET https://www.goodreads.com/author/show.xml?id={id}&key={key}
      ▼
Goodreads XML API
      │  XML document
      ▼
xml2js.parseString  →  typed GraphQL response
```

**Boundary rules:**

- `server.js` is pure glue: mount the schema, enable GraphiQL, listen on `4000`. It knows nothing
  about the network or XML.
- `schema.js` is the only module that touches the outside world. Its resolvers fetch the XML
  document, parse it, and expose a typed shape (`Author.name`, `Author.books[].title|isbn`).
- There is **no database and no caching** — every request calls the upstream XML API live.

## Requirements

- Node.js 18+ (developed and tested on Node 20 and 24)
- npm (bundled with Node.js)
- A valid Goodreads API developer key to fetch real data (see
  [Getting Started](#getting-started))

## Getting Started

### 1. Clone and install

```sh
git clone https://github.com/daniel-castilho/graphql-goodreads.git
cd graphql-goodreads
npm install
```

### 2. Provide a valid Goodreads API key

> **Important:** Goodreads stopped issuing new developer keys in December 2020 and is retiring
> the API, so existing keys may stop working at any time. The project fails fast at startup if
> the key is missing, and reports a clean GraphQL error if the upstream rejects it.

```sh
cp .env.example .env
# edit .env and set:
GOODREADS_API_KEY=your_key
```

Then start the server with the key in the environment:

```sh
export $(grep -v '^#' .env | xargs)   # loads .env into the shell (optional)
npm start
```

Alternatively, pass it inline:

```sh
GOODREADS_API_KEY=your_key npm start
```

**A cleaner long-term approach** — replacing the retired Goodreads API with a live, key-free
data source (e.g. Open Library) — is tracked in the [Roadmap](#roadmap).

### 3. Run the server

```sh
npm start
```

You should see `Listening...` and the API will be available at
[http://localhost:4000/graphql](http://localhost:4000/graphql).

### 4. Try it

Open the GraphiQL interface and run:

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

Or from the terminal:

```sh
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ author(id: 1077326) { name books { title } } }"}'
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

Automated tests are included and run with **Node's built-in test runner** (`node:test`) — no
extra test framework needed. The Goodreads API is **mocked**, so the suite is fast,
deterministic and works offline.

| File | Scope |
| :--- | :--- |
| `test/schema.test.js` | Unit tests for the GraphQL schema and resolvers: XML parsing, the `author(id)` query shape and error handling (invalid XML, network failure, wrong argument type). |
| `test/server.test.js` | HTTP integration tests with `supertest`: GraphiQL is served, `POST /graphql` resolves end-to-end, upstream failures map to GraphQL errors, malformed queries return 400. |
| `test/fixtures/goodreads-response.xml` | Canned Goodreads XML response shared by both suites. |

```sh
npm test            # run the full suite once
npm run test:watch  # re-run on file changes
```

The upstream `node-fetch` call is stubbed with `proxyquire` (dev dependency), so **no network
connection and no API key are required to run the tests**.

## API & Documentation

### Interactive documentation (GraphiQL)

With the server running, open:

- **URL:** [http://localhost:4000/graphql](http://localhost:4000/graphql)

Every query, argument and type can be explored and executed directly in the browser.

### Schema summary

| Type | Field | Type | Description |
| :--- | :--- | :--- | :--- |
| **Query** | `author` | `Author` | Fetches an author and their books by Goodreads ID. |
| `Query.author` | `id` | `Int` | The Goodreads author ID (e.g. `1077326`). |
| **Author** | `name` | `String` | The author's name. |
| | `books` | `[Book!]!` | The list of books written by the author. |
| **Book** | `title` | `String` | The book title. |
| | `isbn` | `String` | The book ISBN. |

### Example response

With a valid API key, the shape returned by the `author` query is:

```json
{
  "data": {
    "author": {
      "name": "J.K. Rowling",
      "books": [
        { "title": "Harry Potter and the Sorcerer's Stone", "isbn": "9780439708180" },
        { "title": "Harry Potter and the Chamber of Secrets", "isbn": "9780439064873" }
      ]
    }
  }
}
```

> Values above are illustrative — the real payload comes from the live Goodreads XML API and
> depends on the author requested.

## Current State

- **Working query** — `author(id)` returns the author's name plus a list of `{ title, isbn }`
  books, mapped from the Goodreads XML response.
- **GraphiQL enabled** — the endpoint doubles as interactive documentation.
- **Automated tests** — resolver unit tests (mocked upstream XML) and HTTP integration tests
  (`supertest`) via the built-in `node:test` runner; 10 tests, offline and deterministic, using
  `node:test` built-in mocks (`t.mock.method`) instead of a mocking library.
- **Secrets hygiene** — the Goodreads API key is read from the `GOODREADS_API_KEY` environment
  variable (never hardcoded); `server.js` fails fast at startup if it is missing, and upstream
  non-OK responses map to a descriptive GraphQL error. `.env` is gitignored; a tracked
  `.env.example` shows the expected shape.
- **Dependency hygiene** — the dependency tree is patched and up to date: `npm audit` reports
  **0 vulnerabilities** (including the fixes for GHSA-3jxr-9vmj-r5cp / CVE-2026-13149 and the
  other `brace-expansion`, `minimatch`, `semver`, `express`, `xml2js` advisories).
- **Known limitation** — the Goodreads API is retired (no new keys since Dec 2020), so even a
  valid key may be rejected (HTTP 401). The API surfaces this as a clean GraphQL error, and a
  live, key-free data source is planned in the [Roadmap](#roadmap).

## Roadmap

Deliberately not implemented yet (candidate backlog):

- Graceful upstream failure handling: timeouts (non-OK responses and malformed XML are already
  covered)
- Replace `express-graphql` (deprecated/unmaintained) with `graphql-http` or another maintained
  GraphQL server
- Replace the retired Goodreads API with a live, key-free data source (e.g. Open Library) behind
  a small provider abstraction, so the project returns real data again
- Expand test coverage — edge-case XML payloads (missing ISBN, author without books) and
  paginated/batched queries
- More queries: book by ID, author search, reviews and shelves
- Optional in-memory TTL cache, since the legacy Goodreads XML API is slow
- Dockerfile (CI pipeline already in place via GitHub Actions)
- TypeScript migration
