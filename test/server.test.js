'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const proxyquire = require('proxyquire');
const request = require('supertest');

const XML_FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'goodreads-response.xml'),
  'utf8',
);

function buildApp(fetchImpl) {
  const schema = proxyquire('../schema', { 'node-fetch': fetchImpl });
  return proxyquire('../server', { './schema': schema });
}

const okFetch = async () => ({ ok: true, text: async () => XML_FIXTURE });

test('GET /graphql serves the GraphiQL interface', async () => {
  const res = await request(buildApp(okFetch))
    .get('/graphql')
    .set('Accept', 'text/html')
    .expect(200);

  assert.match(res.text, /graphiql/i);
});

test('POST /graphql resolves the author query end to end', async () => {
  const res = await request(buildApp(okFetch))
    .post('/graphql')
    .send({ query: '{ author(id: 1077326) { name books { title } } }' })
    .expect(200);

  assert.equal(res.body.data.author.name, 'J.K. Rowling');
  assert.equal(res.body.data.author.books.length, 3);
  assert.equal(res.body.data.author.books[0].title, "Harry Potter and the Sorcerer's Stone");
});

test('POST /graphql maps an upstream failure to a GraphQL error response', async () => {
  const failingFetch = async () => ({ ok: true, text: async () => 'Invalid API key' });
  const res = await request(buildApp(failingFetch))
    .post('/graphql')
    .send({ query: '{ author(id: 1077326) { name } }' })
    .expect(200);

  assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  assert.equal(res.body.data.author, null);
});

test('POST /graphql returns 400 for a malformed query', async () => {
  const res = await request(buildApp(okFetch))
    .post('/graphql')
    .send({ query: '{ author(id: 1077326) { ' })
    .expect(400);

  assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
});
