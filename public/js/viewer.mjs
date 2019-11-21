var token = "";
var tuid = "";
var ebs = "";
import countryColor from './countryColor.mjs';

// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    set: createRequest('POST', 'register'),
    get: createRequest('GET', 'query')
};

function createRequest(type, method, data) {

    return {
        type: type,
        beforeSend: function(request) {
            request.setRequestHeader('Authorization', 'Bearer ' + token);
        },
        url: location.protocol + '//twitchmapebs.azurewebsites.net/user/' + method,
        data: data,
        success: updateBlock,
        error: logError
    }
}

function setAuth(token) {
    Object.keys(requests).forEach((req) => {
        twitch.rig.log('Setting auth headers');
        requests[req].headers = { 'Authorization': 'Bearer ' + token }
    });
}

twitch.onContext(function(context) {
    twitch.rig.log(context);
});

twitch.onAuthorized(function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    setAuth(token);
});

function updateBlock(hex) {
    twitch.rig.log("Successful request");
}

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
}

function logSuccess(hex, status) {
  // we could also use the output to update the block synchronously here,
  // but we want all views to get the same broadcast response at the same time.
  twitch.rig.log('EBS request returned '+hex+' ('+status+')');
}

document.addEventListener("DOMContentLoaded", function(event) { 
    const debugOutput = document.querySelector("#debugOutput");
    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, payload) {
        twitch.rig.log('Received broadcast: ' + payload);
        const jsonPayload = JSON.parse(payload);
        console.log(countryColor[jsonPayload.country_id].color);
        debugOutput.innerHTML = payload;
        debugOutput.setAttribute("style", `background-color: ${countryColor[jsonPayload.country_id].color}`)
        debugOutput.classList.add('showPopup');
        setTimeout(() => {
        debugOutput.classList.remove('showPopup');
        }, 5000);
    });
    
});



   
