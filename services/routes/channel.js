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
  }
]
  
  async function createConfig(mapType, streamerCountry, channelId)
  {
    let configId = 0;
    let newConfig = await sql.query(`INSERT INTO dbo.Config VALUES (N'${mapType}', N'${streamerCountry}', ${channelId}); select SCOPE_IDENTITY() as configID`);
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
      let findChannel = await sql.query(`SELECT ConfigID FROM dbo.masterList WHERE ChannelID = ${channelId}`);
      console.log(JSON.stringify(findChannel));
      // If it doesn't, add it with a default config.
      if(findChannel.rowsAffected[0] === 0)
      {
        console.log('Channel not found. Add it with default config.');
        configId = await createConfig('Globe', 'None', channelId);
        let newChannel = await sql.query(`INSERT INTO masterList VALUES (${channelId}, ${configId})`);
        console.log(JSON.stringify(newChannel));
      }
      // If it does, use its current configId
      else
      {
        configId = findChannel.recordset[0].ConfigID;
      }
      // Grab the current config and send it back.
      let currentConfig = await sql.query(`SELECT * FROM dbo.Config WHERE ConfigID = ${configId}`);
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
    let configId;
    // decode JWT so we can get channel/user_id etc.
    let decodedjwt = twitch.verifyAndDecode(req.headers.authorization);
    let {channel_id: channelId} = decodedjwt;
    console.log('Got config write request! ' + channelId);
    let writeConfig = sql.query(`ALTER TABLE dbo.Config {
      ALTER COLUMN
    } `)
  }