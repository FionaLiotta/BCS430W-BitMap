
const Boom = require('@hapi/boom');
const ext = require('commander');
const jsonwebtoken = require('jsonwebtoken');

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
const channelCooldownMs = 1000;             // maximum broadcast rate per channel
const bearerPrefix = 'Bearer ';             // HTTP authorization headers have this prefix
const channelCooldowns = {};                // rate limit compliance

STRINGS = {
    secretEnv: usingValue('secret'),
    clientIdEnv: usingValue('client-id'),   
    ownerIdEnv: usingValue('owner-id'),
    secretMissing: missingValue('secret', 'EXT_SECRET'),
    clientIdMissing: missingValue('client ID', 'EXT_CLIENT_ID'),
    ownerIdMissing: missingValue('owner ID', 'EXT_OWNER_ID'),
    serverStarted: 'Server running at %s',  
        messageSendError: 'Error sending message to channel %s: %s',
        pubsubResponse: 'Message to c:%s returned %s',
        cooldown: 'Please wait before clicking again',
        invalidAuthHeader: 'Invalid authorization header',
        invalidJwt: 'Invalid JWT'
  }

  ownerId = getOption('ownerId', 'EXT_OWNER_ID');
  secret = Buffer.from(getOption('secret', 'EXT_SECRET'), 'base64');
  clientId = getOption('clientId', 'EXT_CLIENT_ID');

ext.
  version(require('../package.json').version).
  option('-s, --secret <secret>', 'Extension secret').
  option('-c, --client-id <client_id>', 'Extension client ID').
  option('-o, --owner-id <owner_id>', 'Extension owner ID').
  parse(process.argv);

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

module.exports = {
    userCooldowns : {},                     // spam prevention
    userCooldownClearIntervalMs : 60000,  // interval to reset our tracking object

    STRINGS : {
        serverStarted: 'Server running at %s',  
        bearerPrefix: 'Bearer ',
        messageSendError: 'Error sending message to channel %s: %s',
        pubsubResponse: 'Message to c:%s returned %s',
      },



    // Verify the header and the enclosed JWT.
    verifyAndDecode: function (header) {
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
  },
  
  // Create and return a JWT for use by this service.
  makeServerToken: function (channelId) {
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
  },
  
  userIsInCooldown: function (opaqueUserId) {
    // Check if the user is in cool-down.
    const cooldown = userCooldowns[opaqueUserId];
    const now = Date.now();
    if (cooldown && cooldown > now) {
      return true;
    }
  
    // Voting extensions must also track per-user votes to prevent skew.
    userCooldowns[opaqueUserId] = now + userCooldownMs;
    return false;
  },


}