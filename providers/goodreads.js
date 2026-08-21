'use strict';

const util = require('util');
const parseXML = util.promisify(require('xml2js').parseString);
const { fetchUpstream } = require('../lib/upstream');

// Legacy provider backed by the retired Goodreads XML API.
// Requires GOODREADS_API_KEY; new developer keys are no longer issued.
class GoodreadsProvider {
  get name() {
    return 'goodreads';
  }

  get idType() {
    return 'int';
  }

  async getAuthor(id) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `The "id" argument must be a positive integer, got ${JSON.stringify(id ?? null)}`
      );
    }
    const apiKey = process.env.GOODREADS_API_KEY;
    if (!apiKey) {
      throw new Error('GOODREADS_API_KEY environment variable is not set');
    }
    const xml = await fetchUpstream(
      `https://www.goodreads.com/author/show.xml?id=${id}&key=${apiKey}`
    );
    const parsed = await parseXML(xml);
    const author = parsed.GoodreadsResponse.author[0];
    const rawBooks =
      author.books && author.books[0] && Array.isArray(author.books[0].book)
        ? author.books[0].book
        : [];
    const books = rawBooks.map((book) => ({
      title: book.title && book.title[0] !== undefined ? book.title[0] : null,
      isbn: book.isbn && book.isbn[0] !== undefined ? book.isbn[0] : null,
    }));
    return { id: String(id), name: author.name[0], books };
  }
}

module.exports = GoodreadsProvider;
