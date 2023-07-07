const express = require('express');
const socketIO = require('socket.io-client');
const superagent = require('superagent');
const bodyParser = require('body-parser');
const http = require('http');

// The URI for the outGoingRouter
const outGoingRouterUri = 'http://localhost:4006';

// Connect to the outGoingRouter
const socket = socketIO(outGoingRouterUri, {
  autoConnect: true
});

// Start Express
const app = express();

// Use JSON body parser for GraphQL
app.use(bodyParser.json());

// Route for GraphQL requests
app.post('/graphql', (req, res) => {
  // Create a unique ID for this request, could be a random UUID
  const requestId = Date.now().toString();

  // Send GraphQL request to the outGoingRouter via socket
  socket.emit('graphqlRequest', {
    requestId: requestId,
    query: req.body.query,
    variables: req.body.variables
  });

  // Setup a one-time event listener for the response
  socket.once(`graphqlResponse:${requestId}`, ({ data, errors }) => {
    // Forward the response to the client
    res.json({ data, errors });
  });
});

// Start HTTP server
const server = http.createServer(app);
const port = process.env.PORT || 4005;
server.listen(port, () => console.log(`Listening on port ${port}`));
