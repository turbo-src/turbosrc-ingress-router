const express = require('express');
const socketIO = require('socket.io-client');
const superagent = require('superagent');
const bodyParser = require('body-parser');
const http = require('http');

// The URI for the outGoingRouter
const outGoingRouterUri = 'http://turbosrc-egress-router:4006';

// The URI for the turbosrc-service
const turbosrcServiceUri = 'http://turbosrc-service:4000/graphql';

// Connect to the outGoingRouter (aka egress-router)
const socket = socketIO(outGoingRouterUri, {
  autoConnect: true
});

// Start Express
const app = express();

// Use JSON body parser for GraphQL
app.use(bodyParser.json());

// Listen for messages from outGoingRouter via Socket.IO
socket.on('graphqlRequest', async ({ requestId, query, variables }) => {
  console.log("send-query:", query)
  try {
    // Send the request to turbosrc-service via HTTP
    const res = await superagent
      .post(turbosrcServiceUri)
      .send({ query, variables })
      .set('accept', 'json');

    // Forward the response back to outGoingRouter
    socket.emit(`graphqlResponse:${requestId}`, res.body);
  } catch (error) {
    // Forward the error back to outGoingRouter
    socket.emit(`graphqlResponse:${requestId}`, { errors: [{ message: error.message }] });
  }
});

// Start HTTP server
const server = http.createServer(app);
const port = process.env.PORT || 4005;
server.listen(port, () => console.log(`Listening on port ${port}`));