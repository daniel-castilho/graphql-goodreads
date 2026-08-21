'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const app = require('../server');

// The default provider is Open Library; no API key is required.
process.env.BOOK_PROVIDER = process.env.BOOK_PROVIDER || 'openlibrary';

const AUTHOR_JSON = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'openlibrary', 'author-OL23919A.json'),
  'utf8',
);
const WORKS_JSON = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'openlibrary', 'works-OL23919A.json'),
  'utf8',
);
const EDITIONS_HP_JSON = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'openlibrary', 'editions-OL52424W.json'),
  'utf8',
);
const EDITIONS_FB_JSON = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'openlibrary', 'editions-OL52425W.json'),
  'utf8',
);

const okResponse = (text) => ({ ok: true, status: 200, text: async () => text });

function mockOpenLibrary(t) {
  return t.mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url);
    if (u.endsWith('/authors/OL23919A.json')) return okResponse(AUTHOR_JSON);
    if (u.endsWith('/authors/OL23919A/works.json')) return okResponse(WORKS_JSON);
    if (u.endsWith('/works/OL52424W/editions.json')) return okResponse(EDITIONS_HP_JSON);
    if (u.endsWith('/works/OL52425W/editions.json')) return okResponse(EDITIONS_FB_JSON);
    throw new Error(`unexpected upstream URL: ${u}`);
  });
}

test('GET /graphql serves the GraphiQL interface', async (t) => {
  mockOpenLibrary(t);
  const res = await request(app)
    .get('/graphql')
    .set('Accept', 'text/html')
    .expect(200);

  assert.match(res.text, /graphiql/i);
});

test('POST /graphql resolves the author query end to end', async (t) => {
  mockOpenLibrary(t);
  const res = await request(app)
    .post('/graphql')
    .send({ query: '{ author(id: "OL23919A") { name books { title isbn } } }' })
    .expect(200);

  assert.equal(res.body.data.author.name, 'J. K. Rowling');
  assert.equal(res.body.data.author.books.length, 2);
  assert.equal(res.body.data.author.books[0].isbn, '9780747532699');
});

test('POST /graphql maps an upstream failure to a GraphQL error response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network down');
  });
  const res = await request(app)
    .post('/graphql')
    .send({ query: '{ author(id: "OL7777777X") { name } }' })
    .expect(200);

  assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  assert.equal(res.body.data.author, null);
});

// graphql-http follows the GraphQL over HTTP spec: a document that fails to
// parse is reported in the response body as a GraphQL error with status 200
// (express-graphql used to answer 400 here).
test('POST /graphql reports a malformed query as a GraphQL error response', async (t) => {
  mockOpenLibrary(t);
  const res = await request(app)
    .post('/graphql')
    .send({ query: '{ author(id: "OL23919A") { ' })
    .expect(200);

  assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  assert.match(res.body.errors[0].message, /Syntax Error/);
});
