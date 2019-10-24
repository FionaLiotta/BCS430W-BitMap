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
const sql = require('mssql');
const WebSocket = require('ws');
require('dotenv').config();
const twitch = require('./TwitchCommon.js');
require('./websocket.js');

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
  const sqlConfig ={
    user: process.env.SQLUSERNAME,
    password: process.env.SQLPASSWORD,
    server: process.env.SQLSERVER, // You can use 'localhost\\instance' to connect to named instance
    database: process.env.SQLDB,
 
    options: {
        encrypt: true // Use this if you're on Windows Azure
    }
  }
  try
  {
    //await sql.connect('mssql://' + process.env.SQLUSERNAME + ':' + process.env.SQLPASSWORD + '@' + process.env.SQLSERVER + '/' + process.env.SQLDB);
    await sql.connect(sqlConfig);
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
