const twitch = require('./TwitchCommon.js');
const sql = require('mssql');
const WebSocket = require('ws');
const request = require('request');

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
const country_emoji_array = ['🇦🇨','🇦🇩','🇦🇪','🇦🇫','🇦🇬','🇦🇮','🇦🇱','🇦🇲','🇦🇴','🇦🇶','🇦🇷','🇦🇸','🇦🇹','🇦🇺','🇦🇼','🇦🇽','🇦🇿','🇧🇦','🇧🇧','🇧🇩','🇧🇪','🇧🇫','🇧🇬','🇧🇭','🇧🇮','🇧🇯','🇧🇱','🇧🇲','🇧🇳','🇧🇴','🇧🇶','🇧🇷','🇧🇸','🇧🇹','🇧🇻','🇧🇼','🇧🇾','🇧🇿','🇨🇦','🇨🇨','🇨🇩','🇨🇫','🇨🇬','🇨🇭','🇨🇮','🇨🇰','🇨🇱','🇨🇲','🇨🇳','🇨🇴','🇨🇵','🇨🇷','🇨🇺','🇨🇻','🇨🇼','🇨🇽','🇨🇾','🇨🇿','🇩🇪','🇩🇬','🇩🇯','🇩🇰','🇩🇲','🇩🇴','🇩🇿','🇪🇦','🇪🇨','🇪🇪','🇪🇬','🇪🇭','🇪🇷','🇪🇸','🇪🇹','🇪🇺','🇫🇮','🇫🇯','🇫🇰','🇫🇲','🇫🇴','🇫🇷','🇬🇦','🇬🇧','🇬🇩','🇬🇪','🇬🇫','🇬🇬','🇬🇭','🇬🇮','🇬🇱','🇬🇲','🇬🇳','🇬🇵','🇬🇶','🇬🇷','🇬🇸','🇬🇹','🇬🇺','🇬🇼','🇬🇾','🇭🇰','🇭🇲','🇭🇳','🇭🇷','🇭🇹','🇭🇺','🇮🇨','🇮🇩','🇮🇪','🇮🇱','🇮🇲','🇮🇳','🇮🇴','🇮🇶','🇮🇷','🇮🇸','🇮🇹','🇯🇪','🇯🇲','🇯🇴','🇯🇵','🇰🇪','🇰🇬','🇰🇭','🇰🇮','🇰🇲','🇰🇳','🇰🇵','🇰🇷','🇰🇼','🇰🇾','🇰🇿','🇱🇦','🇱🇧','🇱🇨','🇱🇮','🇱🇰','🇱🇷','🇱🇸','🇱🇹','🇱🇺','🇱🇻','🇱🇾','🇲🇦','🇲🇨','🇲🇩','🇲🇪','🇲🇫','🇲🇬','🇲🇭','🇲🇰','🇲🇱','🇲🇲','🇲🇳','🇲🇴','🇲🇵','🇲🇶','🇲🇷','🇲🇸','🇲🇹','🇲🇺','🇲🇻','🇲🇼','🇲🇽','🇲🇾','🇲🇿','🇳🇦','🇳🇨','🇳🇪','🇳🇫','🇳🇬','🇳🇮','🇳🇱','🇳🇴','🇳🇵','🇳🇷','🇳🇺','🇳🇿','🇴🇲','🇵🇦','🇵🇪','🇵🇫','🇵🇬','🇵🇭','🇵🇰','🇵🇱','🇵🇲','🇵🇳','🇵🇷','🇵🇸','🇵🇹','🇵🇼','🇵🇾','🇶🇦','🇷🇪','🇷🇴','🇷🇸','🇷🇺','🇷🇼','🇸🇦','🇸🇧','🇸🇨','🇸🇩','🇸🇪','🇸🇬','🇸🇭','🇸🇮','🇸🇯','🇸🇰','🇸🇱','🇸🇲','🇸🇳','🇸🇴','🇸🇷','🇸🇸','🇸🇹','🇸🇻','🇸🇽','🇸🇾','🇸🇿','🇹🇦','🇹🇨','🇹🇩','🇹🇫','🇹🇬','🇹🇭','🇹🇯','🇹🇰','🇹🇱','🇹🇲','🇹🇳','🇹🇴','🇹🇷','🇹🇹','🇹🇻','🇹🇼','🇹🇿','🇺🇦','🇺🇬','🇺🇲','🇺🇳','🇺🇸','🇺🇾','🇺🇿','🇻🇦','🇻🇨','🇻🇪','🇻🇬','🇻🇮','🇻🇳','🇻🇺','🇼🇫','🇼🇸','🇽🇰','🇾🇪','🇾🇹','🇿🇦','🇿🇲','🇿🇼',];

