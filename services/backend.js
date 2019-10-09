/**
 *    Copyright 2018 Amazon.com, Inc. or its affiliates
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

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
    path: '/user/query',
    handler: userQueryHandler,
  });

  // Handle queries for channel configuration.
  server.route({
    method: 'GET',
    path: '/channel/config',
    handler: channelConfigQueryHandler
  });

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

// Regex for detecting country code emoji
// https://stackoverflow.com/questions/53360006/detect-with-regex-if-emoji-is-country-flag
const country_emoji_ranges = ['\\u{1F1E6}[\\u{1F1E9}-\\u{1F1EC}\\u{1F1EE}\\u{1F1F1}\\u{1F1F2}\\u{1F1F4}\\u{1F1F6}-\\u{1F1FA}\\u{1F1FC}\\u{1F1FD}\\u{1F1FF}]',
	'\\u{1F1E7}[\\u{1F1E6}\\u{1F1E7}\\u{1F1E9}-\\u{1F1EF}\\u{1F1F1}-\\u{1F1F4}\\u{1F1F6}-\\u{1F1F9}\\u{1F1FB}\\u{1F1FC}\\u{1F1FE}\\u{1F1FF}]',
	'\\u{1F1E8}[\\u{1F1E6}\\u{1F1E8}\\u{1F1E9}\\u{1F1EB}-\\u{1F1EE}\\u{1F1F0}-\\u{1F1F4}\\u{1F1F7}\\u{1F1FA}-\\u{1F1FF}]',
	'\\u{1F1E9}[\\u{1F1EA}\\u{1F1EF}\\u{1F1F0}\\u{1F1F2}\\u{1F1F4}\\u{1F1FF}]',
	'\\u{1F1EA}[\\u{1F1E8}\\u{1F1EA}\\u{1F1EC}\\u{1F1ED}\\u{1F1F7}-\\u{1F1F9}]',
	'\\u{1F1EB}[\\u{1F1EE}\\u{1F1EF}\\u{1F1F0}\\u{1F1F2}\\u{1F1F4}\\u{1F1F7}]',
	'\\u{1F1EC}[\\u{1F1E6}\\u{1F1E7}\\u{1F1E9}-\\u{1F1EE}\\u{1F1F1}-\\u{1F1F3}\\u{1F1F5}-\\u{1F1FA}\\u{1F1FC}\\u{1F1FE}]',
	'\\u{1F1ED}[\\u{1F1F0}\\u{1F1F2}\\u{1F1F3}\\u{1F1F7}\\u{1F1F9}\\u{1F1FA}]',
	'\\u{1F1EE}[\\u{1F1E9}-\\u{1F1F4}\\u{1F1F6}-\\u{1F1F9}]',
	'\\u{1F1EF}[\\u{1F1EA}\\u{1F1F2}\\u{1F1F4}\\u{1F1F5}]',
	'\\u{1F1F0}[\\u{1F1EA}\\u{1F1EC}-\\u{1F1EE}\\u{1F1F2}\\u{1F1F3}\\u{1F1F5}\\u{1F1F7}\\u{1F1FC}\\u{1F1FE}\\u{1F1FF}]',
	'\\u{1F1F1}[\\u{1F1E6}-\\u{1F1E8}\\u{1F1EE}\\u{1F1F0}\\u{1F1F8}-\\u{1F1FB}\\u{1F1FE}]',
	'\\u{1F1F2}[\\u{1F1E6}\\u{1F1E8}-\\u{1F1ED}\\u{1F1F0}-\\u{1F1FF}]',
	'\\u{1F1F3}[\\u{1F1E6}\\u{1F1E8}\\u{1F1EA}-\\u{1F1EC}\\u{1F1EE}\\u{1F1F1}\\u{1F1F4}\\u{1F1F5}\\u{1F1F7}\\u{1F1FA}\\u{1F1FF}]',
	'\\u{1F1F4}\\u{1F1F2}',
	'\\u{1F1F5}[\\u{1F1E6}\\u{1F1EA}-\\u{1F1ED}\\u{1F1F0}-\\u{1F1F3}\\u{1F1F7}-\\u{1F1F9}\\u{1F1FC}\\u{1F1FE}]',
	'\\u{1F1F6}\\u{1F1E6}',
	'\\u{1F1F7}[\\u{1F1EA}\\u{1F1F4}\\u{1F1F8}\\u{1F1FA}\\u{1F1FC}]',
	'\\u{1F1F8}[\\u{1F1E6}-\\u{1F1EA}\\u{1F1EC}-\\u{1F1F4}\\u{1F1F7}-\\u{1F1F9}\\u{1F1FB}\\u{1F1FD}-\\u{1F1FF}]',
	'\\u{1F1F9}[\\u{1F1E8}\\u{1F1E9}\\u{1F1EB}-\\u{1F1ED}\\u{1F1EF}-\\u{1F1F4}\\u{1F1F7}\\u{1F1F9}\\u{1F1FB}\\u{1F1FC}\\u{1F1FF}]',
	'\\u{1F1FA}[\\u{1F1E6}\\u{1F1EC}\\u{1F1F2}\\u{1F1F8}\\u{1F1FE}\\u{1F1FF}]',
	'\\u{1F1FB}[\\u{1F1E6}\\u{1F1E8}\\u{1F1EA}\\u{1F1EC}\\u{1F1EE}\\u{1F1F3}\\u{1F1FA}]',
	'\\u{1F1FC}[\\u{1F1EB}\\u{1F1F8}]',
	'\\u{1F1FE}[\\u{1F1EA}\\u{1F1F9}]',
	'\\u{1F1FF}[\\u{1F1E6}\\u{1F1F2}\\u{1F1FC}]'
];
const country_emoji_rx = new RegExp(country_emoji_ranges.join('|'), 'ug');

// connect to Azure SQL server

const AzureConfig = 
{
  server: process.env.SQLSERVER,
  options: {
    encrypt: true,
    database: 'TwitchAPI'
  },
  authentication: {
    type: "default",
    options: {  
      userName: process.env.SQLUSERNAME,
      password: process.env.SQLPASSWORD
    },
  }
}

const sql = new Connection(AzureConfig);

sql.on('connect', (err) => {
  if(err)
  {
    console.log(err);
  }
  else
  {
    console.log('Connected to Azure SQL server.');
  }
});

// Handle configuration queries.
// If no configuration is found for the channel ID, return the default config.
function channelConfigQueryHandler()
{
  const payload = verifyAndDecode(req.headers.authorization);
  console.log(payload);
  //const configQuery = new Request(`SELECT * FROM dbo.masterList WHERE channel_id = ${payload.channel_id}`);

}

// Handle configuration updates.
// If no configuration is found for the channel ID, create a new master table entry.
function channelConfigUpdateHandler()
{

}

// Handle incoming donation messages.
// Expects req.payload to contain chat_message, user_id
// If the donation contains a country code, register that user's country.
// If it does not, check if that user has previously registered.
// If they are registered, send a message to the frontend with data to display.
function userDonationHandler(payload)
{
  // This line pulls the 0th and 2nd character's code points, which will be 16 bit surrogate pairs for the country code if this is a country emoji
  const emojiTest = (String.fromCodePoint(payload.chat_message.codePointAt(0)) + String.fromCodePoint(payload.chat_message.codePointAt(2)));
  console.log(emojiTest);
  if(emojiTest.match(country_emoji_rx))
  {
    console.log(`Found country code. Register user ${payload.user_id} with country ${emojiTest}`);
    const addUser = new Request(`INSERT INTO testusers (userid, channelid, message) VALUES ('${payload.user_id}', '${payload.channel_id}', '${payload.chat_message}') ` , (err, result) => {
        if(err)
        {
            throw err;
        }
        else
        {
            console.log(`Added test user ${payload.user_id}`);
        }
    });
    sql.execSql(addUser);
  }
  else
  {
      console.log(`No country code at position 0. Check if ${payload.user_id} is already registered.`);
  }
  return true;
}

function userQueryHandler(req)
{
  const payload = verifyAndDecode(req.headers.authorization);
  console.log(payload);
  return true;
}

// Listening for mock data on the backend now
const url = 'wss://melon-crop.glitch.me/';
const connection = new WebSocket(url);
console.log("Opening connection to mock data server...");

connection.onopen = () => {
    console.log("Opened connection to mock data server.");
}

connection.onmessage = e => {
    console.log("Heard mock data.");
    //console.log(e);

    // Grab the body of the message from the event
    const {data: eData} = e;
    // Extract the topic from the message to see what kind of event it was
    const {data: {topic} = {topic: 'No topic'}} = JSON.parse(eData);
    console.log(topic);

    // Handle donations
    if(topic && topic.includes("channel-bits-events-v2"))
    {
        const {data: {message}} = JSON.parse(eData);
        const parsedMsg = JSON.parse(message);
        const {data: {channel_id, user_id, chat_message}} = parsedMsg;
        console.log(channel_id, user_id, chat_message);
        const payload = {channel_id, user_id, chat_message};
        userDonationHandler(payload);
        sendDebugMessageBroadcast(payload);
    }
}

function sendDebugMessageBroadcast(payload) {
    // Set the HTTP headers required by the Twitch API.
    const headers = {
      'Client-ID': clientId,
      'Content-Type': 'application/json',
      'Authorization': bearerPrefix + makeServerToken(payload.channel_id),
    };
  
    // Create the POST body for the Twitch API request.
    //const currentColor = color(channelColors[channelId] || initialColor).hex();
    const body = JSON.stringify({
      content_type: 'application/json',
      message: JSON.stringify(payload),
      targets: ['broadcast'],
    });
  
    // Send the broadcast request to the Twitch API.
    //verboseLog(STRINGS.colorBroadcast, currentColor, channelId);
    request(
      `https://api.twitch.tv/extensions/message/${payload.channel_id}`,
      {
        method: 'POST',
        headers,
        body,
      }
      , (err, res) => {
        if (err) {
          console.log(STRINGS.messageSendError, payload.channel_id, err);
        } else {
          console.log(STRINGS.pubsubResponse, payload.channel_id, res.statusCode);
        }
      });
  }