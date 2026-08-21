'use strict';

// Default time-to-live for cached entries: 1 hour.
const DEFAULT_TTL_MS = 60 * 60 * 1000;

// Minimal in-memory TTL cache built on a Map. Expired entries are evicted
// lazily on access; no timers, no dependencies.
class TTLCache {
  constructor({ ttlMs = DEFAULT_TTL_MS } = {}) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }
}

// Wraps an async function so results are served from a TTLCache, keyed by
// keyFn(...args). The resolved promise is cached, so concurrent callers
// share a single in-flight upstream request; failed calls are evicted so
// they can be retried.
function memoize(fn, keyFn, cache) {
  return (...args) => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const promise = Promise.resolve().then(() => fn(...args));
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
    return promise;
  };
}

module.exports = { TTLCache, memoize, DEFAULT_TTL_MS };
