'use strict';

const { fetchUpstream } = require('../lib/upstream');

const API_BASE = 'https://openlibrary.org';

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Open Library returned a malformed JSON response');
  }
}

// Default provider backed by the Open Library API (JSON, no key required).
//
// author(id) expects an Open Library author key such as "OL23919A".
// Books are the author's works; isbn is the first ISBN-13 found across the
// work's editions (falling back to ISBN-10), or null when none exists.
class OpenLibraryProvider {
  get name() {
    return 'openlibrary';
  }

  get idType() {
    return 'string';
  }

  async getAuthor(id) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error(
        `The "id" argument must be a non-empty Open Library author key such as "OL23919A", got ${JSON.stringify(id ?? null)}`
      );
    }
    let author;
    try {
      author = parseJson(await fetchUpstream(`${API_BASE}/authors/${encodeURIComponent(id)}.json`));
    } catch (err) {
      if (err.statusCode === 404) {
        throw new Error(`Author ${JSON.stringify(id)} was not found on Open Library`);
      }
      throw err;
    }
    const books = await this.fetchBooks(id);
    return { id, name: author.name ?? null, books };
  }

  async fetchBooks(authorId) {
    let works;
    try {
      works = parseJson(
        await fetchUpstream(`${API_BASE}/authors/${encodeURIComponent(authorId)}/works.json`)
      );
    } catch (err) {
      if (err.statusCode === 404) return [];
      throw err;
    }
    const entries = Array.isArray(works.entries) ? works.entries : [];
    return Promise.all(
      entries.map(async (work) => ({
        title: typeof work.title === 'string' ? work.title : null,
        isbn: await this.firstIsbn(work.key),
      }))
    );
  }

  // Resolves the first ISBN-13 across a work's editions, falling back to
  // ISBN-10. Returns null when the work has no editions or no ISBNs.
  async firstIsbn(workKey) {
    if (typeof workKey !== 'string' || workKey.trim() === '') return null;
    let editions;
    try {
      editions = parseJson(await fetchUpstream(`${API_BASE}${workKey}/editions.json`));
    } catch (err) {
      if (err.statusCode === 404) return null;
      throw err;
    }
    const entries = Array.isArray(editions.entries) ? editions.entries : [];
    for (const edition of entries) {
      if (Array.isArray(edition.isbn_13) && edition.isbn_13.length > 0) {
        return edition.isbn_13[0];
      }
    }
    for (const edition of entries) {
      if (Array.isArray(edition.isbn_10) && edition.isbn_10.length > 0) {
        return edition.isbn_10[0];
      }
    }
    return null;
  }
}

module.exports = OpenLibraryProvider;
