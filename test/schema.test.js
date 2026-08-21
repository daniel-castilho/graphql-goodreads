'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const proxyquire = require('proxyquire');
const { graphql } = require('graphql');

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

function loadSchema(fetchImpl) {
  return proxyquire('../schema', { 'node-fetch': fetchImpl });
}

test('resolves an author and their books from the Goodreads XML API', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return { ok: true, text: async () => XML_FIXTURE };
  };

  const result = await graphql(loadSchema(fetchImpl), AUTHOR_QUERY);

  assert.equal(result.errors, undefined, 'expected no GraphQL errors');
  assert.equal(result.data.author.name, 'J.K. Rowling');
  assert.equal(result.data.author.books.length, 3);
  assert.equal(result.data.author.books[0].title, "Harry Potter and the Sorcerer's Stone");
  assert.equal(result.data.author.books[0].isbn, '9780439708180');

  assert.equal(calls.length, 1);
  assert.match(calls[0], /author\/show\.xml\?id=1077326/);
  assert.match(calls[0], /key=/);
});

test('reports a GraphQL error when the upstream body is not valid XML', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => 'Invalid API key' });
  const result = await graphql(loadSchema(fetchImpl), AUTHOR_QUERY);

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.equal(result.data.author, null);
});

test('reports a GraphQL error when the upstream request fails', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };
  const result = await graphql(loadSchema(fetchImpl), AUTHOR_QUERY);

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.match(result.errors[0].message, /network down/);
  assert.equal(result.data.author, null);
});

test('rejects a query that uses the wrong argument type', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => XML_FIXTURE });
  const result = await graphql(
    loadSchema(fetchImpl),
    '{ author(id: "not-a-number") { name } }',
  );

  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
});
