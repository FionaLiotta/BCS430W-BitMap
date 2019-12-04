import countryColor from './countryColor.mjs';
const countrySelect = document.querySelector("#countrySelect");
const configForm = document.querySelector('form');
const twitch = window.Twitch.ext;

let token = '';
let tuid = '';
// Populate country selection dropdown
let html = '';

for (const index in countryColor)
{
    const {color, name} = countryColor[index]; 
    html += `<option value="${index}">${index} : ${name}</option>`
}

countrySelect.innerHTML = html;

let myConfig = '';
async function fetchConfig() 
{
    twitch.rig.log('Fetching UserConfig...');
    const configRequest = 
    {
        method: 'GET',
        headers: {'Authorization': 'Bearer ' + token},
    }
    try{
        let response = await fetch('http://twitchmapebs.azurewebsites.net/user/config' , configRequest);
        myConfig = await response.json();
    }
    catch (err)
    {
        twitch.rig.log('UserConfig fetch failed! ' + err.statusText);
	
		twitch.rig.log('UserConfig fetch failed! ' + err);
    }
    
    twitch.rig.log(JSON.stringify(myConfig));
    return myConfig;
}

configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userCountry = e.target[0].value;
    const queryRequest = 
    {
        method: 'POST',
        headers: {'Authorization': 'Bearer ' + token},
        body: userCountry
    }
    let response = await fetch('http://twitchmapebs.azurewebsites.net/user/config' , queryRequest);
    const resJSON = await response.json();
    twitch.rig.log(JSON.stringify(resJSON));
});

twitch.onAuthorized(async function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    let config = await fetchConfig();
    countrySelect.value = config[0].country_id;
});