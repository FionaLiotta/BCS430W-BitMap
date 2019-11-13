const twitch = require('../TwitchCommon.js');
const sql = require('mssql');

module.exports = [
{
    method: 'GET',
    path: '/channel/config',
    handler: channelConfigHandler,
  },
  {
    method: 'POST',
    path: '/channel/config',
    handler: channelConfigWriteHandler
  },
  {
    method: 'GET',
    path: '/channel/countryDonations',
    handler: channelCountryTotalDonationsHandler
  },
  {
    method: 'GET',
    path: '/channel/totalDonations',
    handler: channelTotalDonationsHandler
  },
]

async function createConfig(mapType, streamerCountry, channelId)
{
  let configId = 0;
  let newConfig = await sql.query(`INSERT INTO dbo.Config VALUES (${streamerCountry}, N'${mapType}', ${channelId} ); select SCOPE_IDENTITY() as configID`);
  console.log(JSON.stringify(newConfig));
  return newConfig.recordset[0].configID;
}

//Handle requests for channel configurations
async function channelConfigHandler(req, h)
{
  let configId;
  // decode JWT so we can get channel/user_id etc.
  let decodedjwt = twitch.verifyAndDecode(req.headers.authorization);
  let {channel_id: channelId} = decodedjwt;
  
  // Check that the JWT was there and valid.
  if(decodedjwt)
  {
    console.log('JWT was OK.');

    // Check if the channelId exists in the master table yet.
    let findChannel = await sql.query(`SELECT Config_ID FROM dbo.masterList WHERE Channel_ID = ${channelId}`);
    console.log(JSON.stringify(findChannel));
    // If it doesn't, add it with a default config.
    if(findChannel.rowsAffected[0] === 0)
    {
      console.log('Channel not found. Add it with default config.');
      configId = await createConfig('Globe', 258, channelId);
      try {
        console.log(`INSERT INTO dbo.MasterList VALUES (${channelId}, ${configId})`);
        let newChannel = await sql.query(`INSERT INTO dbo.MasterList VALUES (${channelId}, ${configId})`);
        console.log(JSON.stringify(newChannel));
      }
      catch (err) {
        console.log('SQL error: ' + err);
      }

    }
    // If it does, use its current configId
    else
    {
      configId = findChannel.recordset[0].Config_ID;
    }
    // Grab the current config and send it back.
    let currentConfig = await sql.query(`SELECT * FROM dbo.Config WHERE Config_id = ${configId}`);
    return h.response({status: 'JWT ok!', config: currentConfig.recordset[0]});
  }
  else
  {
    console.log('JWT missing or invalid.');
    return h.response({status: 'JWT invalid.', config: ''});
  }
}

async function channelConfigWriteHandler(req, h)
{
  let decodedjwt = twitch.verifyAndDecode(req.headers.authorization);
  let {channel_id: channelId} = decodedjwt;
  const payload = JSON.parse(req.payload);
  const {streamerCountry, mapType, configId} = payload;
  console.log('Got config write request! ' + channelId);
  let writeConfig = await sql.query(`UPDATE dbo.Config
    SET StreamerCountry = ${streamerCountry}, mapType = N'${mapType}'
    WHERE Config_id = ${configId}
    ;`);
  if(writeConfig.rowsAffected === 1)
  {
    console.log('Wrote config.');
    // Grab the current config and send it back.
    let currentConfig = await sql.query(`SELECT * FROM dbo.Config WHERE Config_id = ${configId}`);
    return h.response({status: 'Config updated.', config: currentConfig.recordset[0]});
  }
  else
  {
    console.log('Failed to write config.');
    return h.response({status: 'Failed to update config.'});

  }
}

async function channelCountryTotalDonationsHandler(req, h)
{
  let decodedjwt = twitch.verifyAndDecode(req.headers.authorization);
  let {channel_id: channelId} = decodedjwt;
  let countryQuery = await sql.query(`SELECT country_id, sum(bits_used) AS country_total FROM TwitchAPI.dbo.Donations WHERE channel_id = ${channelId} GROUP BY [country_id] ORDER BY country_total DESC;
  `);
  return h.response(countryQuery.recordset);
}

async function channelTotalDonationsHandler(req, h)
{
  let decodedjwt = twitch.verifyAndDecode(req.headers.authorization);
  let {channel_id: channelId} = decodedjwt;
  let totalQuery = await sql.query(`SELECT sum(bits_used) AS channel_sum FROM TwitchAPI.dbo.Donations WHERE channel_id = ${channelId}
  `);
  return h.response(totalQuery.recordset);

}