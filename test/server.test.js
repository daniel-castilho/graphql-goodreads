'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const app = require('../server');

process.env.GOODREADS_API_KEY = process.env.GOODREADS_API_KEY || 'test-key';

const XML_FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'goodreads-response.xml'),
  'utf8',
);

const okResponse = (text) => ({ ok: true, status: 200, text: async () => text });

test('GET /graphql serves the GraphiQL interface', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse(XML_FIXTURE));
  const res = await request(app)
    .get('/graphql')
    .set('Accept', 'text/html')
    .expect(200);

  assert.match(res.text, /graphiql/i);
});

test('POST /graphql resolves the author query end to end', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse(XML_FIXTURE));
  const res = await request(app)
    .post('/graphql')
    .send({ query: '{ author(id: 1077326) { name books { title } } }' })
    .expect(200);

  assert.equal(res.body.data.author.name, 'J.K. Rowling');
  assert.equal(res.body.data.author.books.length, 3);
  assert.equal(res.body.data.author.books[0].title, "Harry Potter and the Sorcerer's Stone");
});

test('POST /graphql maps an upstream failure to a GraphQL error response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse('Invalid API key'));
  const res = await request(app)
    .post('/graphql')
    .send({ query: '{ author(id: 1077326) { name } }' })
    .expect(200);

  assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  assert.equal(res.body.data.author, null);
});

// graphql-http follows the GraphQL over HTTP spec: a document that fails to
// parse is reported in the response body as a GraphQL error with status 200
// (express-graphql used to answer 400 here).
test('POST /graphql reports a malformed query as a GraphQL error response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => okResponse(XML_FIXTURE));
  const res = await request(app)
    .post('/graphql')
    .send({ query: '{ author(id: 1077326) { ' })
    .expect(200);

  assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  assert.match(res.body.errors[0].message, /Syntax Error/);
});
