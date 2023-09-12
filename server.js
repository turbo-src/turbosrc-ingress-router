const express = require('express');
const socketIO = require('socket.io-client');
const superagent = require('superagent');
const bodyParser = require('body-parser');
const ethereumjsWallet = require('ethereumjs-wallet');
const ethUtil = require('ethereumjs-util');
const http = require('http');

// The URI for the outGoingRouter

//turbosrc-service tells ingress the outgoing.

var outGoingRouterUri = getEgressRouterURL().replace('/graphql', '');

// The URI for the turbosrc-service
const turbosrcServiceUri = 'http://turbosrc-service:4000/graphql';

// Connect to the outGoingRouter (aka egress-router)
let socket = createSocketConnection(outGoingRouterUri);

function signNewConnectionMessage(contributor_signature, message) {
  console.log(`Contributor Signature Length (chars): ${contributor_signature.length}`);
  console.log(`Contributor Signature: ${contributor_signature}`);

  const privateKeyBuffer = Buffer.from(contributor_signature.slice(2), 'hex');
  // Ensure the message is a Buffer before hashing
  const messageBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message.slice(2), 'hex'); // Assumes a 0x prefix for the input message

  const messageHash = ethUtil.keccak256(messageBuffer);

  // Using ecsign to get the signature
  const { v, r, s } = ethUtil.ecsign(messageHash, privateKeyBuffer);
  const signatureString = Buffer.concat([r, s, Buffer.from([v])]).toString('hex');

  return signatureString;
}

function getTurboSrcID() {
  return process.env.TURBOSRC_ID;
}

function getTurboSrcKey() {
  return process.env.TURBOSRC_KEY;
}

function getEgressRouterURL() {
  return process.env.EGRESS_ROUTER_URL;
}

function createSocketConnection(uri) {
  const turboSrcID = getTurboSrcID()
  const turboSrcKey = getTurboSrcKey()
  const reponame = turboSrcID + "/" + turboSrcID
  if (!turboSrcKey) {
      console.error("TURBOSRC_KEY is not defined in the environment variables.");
      return; // or throw an error
  }

  if (!turboSrcID) {
      console.error("TURBOSRC_ID is not defined in the environment variables.");
      return; // or throw an error
  }


  const socket = socketIO(uri, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000, // wait 1 seconds before attempting to reconnect
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling'], // Add this line
    secure: uri.startsWith('https'), // Add this line
    rejectUnauthorized: false, // Add this line
  });



  socket.on('connect', () => {
    console.log(`Connected to egress-router on ${uri}.`);
    signedTurboSrcID = signNewConnectionMessage(turboSrcKey, turboSrcID);
    socket.emit('newConnection', turboSrcID, signedTurboSrcID, reponame);
  });

  socket.on('error', (error) => {
    console.error(`Error occurred with egress-router: ${error.message}`);
  });

  socket.on('connect_error', (error) => {
    console.error(`Connection error occurred with egress-router: ${error.message}`);
  });

  socket.on('disconnect', () => console.log('Disconnected from egress-router.'));
  socket.on('reconnecting', (attemptNumber) => console.log(`Attempting to reconnect to egress-router. Attempt ${attemptNumber}`));

  return socket;
}

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
    socket.emit('graphqlResponse', { requestId, body: res.body });

  } catch (error) {
    // Forward the error back to outGoingRouter
    socket.emit('graphqlResponse', { requestId, errors: [{ message: error.message }] });
  }
});

// Start HTTP server
const server = http.createServer(app);
const port = process.env.PORT || 4005;
server.listen(port, () => console.log(`Listening on port ${port}`));