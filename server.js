const express = require('express')
const { createHandler } = require('graphql-http/lib/use/express')
const app = express()
const { selectedProviderName } = require('./providers')
const schema = require('./schema')

// Self-contained GraphiQL page; assets are loaded from a public CDN so the
// repository stays dependency-free.
const GRAPHIQL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GraphiQL | graphql-goodreads</title>
  <link rel="stylesheet" href="https://unpkg.com/graphiql@3/graphiql.min.css" />
</head>
<body style="margin: 0;">
  <div id="graphiql" style="height: 100vh;"></div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/graphiql@3/graphiql.min.js"></script>
  <script>
    var root = ReactDOM.createRoot(document.getElementById('graphiql'));
    root.render(React.createElement(GraphiQL, {
      fetcher: GraphiQL.createFetcher({ url: '/graphql' }),
      defaultEditorToolsVisibility: true,
    }));
  </script>
</body>
</html>
`

// Serve the interactive documentation when a browser asks for HTML.
app.get('/graphql', (req, res, next) => {
  if ((req.headers.accept || '').includes('text/html')) {
    res.type('html').send(GRAPHIQL_HTML)
    return
  }
  next()
})

// GraphQL over HTTP (query + mutation support, JSON responses).
app.all('/graphql', createHandler({ schema }))

module.exports = app

if (require.main === module) {
  let providerName;
  try {
    providerName = selectedProviderName();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
  if (providerName === 'goodreads' && !process.env.GOODREADS_API_KEY) {
    console.error('Error: GOODREADS_API_KEY environment variable is not set.');
    console.error('It is only required when BOOK_PROVIDER=goodreads.');
    console.error('Example: BOOK_PROVIDER=goodreads GOODREADS_API_KEY=your-key npm start');
    process.exit(1);
  }
  app.listen(4000)
  console.log(`Listening on http://localhost:4000/graphql (provider: ${providerName})...`)
}
