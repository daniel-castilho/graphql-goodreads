const express = require('express')
const { graphqlHTTP } = require('express-graphql')
const app = express()
const schema = require('./schema')


app.use('/graphql', graphqlHTTP({
    schema: schema,
    graphiql: true,
}))

module.exports = app

if (require.main === module) {
  if (!process.env.GOODREADS_API_KEY) {
    console.error('Error: GOODREADS_API_KEY environment variable is not set.');
    console.error('Example: GOODREADS_API_KEY=your-key npm start');
    process.exit(1);
  }
  app.listen(4000)
  console.log('Listening...')
}
