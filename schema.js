const util = require("util");
const parseXML = util.promisify(require("xml2js").parseString);
const { fetchUpstream } = require("./lib/upstream");
const {
	GraphQLSchema,
	GraphQLObjectType,
	GraphQLInt,
    GraphQLString,
    GraphQLList,
} = require("graphql");

const BookType = new GraphQLObjectType({
    name: 'Book',
    description: '...',

    fields: () => ({
        title: {
            type: GraphQLString,
            resolve: xml =>
                xml.title[0]
        },
        isbn: {
            type: GraphQLString,
            resolve: xml => xml.isbn[0]
        }
    })
})

const AuthorType = new GraphQLObjectType({
	name: "Author",
	description: "...",

	fields: () => ({
		name: {
			type: GraphQLString,
			resolve: (xml) => xml.GoodreadsResponse.author[0].name[0]
        },
        books: {
            type: new GraphQLList(BookType),
            resolve: xml => 
                xml.GoodreadsResponse.author[0].books[0].book
        }
	}),
});

module.exports = new GraphQLSchema({
	query: new GraphQLObjectType({
		name: "Query",
		description: "...",

		fields: () => ({
			author: {
				type: AuthorType,
				args: {
					id: { type: GraphQLInt },
				},
				resolve: (root, args) => {
  if (!Number.isInteger(args.id) || args.id <= 0) {
    return Promise.reject(
      new Error(
        `The "id" argument must be a positive integer, got ${JSON.stringify(args.id ?? null)}`
      )
    );
  }
  const apiKey = process.env.GOODREADS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error('GOODREADS_API_KEY environment variable is not set')
    );
  }
  return fetchUpstream(
    `https://www.goodreads.com/author/show.xml?id=${args.id}&key=${apiKey}`
  ).then(parseXML)
}
			},
		}),
	}),
});
