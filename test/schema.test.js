'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { graphql } = require('graphql');
const schema = require('../schema');

// Most tests need a key present; the "missing key" test deletes it locally.
process.env.GOODREADS_API_KEY = process.env.GOODREADS_API_KEY || 'test-key';

const XML_FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'goodreads-response.xml'),
  'utf8',
);

const AUTHOR_QUERY = `{
  author(id: 1077326) {
    name
    books {
      title
      isbn
    }
  }
}`;

const okResponse = (text) => ({ ok: true, status: 200, text: async () => text });

test('resolves an author and their books from the Goodreads XML API', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    return okResponse(XML_FIXTURE);
  });

  const result = await graphql({ schema, source: AUTHOR_QUERY });

  assert.equal(result.errors, undefined, 'expected no GraphQL errors');
  assert.equal(result.data.author.name, 'J.K. Rowling');
  assert.equal(result.data.author.books.length, 3);
  assert.equal(result.data.author.books[0].title, "Harry Potter and the Sorcerer's Stone");
  assert.equal(result.data.author.books[0].isbn, '9780439708180');

  assert.equal(calls.length, 1);
  assert.match(calls[0], /author\/show\.xml\?id=1077326/);
  assert.match(calls[0], /key=test-key/);
});

test('reports a GraphQL error when the upstream body is not valid XML', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse('Invalid API key'));
  const result = await graphql({ schema, source: AUTHOR_QUERY });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.equal(result.data.author, null);
});

test('reports a GraphQL error when the upstream request fails', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network down');
  });
  const result = await graphql({ schema, source: AUTHOR_QUERY });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /network down/);
  assert.equal(result.data.author, null);
});

test('reports a GraphQL error when the upstream responds with an error status', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401, text: async () => 'Invalid API key' }));
  const result = await graphql({ schema, source: AUTHOR_QUERY });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(JSON.stringify(result.errors), /HTTP 401/);
  assert.equal(result.data.author, null);
});

test('fails with a descriptive error when GOODREADS_API_KEY is not set', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse(XML_FIXTURE));
  const previous = process.env.GOODREADS_API_KEY;
  delete process.env.GOODREADS_API_KEY;
  try {
    const result = await graphql({ schema, source: AUTHOR_QUERY });
    assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
    assert.match(JSON.stringify(result.errors), /GOODREADS_API_KEY/);
    assert.equal(result.data.author, null);
  } finally {
    if (previous !== undefined) process.env.GOODREADS_API_KEY = previous;
  }
});

test('rejects a query that uses the wrong argument type', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse(XML_FIXTURE));
  const result = await graphql({
    schema,
    source: '{ author(id: "not-a-number") { name } }',
  });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
});

test('rejects a missing author id with a descriptive error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse(XML_FIXTURE));
  const result = await graphql({ schema, source: '{ author { name } }' });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /positive integer/);
  assert.equal(result.data.author, null);
});

test('rejects a zero author id with a descriptive error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse(XML_FIXTURE));
  const result = await graphql({ schema, source: '{ author(id: 0) { name } }' });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /positive integer/);
  assert.equal(result.data.author, null);
});

test('rejects a negative author id with a descriptive error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse(XML_FIXTURE));
  const result = await graphql({ schema, source: '{ author(id: -1) { name } }' });

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /positive integer/);
  assert.equal(result.data.author, null);
});

test('maps an upstream timeout to a descriptive GraphQL error', async (t) => {
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
    const result = await graphql({ schema, source: AUTHOR_QUERY });

    assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
    assert.match(result.errors[0].message, /timed out after 50ms/);
    assert.equal(result.data.author, null);
  } finally {
    if (previousTimeout === undefined) delete process.env.UPSTREAM_TIMEOUT_MS;
    else process.env.UPSTREAM_TIMEOUT_MS = previousTimeout;
  }
});
