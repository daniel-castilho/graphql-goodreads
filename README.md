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

> **Important:** `schema.js` ships with a hardcoded Goodreads API key that the API no longer
> accepts — requests currently fail with `HTTP 401 Invalid API key`. Replace it with your own
> developer key before expecting real data.

Open `schema.js` and swap the `key` parameter in the `author` resolver:

```js
resolve: (root, args) => fetch(
    `https://www.goodreads.com/author/show.xml?id=${args.id}&key=YOUR_GOODREADS_KEY`
)
```

Get a key on the [Goodreads API keys page](https://www.goodreads.com/api/keys) (free account
required). A cleaner long-term approach — reading the key from an environment variable — is
tracked in the [Roadmap](#roadmap).

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
| Run the test suite | `npm test` *(placeholder — no tests yet, see [Testing](#testing))* |
| Check dependency security | `npm audit` |

## Testing

There are **no automated tests yet** — `npm test` is still the placeholder generated by
`npm init` (`Error: no test specified`). The project is currently verified manually:

1. Start the server with `npm start`.
2. Open [http://localhost:4000/graphql](http://localhost:4000/graphql) and run the sample query
   above (requires a valid API key).
3. Confirm the GraphQL response shape matches the schema.

Adding resolver unit tests (with mocked XML fixtures) and integration tests (`supertest` against
the running app) is a planned improvement — see [Roadmap](#roadmap).

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
- **Dependency hygiene** — the dependency tree is patched and up to date: `npm audit` reports
  **0 vulnerabilities** (including the fixes for GHSA-3jxr-9vmj-r5cp / CVE-2026-13149 and the
  other `brace-expansion`, `minimatch`, `semver`, `express`, `xml2js` advisories).
- **Known limitation** — the API key hardcoded in `schema.js` is no longer valid (HTTP 401), so
  the project requires a personal key to return live data.

## Roadmap

Deliberately not implemented yet (candidate backlog):

- Read `GOODREADS_API_KEY` from the environment instead of a hardcoded constant, and fail fast
  with a clear message when it is missing
- Graceful upstream failure handling: timeouts, non-200 responses and malformed XML mapped to
  structured GraphQL errors instead of breaking the response
- Replace `express-graphql` (deprecated/unmaintained) with `graphql-http` or another maintained
  GraphQL server
- Automated tests: resolver unit tests with mocked XML fixtures + integration tests via
  `supertest`
- More queries: book by ID, author search, reviews and shelves
- Optional in-memory TTL cache, since the legacy Goodreads XML API is slow
- Dockerfile and a CI pipeline
- TypeScript migration
