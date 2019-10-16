
const fs = require('fs');
const Hapi = require('@hapi/hapi');
const path = require('path');
const Boom = require('@hapi/boom');
const ext = require('commander');
const jsonwebtoken = require('jsonwebtoken');
const request = require('request');
const Connection = require('tedious').Connection;
const Request = require('tedious').Request;
const WebSocket = require('ws');
require('dotenv').config();

// The developer rig uses self-signed certificates.  Node doesn't accept them
// by default.  Do not use this in production.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use verbose logging during development.  Set this to false for production.
const verboseLogging = true;
const verboseLog = verboseLogging ? console.log.bind(console) : () => { };

// Service state variables
const serverTokenDurationSec = 30;          // our tokens for pubsub expire after 30 seconds
const userCooldownMs = 1000;                // maximum input rate per user to prevent bot abuse
const userCooldownClearIntervalMs = 60000;  // interval to reset our tracking object
const channelCooldownMs = 1000;             // maximum broadcast rate per channel
const bearerPrefix = 'Bearer ';             // HTTP authorization headers have this prefix
const channelCooldowns = {};                // rate limit compliance
let userCooldowns = {};                     // spam prevention

const STRINGS = {
  secretEnv: usingValue('secret'),
  clientIdEnv: usingValue('client-id'),
  ownerIdEnv: usingValue('owner-id'),
  serverStarted: 'Server running at %s',
  secretMissing: missingValue('secret', 'EXT_SECRET'),
  clientIdMissing: missingValue('client ID', 'EXT_CLIENT_ID'),
  ownerIdMissing: missingValue('owner ID', 'EXT_OWNER_ID'),
  messageSendError: 'Error sending message to channel %s: %s',
  pubsubResponse: 'Message to c:%s returned %s',
  cooldown: 'Please wait before clicking again',
  invalidAuthHeader: 'Invalid authorization header',
  invalidJwt: 'Invalid JWT',
};

ext.
  version(require('../package.json').version).
  option('-s, --secret <secret>', 'Extension secret').
  option('-c, --client-id <client_id>', 'Extension client ID').
  option('-o, --owner-id <owner_id>', 'Extension owner ID').
  parse(process.argv);

const ownerId = getOption('ownerId', 'EXT_OWNER_ID');
const secret = Buffer.from(getOption('secret', 'EXT_SECRET'), 'base64');
const clientId = getOption('clientId', 'EXT_CLIENT_ID');

const serverOptions = {
  host: 'localhost',
  port: 8081,
  routes: {
    cors: {
      origin: ['*'],
    },
  },
};
const serverPathRoot = path.resolve(__dirname, '..', 'conf', 'server');
if (fs.existsSync(serverPathRoot + '.crt') && fs.existsSync(serverPathRoot + '.key')) 
{
  serverOptions.tls = {
    // If you need a certificate, execute "npm run cert".
    cert: fs.readFileSync(serverPathRoot + '.crt'),
    key: fs.readFileSync(serverPathRoot + '.key'),
  };
}
const server = new Hapi.Server(serverOptions);

(async () => {
  // Handle queries for a user's data.
  server.route({
    method: 'GET',
    path: '/test',
    handler: testHandler,
  });

  server.route({ method: 'GET', path: '/status', handler: () => 'ok' });
  
function testHandler(req, h)
{
    return req.headers;
}

  // Start the server.
  await server.start();
  console.log(STRINGS.serverStarted, server.info.uri);

  // Periodically clear cool-down tracking to prevent unbounded growth due to
  // per-session logged-out user tokens.
  setInterval(() => { userCooldowns = {}; }, userCooldownClearIntervalMs);
})();

function usingValue(name) {
    return `Using environment variable for ${name}`;
  }
  
  function missingValue(name, variable) {
    const option = name.charAt(0);
    return `Extension ${name} required.\nUse argument "-${option} <${name}>" or environment variable "${variable}".`;
  }
  
  // Get options from the command line or the environment.
  function getOption(optionName, environmentName) {
    const option = (() => {
      if (ext[optionName]) {
        return ext[optionName];
      } else if (process.env[environmentName]) {
        console.log(STRINGS[optionName + 'Env']);
        return process.env[environmentName];
      }
      console.log(STRINGS[optionName + 'Missing']);
      process.exit(1);
    })();
    console.log(`Using "${option}" for ${optionName}`);
    return option;
  }
  
  // Verify the header and the enclosed JWT.
  function verifyAndDecode(header) {
    if (header.startsWith(bearerPrefix)) {
      try {
        const token = header.substring(bearerPrefix.length);
        return jsonwebtoken.verify(token, secret, { algorithms: ['HS256'] });
      }
      catch (ex) {
        throw Boom.unauthorized(STRINGS.invalidJwt);
      }
    }
    throw Boom.unauthorized(STRINGS.invalidAuthHeader);
  }
  
  // Create and return a JWT for use by this service.
  function makeServerToken(channelId) {
    const payload = {
      exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
      channel_id: channelId,
      user_id: ownerId, // extension owner ID for the call to Twitch PubSub
      role: 'external',
      pubsub_perms: {
        send: ['*'],
      },
    };
    return jsonwebtoken.sign(payload, secret, { algorithm: 'HS256' });
  }
  
  function userIsInCooldown(opaqueUserId) {
    // Check if the user is in cool-down.
    const cooldown = userCooldowns[opaqueUserId];
    const now = Date.now();
    if (cooldown && cooldown > now) {
      return true;
    }
  
    // Voting extensions must also track per-user votes to prevent skew.
    userCooldowns[opaqueUserId] = now + userCooldownMs;
    return false;
  }
  // **************************
  // * End Twitch Sample Code *
  // **************************
  