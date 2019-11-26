
import countryColor from './countryColor.mjs';
const twitch = window.Twitch.ext;

let token;
let tuid;  


twitch.onAuthorized(async function(auth) {
    
    // save our credentials
    token = auth.token;
    tuid = auth.userId;

    const queryRequest = 
{
    method: 'GET',
    headers: {'Authorization': 'Bearer ' + token},
}
let response = await fetch('https://twitchmapebs.azurewebsites.net/channel/countryDonations' , queryRequest);
const resJSON = await response.json();
twitch.rig.log(resJSON);
console.log(resJSON);
// your declaration of the table element:
const $tableBody = $('#donationTableBody');


for(let i = 0; i < resJSON.length; i++) {
    twitch.rig.log(resJSON[i]);
    $tableBody.append(`
        <tr>
            <td>${countryColor[resJSON[i].country_id].name}</td>
            <td>${resJSON[i].country_total}</td>
        </tr>
    `);
}

});





twitch.rig.log('LOADED');