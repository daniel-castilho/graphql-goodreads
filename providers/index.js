'use strict';

// Provider layer: swappable data sources behind the author(id) query.
//
// A BookProvider supplies author data to the GraphQL layer:
//   name    - provider identifier used for cache keys and diagnostics
//   idType  - 'int' | 'string', the GraphQL scalar accepted by author(id)
//   getAuthor(id) - resolves a normalized shape:
//     { id: string, name: string, books: [{ title: string|null, isbn: string|null }] }
//
// Implementations validate their own id semantics and translate upstream
// failures (HTTP errors, timeouts, malformed payloads) into descriptive
// Error objects.

const GoodreadsProvider = require('./goodreads');
const OpenLibraryProvider = require('./openlibrary');
const { TTLCache, memoize } = require('../lib/cache');

const PROVIDER_CLASSES = {
  openlibrary: OpenLibraryProvider,
  goodreads: GoodreadsProvider,
};

// Resolves the BOOK_PROVIDER environment variable ("openlibrary" |
// "goodreads") to a provider instance. Defaults to "openlibrary", which
// needs no API key. Throws a descriptive error for unknown values.
//
// The returned provider caches getAuthor results in memory for one hour,
// keyed by provider name and author id.
function selectProvider(source = process.env.BOOK_PROVIDER) {
  const provider = new (providerClassFor(source))();
  const cache = new TTLCache();
  const getAuthor = provider.getAuthor.bind(provider);
  provider.getAuthor = memoize(
    getAuthor,
    (id) => `${provider.name}:author:${id}`,
    cache
  );
  return provider;
}

// Normalized name of the configured provider without constructing it.
function selectedProviderName(source = process.env.BOOK_PROVIDER) {
  const raw = typeof source === 'string' ? source.trim().toLowerCase() : '';
  const name = raw === '' ? 'openlibrary' : raw;
  if (!PROVIDER_CLASSES[name]) {
    throw new Error(
      `Unknown BOOK_PROVIDER ${JSON.stringify(source ?? null)}. Supported values: ${Object.keys(PROVIDER_CLASSES).join(', ')}`
    );
  }
  return name;
}

function providerClassFor(source) {
  const raw = typeof source === 'string' ? source.trim().toLowerCase() : '';
  const name = raw === '' ? 'openlibrary' : raw;
  const ProviderClass = PROVIDER_CLASSES[name];
  if (!ProviderClass) {
    throw new Error(
      `Unknown BOOK_PROVIDER ${JSON.stringify(source ?? null)}. Supported values: ${Object.keys(PROVIDER_CLASSES).join(', ')}`
    );
  }
  return ProviderClass;
}

module.exports = {
  selectProvider,
  selectedProviderName,
  GoodreadsProvider,
  OpenLibraryProvider,
};
