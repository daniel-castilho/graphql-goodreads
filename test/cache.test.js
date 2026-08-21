'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TTLCache, memoize } = require('../lib/cache');
const { selectProvider } = require('../providers');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('TTLCache returns undefined on a miss', () => {
  const cache = new TTLCache();
  assert.equal(cache.get('missing'), undefined);
  assert.equal(cache.size, 0);
});

test('TTLCache serves a stored value on a hit', () => {
  const cache = new TTLCache();
  cache.set('key', { name: 'J. K. Rowling' });
  assert.deepEqual({ ...cache.get('key') }, { name: 'J. K. Rowling' });
  assert.equal(cache.size, 1);
});

test('TTLCache expires entries after the TTL and evicts lazily', async () => {
  const cache = new TTLCache({ ttlMs: 20 });
  cache.set('key', 'value');
  assert.equal(cache.get('key'), 'value');

  await sleep(40);

  assert.equal(cache.get('key'), undefined, 'entry should be expired');
  assert.equal(cache.size, 0, 'expired entry should be evicted on access');
});

test('memoize serves repeated calls from the cache', async () => {
  let calls = 0;
  const fn = async (id) => {
    calls += 1;
    return { id, name: `author-${id}` };
  };
  const cached = memoize(fn, (id) => `p:author:${id}`, new TTLCache());

  const [first, second] = await Promise.all([cached(1), cached(1)]);

  assert.equal(calls, 1, 'upstream function should run once');
  assert.equal(first.name, 'author-1');
  assert.equal(second.name, 'author-1');
});

test('memoize treats different keys independently', async () => {
  let calls = 0;
  const fn = async (id) => {
    calls += 1;
    return { id };
  };
  const cached = memoize(fn, (id) => `p:author:${id}`, new TTLCache());

  await Promise.all([cached(1), cached(2)]);

  assert.equal(calls, 2);
});

test('memoize evicts failed calls so they can be retried', async () => {
  let calls = 0;
  const fn = async () => {
    calls += 1;
    if (calls === 1) throw new Error('network down');
    return 'recovered';
  };
  const cached = memoize(fn, () => 'key', new TTLCache());

  await assert.rejects(cached(), /network down/);
  const second = await cached();

  assert.equal(calls, 2, 'failed call should not stay cached');
  assert.equal(second, 'recovered');
});

test('selectProvider caches author lookups across calls', async (t) => {
  process.env.BOOK_PROVIDER = 'openlibrary';
  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    fetchCalls += 1;
    const u = String(url);
    if (u.endsWith('/authors/OL23919A.json')) {
      return { ok: true, status: 200, text: async () => '{"name":"J. K. Rowling"}' };
    }
    if (u.endsWith('/authors/OL23919A/works.json')) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ size: 1, entries: [{ key: '/works/OL52424W', title: 'Some Work' }] }),
      };
    }
    if (u.endsWith('/works/OL52424W/editions.json')) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ size: 1, entries: [{ isbn_13: ['9780747532699'] }] }),
      };
    }
    throw new Error(`unexpected upstream URL: ${u}`);
  });

  const provider = selectProvider();
  const first = await provider.getAuthor('OL23919A');
  const callsAfterFirst = fetchCalls;
  const second = await provider.getAuthor('OL23919A');

  assert.equal(second.name, first.name);
  assert.deepEqual(second.books, first.books.map((b) => ({ ...b })));
  assert.equal(fetchCalls, callsAfterFirst, 'second lookup should be served from cache');
  assert.ok(fetchCalls > 0);
});
