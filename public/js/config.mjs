import countryColor from './countryColor.mjs';
const twitch = window.Twitch.ext;
const countrySelect = document.querySelector("#countrySelect");
const mapType = document.querySelector("#mapType");
const debugOutput = document.querySelector("#debugOutput");
const configOutput = document.querySelector("#configOutput");
const testCountryQueryButton = document.querySelector('#testCountryQuery');
const configForm = document.querySelector('#configForm');
let token = '';
let tuid = '';
let configId = 0;

// Populate country selection dropdown
let html = '';

for (const index in countryColor)
{
    const {color, name} = countryColor[index]; 
    html += `<option value="${index}">${index} : ${name}</option>`
}

countrySelect.innerHTML = html;

//query server for config.

configOutput.innerHTML = 'Fetching config...';
let myConfig = '';
async function fetchConfig() 
{
    twitch.rig.log('Fetching config...');
    const configRequest = 
    {
        method: 'GET',
        headers: {'Authorization': 'Bearer ' + token},
    }
    try{
        let response = await fetch('https://twitchmapebs.azurewebsites.net/channel/config' , configRequest);
        myConfig = await response.json();
    }
    catch (err)
    {
        twitch.rig.log('Fetch failed! ' + err.statusText);
	
		twitch.rig.log('Fetch failed! ' + err);
    }
    
    configOutput.innerHTML = JSON.stringify(myConfig);
    return myConfig.config;
}

// Get and save auth tokens
twitch.onAuthorized(async function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    let config = await fetchConfig();
    countrySelect.value = config.StreamerCountry;
    mapType.value = config.MapType;
    configId = config.Config_id;
    configOutput.setAttribute("style", `background-color: ${countryColor[countrySelect.value].color}`)
});

countrySelect.addEventListener('change', (e) => {
    configOutput.setAttribute("style", `background-color: ${countryColor[countrySelect.value].color}`)
});

testCountryQueryButton.addEventListener('click', async (e) => {
    const queryRequest = 
    {
        method: 'GET',
        headers: {'Authorization': 'Bearer ' + token},
    }
    let response = await fetch('https://twitchmapebs.azurewebsites.net/channel/totalDonations' , queryRequest);
    const resJSON = await response.json();
    debugOutput.innerHTML = JSON.stringify(resJSON);

});

configForm.addEventListener('submit', async (e) =>{
    e.preventDefault();
    const streamerCountry = e.target[0].value;
    const mapType = e.target[1].value;
    const payload = {configId, streamerCountry, mapType};
    const queryRequest = 
    {
        method: 'POST',
        headers: {'Authorization': 'Bearer ' + token},
        body: JSON.stringify(payload)
    }
    let response = await fetch('https://twitchmapebs.azurewebsites.net/channel/config' , queryRequest);
    const resJSON = await response.json();
    debugOutput.innerHTML = JSON.stringify(resJSON);
});