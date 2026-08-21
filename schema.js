"use strict";

const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  GraphQLList,
} = require("graphql");
const { selectProvider } = require("./providers");

// Builds the GraphQL schema on top of a BookProvider (see providers/).
// The author(id) argument type follows the provider's idType:
// GraphQLInt for Goodreads, GraphQLString for Open Library.
function buildSchema(provider) {
  const idArgType = provider.idType === "int" ? GraphQLInt : GraphQLString;

  const BookType = new GraphQLObjectType({
    name: "Book",
    description: "A book written by an author.",

    fields: () => ({
      title: {
        type: GraphQLString,
        resolve: (book) => book.title,
      },
      isbn: {
        type: GraphQLString,
        resolve: (book) => book.isbn,
      },
    }),
  });

  const AuthorType = new GraphQLObjectType({
    name: "Author",
    description: "An author and their books.",

    fields: () => ({
      id: {
        type: GraphQLString,
        resolve: (author) => String(author.id),
      },
      name: {
        type: GraphQLString,
        resolve: (author) => author.name,
      },
      books: {
        type: new GraphQLList(BookType),
        resolve: (author) => author.books,
      },
    }),
  });

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      description: "The root query type.",

      fields: () => ({
        author: {
          type: AuthorType,
          args: {
            id: {
              type: idArgType,
              description:
                provider.idType === "int"
                  ? "Goodreads author id (positive integer)."
                  : 'Open Library author key (e.g. "OL23919A").',
            },
          },
          resolve: (_root, args) => provider.getAuthor(args.id),
        },
      }),
    }),
  });
}

module.exports = buildSchema(selectProvider());
