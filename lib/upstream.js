'use strict';

// Default upstream request timeout, overridable via UPSTREAM_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS = 10000;

function currentTimeoutMs() {
  const value = Number(process.env.UPSTREAM_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

// Performs an upstream HTTP GET request with a hard timeout and returns the
// response body as text. Non-OK responses are rejected with a descriptive
// error carrying the HTTP status code; timeouts are rejected with a
// descriptive error as well.
async function fetchUpstream(url) {
  const timeoutMs = currentTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(
        `Upstream request failed with HTTP ${response.status}`
      );
      error.statusCode = response.status;
      throw error;
    }
    return await response.text();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`Upstream request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchUpstream, DEFAULT_TIMEOUT_MS };
