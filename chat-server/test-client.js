import WebSocket from 'ws';
import crypto from 'crypto';
import readline from 'readline';

// Get the userId from command line arguments.
// specifies the chat room to connect to.
// If not provided, exit with an error message.
const userId = process.argv[2];
if (!userId) {
  console.error('You must provide a userId as a command line argument. Example:');
  console.error('   node test-client.js streamer123');
  process.exit(1);
}

console.log(`Connecting to chat room for userId: ${userId}`);

// Create a readline interface for interactive command line input.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Generate an RSA public/private key pair synchronously.
// This is used to authenticate the user by signing a message.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048, // Key size in bits
});

// Create a random username like "User-1234"
const name = `User-${Math.floor(Math.random() * 10000)}`;

// Message that the user will sign to prove their identity.
const messageToSign = `I am ${name}`;

// Create signer object.
const sign = crypto.createSign('SHA256');
sign.update(messageToSign);
sign.end();

// Sign, then encode signature to base64 string.
const signature = sign.sign(privateKey).toString('base64');

// Open a WebSocket connection.
const ws = new WebSocket(`ws://localhost:8081/?userId=${userId}`);

// When connection opens:
ws.on('open', () => {
  console.log('Connected to server.');

  // Send an authentication message with name, publicKey, and signature.
  // The server will verify the signature to authenticate the user.
  ws.send(JSON.stringify({
    type: 'auth',
    data: {
      name,
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }), // Export public key in PEM format
      signature,
    },
  }));

  // Setup prompt for user to input chat messages.
  rl.setPrompt('Message> ');
  rl.prompt();

  // When user types a line and presses enter:
  rl.on('line', (line) => {
    // Only send the message if the WebSocket connection is still open.
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ messageText: line }));
    } else {
      console.log('Connection closed. Cannot send message.');
    }
    rl.prompt(); // Prompt user for next input
  });
});

// When a message is received from the server:
ws.on('message', (data) => {
  try {
    // Try parsing the message as JSON
    const msg = JSON.parse(data);

    // Handle error messages sent from server
    if (msg.error) {
      console.error(`Server error: ${msg.error}`);

      // Confirm authentication success
    } else if (msg.status === 'authenticated') {
      console.log(`Authenticated as ${msg.name}`);

      // Display chat messages from other users
    } else if (msg.userName && msg.messageText) {
      console.log(`[${msg.timestamp}] ${msg.userName}: ${msg.messageText}`);

      // Unknown message format
    } else {
      console.log('Received unknown message:', msg);
    }

  } catch {
    // If message is not JSON, just print raw message
    console.log('Received non-JSON message:', data.toString());
  }
});

// Handle WebSocket connection errors
ws.on('error', (err) => {
  console.error(`Connection error: ${err.message}`);
});

// Handle WebSocket connection close event
ws.on('close', () => {
  console.log('Disconnected from server');
  rl.close(); // Close the readline interface to stop input
});
