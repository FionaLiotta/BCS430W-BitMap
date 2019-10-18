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
const request = require('request');
const sql = require('mssql');
const WebSocket = require('ws');
require('dotenv').config();
const twitch = require('./TwitchCommon.js');

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

  // ***
  // SQL
  // ***
  try
  {
    await sql.connect('mssql://' + process.env.SQLUSERNAME + ':' + process.env.SQLPASSWORD + '@' + process.env.SQLSERVER + '/' + process.env.SQLDB);
  }
  catch (err)
  {
    console.log ('Error connecting to SQL server: \n' + err);
  }

  const routes = require('./routes/');
  server.route(routes);

  // Start the server.
  await server.start();
  console.log(twitch.STRINGS.serverStarted, server.info.uri);

  // Periodically clear cool-down tracking to prevent unbounded growth due to
  // per-session logged-out user tokens.
  setInterval(() => { twitch.userCooldowns = {}; }, twitch.userCooldownClearIntervalMs);
})();

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