// Handle incoming donation messages.
// Expects req.payload to contain chat_message, user_id
// If the donation contains a country code, register that user's country.
// If it does not, check if that user has previously registered.
// If they are registered, send a message to the frontend with data to display.
async function userDonationHandler(payload)
{
  // This line pulls the 0th and 2nd character's code points, which will be 16 bit surrogate pairs for the country code if this is a country emoji
  const emojiTest = (String.fromCodePoint(payload.chat_message.codePointAt(0)) + String.fromCodePoint(payload.chat_message.codePointAt(2)));
  const hasEmoji = emojiTest.match(country_emoji_rx);
  let country_id = -1;

  // Check if user is registered.
  let registeredResponse = await sql.query(`SELECT * FROM dbo.Users WHERE user_id = ${payload.user_id}`);
  console.log('Checking if user is registered: ' + JSON.stringify(registeredResponse));
  if(registeredResponse.recordset[0]){
    country_id = registeredResponse.recordset[0].country_id;
  }
  console.log('country_id and emojiTest: ' + country_id + emojiTest);
  // If we did not get back a valid country ID, register the new user.
  if(hasEmoji)
  {
    // get country_id for emoji
    country_id = country_emoji_array.findIndex((element) => {
      return (element === emojiTest);
    });
    console.log(`Found country code. Register user ${payload.user_id} with country ${emojiTest}:${country_id}`);
    let updateCountry = await sql.query(`
      IF EXISTS (SELECT * FROM dbo.Users WHERE user_id=${payload.user_id})
        UPDATE dbo.Users SET country_id=${country_id} WHERE user_id=${payload.user_id}
      ELSE
        INSERT INTO dbo.Users (user_id, country_id) VALUES (${payload.user_id}, ${country_id})
    `);
    console.log('Registered user: ' + JSON.stringify(updateCountry));
  }
  // If no country emoji, do nothing.
  else
  {
    console.log('No emoji found, no action needed.');
  }

  let logDonation = await sql.query(`INSERT INTO dbo.Donations (channel_id, chat_message, user_id, country_id, bits_used) 
  VALUES (${payload.channel_id}, N'${payload.chat_message}', ${payload.user_id}, ${country_id}, ${payload.bits_used})
  `);
  console.log('Logged donation: ' + JSON.stringify(logDonation));

  return ({
    channel_id: payload.channel_id,
    chat_message: payload.chat_message,
    user_id: payload.user_id,
    country_id: country_id,
    bits_used: payload.bits_used
  });
}

// Listening for mock data on the backend now
const url = 'wss://melon-crop.glitch.me/';
const connection = new WebSocket(url);
console.log("Opening connection to mock data server...");

// Keepalive function for the websocket.
function keepalive()
{
  if(connection.readyState == connection.OPEN)
  {
    console.log('Sending keepalive...');
    connection.ping('ping');
  } 
  else
  {
    console.log('connection.readyState not OPEN', connection.readyState);
  }
  setTimeout(keepalive, 15000);
}

connection.on('pong', () => {
  console.log('Heard pong.');
});

connection.on('ping', (e) =>{
  console.log('Heard ping.');
  connection.pong();
})

connection.onopen = () => {
    console.log("Opened connection to mock data server.");
    //keepalive();
}

connection.onmessage = async e => {
    console.log("Heard mock data.");
    //console.log(e);
    // Grab the body of the message from the event
    const {data: eData} = e;
    //console.log(eData);
    if(eData === 'pong')
    {
      console.log('Heard pong.');
      return;
    }
    // Extract the topic from the message to see what kind of event it was
    const {data: {topic} = {topic: 'No topic'}} = JSON.parse(eData);
    console.log(topic);



    // Handle donations
    if(topic && topic.includes("channel-bits-events-v2"))
    {
        const {data: {message}} = JSON.parse(eData);
        const parsedMsg = JSON.parse(message);
        const {data: {channel_id, user_id, chat_message, bits_used}} = parsedMsg;
        console.log(channel_id, user_id, chat_message, bits_used);
        const payload = {channel_id, user_id, chat_message, bits_used};
        const donationResult = await userDonationHandler(payload);
        console.log(donationResult);
        sendBroadcast(donationResult);
    }
}

function sendBroadcast(payload) {
    // Set the HTTP headers required by the Twitch API.
    const headers = {
      'Client-ID': clientId,
      'Content-Type': 'application/json',
      'Authorization': twitch.STRINGS.bearerPrefix + twitch.makeServerToken(payload.channel_id),
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
          console.log(twitch.STRINGS.messageSendError, payload.channel_id, err);
        } else {
          console.log(twitch.STRINGS.pubsubResponse, payload.channel_id, res.statusCode);
        }
      });
  }