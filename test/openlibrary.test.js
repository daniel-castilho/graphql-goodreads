'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { graphql } = require('graphql');
const { buildSchema } = require('../schema');
const { selectProvider } = require('../providers');

// Default provider; pinned explicitly for clarity.
process.env.BOOK_PROVIDER = 'openlibrary';

// A fresh schema (and therefore a fresh provider + TTL cache) per test keeps
// scenarios independent: the same author id can be reused across tests.
const freshSchema = () => buildSchema(selectProvider());

const FIXTURES = path.join(__dirname, 'fixtures', 'openlibrary');
const readFixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const AUTHOR_JSON = readFixture('author-OL23919A.json');
const WORKS_JSON = readFixture('works-OL23919A.json');
const EDITIONS_HP_JSON = readFixture('editions-OL52424W.json');
const EDITIONS_FB_JSON = readFixture('editions-OL52425W.json');
const EDITIONS_NO_ISBN_JSON = readFixture('editions-no-isbn.json');

const AUTHOR_QUERY = `{
  author(id: "OL23919A") {
    id
    name
    books {
      title
      isbn
    }
  }
}`;

const okResponse = (text) => ({ ok: true, status: 200, text: async () => text });

// Installs a fetch mock that routes Open Library URLs to fixtures and
// records every requested URL.
function mockOpenLibrary(t) {
  const urls = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url);
    urls.push(u);
    if (u.endsWith('/authors/OL23919A.json')) return okResponse(AUTHOR_JSON);
    if (u.endsWith('/authors/OL23919A/works.json')) return okResponse(WORKS_JSON);
    if (u.endsWith('/works/OL52424W/editions.json')) return okResponse(EDITIONS_HP_JSON);
    if (u.endsWith('/works/OL52425W/editions.json')) return okResponse(EDITIONS_FB_JSON);
    throw new Error(`unexpected upstream URL: ${u}`);
  });
  return { fetchMock, urls };
}

test('resolves an author and their works from the Open Library API', async (t) => {
  const schema = freshSchema();
  const { urls } = mockOpenLibrary(t);

  const result = await graphql({ schema, source: AUTHOR_QUERY });

  assert.equal(result.errors, undefined, 'expected no GraphQL errors');
  assert.equal(result.data.author.id, 'OL23919A');
  assert.equal(result.data.author.name, 'J. K. Rowling');
  assert.equal(result.data.author.books.length, 2);
  // First ISBN-13 across the work's editions wins.
  assert.equal(result.data.author.books[0].title, "Harry Potter and the Philosopher's Stone");
  assert.equal(result.data.author.books[0].isbn, '9780747532699');
  // No ISBN-13 anywhere: falls back to the first ISBN-10.
  assert.equal(result.data.author.books[1].title, 'Fantastic Beasts and Where to Find Them');
  assert.equal(result.data.author.books[1].isbn, '0807281956');

  assert.ok(urls.includes('https://openlibrary.org/authors/OL23919A.json'));
  assert.ok(urls.includes('https://openlibrary.org/authors/OL23919A/works.json'));
  assert.ok(urls.includes('https://openlibrary.org/works/OL52424W/editions.json'));
  assert.ok(urls.includes('https://openlibrary.org/works/OL52425W/editions.json'));
});

test('reports a descriptive error for an unknown author', async (t) => {
  const schema = freshSchema();
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/authors/OL0000000X.json')) {
      return { ok: false, status: 404, text: async () => 'not found' };
    }
    throw new Error(`unexpected upstream URL: ${url}`);
  });
  const result = await graphql({
    schema,
    source: '{ author(id: "OL0000000X") { name } }',
  });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /not found on Open Library/);
  assert.equal(result.data.author, null);
});

test('returns an empty book list for an author without works', async (t) => {
  const schema = freshSchema();
  t.mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url);
    if (u.endsWith('/authors/OL1111111A.json')) return okResponse(AUTHOR_JSON);
    if (u.endsWith('/authors/OL1111111A/works.json')) return okResponse('{}');
    throw new Error(`unexpected upstream URL: ${u}`);
  });
  const result = await graphql({
    schema,
    source: '{ author(id: "OL1111111A") { name books { title isbn } } }',
  });

  assert.equal(result.errors, undefined);
  assert.deepEqual(result.data.author.books, []);
});

test('omits the isbn when a work has no editions with ISBNs', async (t) => {
  const schema = freshSchema();
  t.mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url);
    if (u.endsWith('/authors/OL2222222A.json')) return okResponse(AUTHOR_JSON);
    if (u.endsWith('/authors/OL2222222A/works.json')) {
      return okResponse(
        JSON.stringify({ size: 1, entries: [{ key: '/works/OL52425W', title: 'Some Work' }] })
      );
    }
    if (u.endsWith('/works/OL52425W/editions.json')) return okResponse(EDITIONS_NO_ISBN_JSON);
    throw new Error(`unexpected upstream URL: ${u}`);
  });
  const result = await graphql({
    schema,
    source: '{ author(id: "OL2222222A") { name books { title isbn } } }',
  });

  assert.equal(result.errors, undefined);
  assert.equal(result.data.author.books.length, 1);
  assert.equal(result.data.author.books[0].isbn, null);
});

test('reports a GraphQL error when the upstream body is not valid JSON', async (t) => {
  const schema = freshSchema();
  t.mock.method(globalThis, 'fetch', async () => okResponse('<html>boom</html>'));
  const result = await graphql({
    schema,
    source: '{ author(id: "OL23919A") { name } }',
  });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /malformed JSON/);
  assert.equal(result.data.author, null);
});

test('reports a GraphQL error when the upstream request fails', async (t) => {
  const schema = freshSchema();
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network down');
  });
  const result = await graphql({
    schema,
    source: '{ author(id: "OL23919A") { name } }',
  });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /network down/);
  assert.equal(result.data.author, null);
});

test('maps an upstream timeout to a descriptive GraphQL error', async (t) => {
  const schema = freshSchema();
  const previousTimeout = process.env.UPSTREAM_TIMEOUT_MS;
  process.env.UPSTREAM_TIMEOUT_MS = '50';
  // Simulate a real fetch that hangs until the abort signal fires.
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(init && init.signal instanceof AbortSignal, 'expected an abort signal');
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () =>
        reject(new DOMException('This operation was aborted', 'AbortError'))
      );
    });
  });
  try {
    const result = await graphql({
      schema,
      source: '{ author(id: "OL23919A") { name } }',
    });

    assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
    assert.match(result.errors[0].message, /timed out after 50ms/);
    assert.equal(result.data.author, null);
  } finally {
    if (previousTimeout === undefined) delete process.env.UPSTREAM_TIMEOUT_MS;
    else process.env.UPSTREAM_TIMEOUT_MS = previousTimeout;
  }
});

test('rejects a missing author id with a descriptive error', async (t) => {
  const schema = freshSchema();
  mockOpenLibrary(t);
  const result = await graphql({ schema, source: '{ author { name } }' });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /non-empty Open Library author key/);
  assert.equal(result.data.author, null);
});

test('rejects an empty author id with a descriptive error', async (t) => {
  const schema = freshSchema();
  mockOpenLibrary(t);
  const result = await graphql({ schema, source: '{ author(id: "") { name } }' });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /non-empty Open Library author key/);
  assert.equal(result.data.author, null);
});
