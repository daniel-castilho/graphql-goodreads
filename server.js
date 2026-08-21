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
  app.listen(4000)
  console.log('Listening...')
}
