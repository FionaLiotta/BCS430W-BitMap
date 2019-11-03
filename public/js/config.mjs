import countryColor from './countryColor.mjs';
const twitch = window.Twitch.ext;
const countrySelect = document.querySelector("#countrySelect");
const mapType = document.querySelector("#mapType");
const configOutput = document.querySelector("#configOutput");
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
        let response = await fetch('https://localhost:8081/channel/config' , configRequest);
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
    configOutput.setAttribute("style", `background-color: ${countryColor[countrySelect.value].color}`)
});

countrySelect.addEventListener('change', (e) => {
    configOutput.setAttribute("style", `background-color: ${countryColor[countrySelect.value].color}`)
});


