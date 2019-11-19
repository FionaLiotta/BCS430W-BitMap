
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
let response = await fetch('https://localhost:8081/channel/userCountryDonations' , queryRequest);
const resJSON = await response.json();

// your declaration of the table element:
const $tableBody = $('#donationTableBody');

for(let i = 0; i < resJSON.length; i++) {
    $tableBody.append(`
        <tr>
            <td>${resJSON[i].channel_id}</td>
            <td>${resJSON[i].user_id}</td>
            <td>${resJSON[i].CountryName}</td>
            <td>${resJSON[i].bits_used }</td>
        </tr>
    `);
}

});





twitch.rig.log('LOADED');