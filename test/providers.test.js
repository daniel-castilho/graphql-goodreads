'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectProvider,
  selectedProviderName,
  GoodreadsProvider,
  OpenLibraryProvider,
} = require('../providers');

test('defaults to the Open Library provider when BOOK_PROVIDER is unset', () => {
  const previous = process.env.BOOK_PROVIDER;
  delete process.env.BOOK_PROVIDER;
  try {
    const provider = selectProvider();
    assert.ok(provider instanceof OpenLibraryProvider);
    assert.equal(provider.name, 'openlibrary');
    assert.equal(provider.idType, 'string');
    assert.equal(selectedProviderName(), 'openlibrary');
  } finally {
    if (previous !== undefined) process.env.BOOK_PROVIDER = previous;
  }
});

test('selects the Goodreads provider when BOOK_PROVIDER=goodreads', () => {
  const previous = process.env.BOOK_PROVIDER;
  process.env.BOOK_PROVIDER = 'goodreads';
  try {
    const provider = selectProvider();
    assert.ok(provider instanceof GoodreadsProvider);
    assert.equal(provider.name, 'goodreads');
    assert.equal(provider.idType, 'int');
    assert.equal(selectedProviderName(), 'goodreads');
  } finally {
    if (previous !== undefined) process.env.BOOK_PROVIDER = previous;
  }
});

test('provider selection is case-insensitive and tolerates whitespace', () => {
  assert.equal(selectedProviderName(' OpenLibrary '), 'openlibrary');
  assert.equal(selectedProviderName('GOODREADS'), 'goodreads');
});

test('rejects an unknown BOOK_PROVIDER with a descriptive error', () => {
  assert.throws(() => selectProvider('bogus'), /Unknown BOOK_PROVIDER "bogus"/);
  assert.throws(() => selectedProviderName('bogus'), /openlibrary, goodreads/);
});
