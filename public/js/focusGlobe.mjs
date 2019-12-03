
import countryColor from './countryColor.mjs';
const twitch = window.Twitch.ext;

let token = '';
let tuid = '';
let MapType = 'Globe';

//D3 vars
let projection;
var width = 225,
height = 225,
sens = 0.25,
focused,
option,
p;

// Fetch Globe/Flat preference
async function fetchConfig() 
{
    let myConfig = '';
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
        console.log('Fetch failed! ' + err.statusText);
	
    }
    return myConfig.config;
}

// Get and save auth tokens
twitch.onAuthorized(async function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    let config = await fetchConfig();
    MapType = config.MapType;
    //Setting projection
    console.log('MapType: ', MapType);
    if(MapType === 'Globe')
    {
        projection = d3.geo.orthographic()
        .scale(100)
        .rotate([0, 0])
        .translate([width / 2, height / 2])
        .clipAngle(90);
    }
    else
    {
        projection = d3.geo.mercator()
        .scale(100)
        .rotate([0, 0])
        .translate([width / 2, height / 2])
        .clipAngle(90);
    }


console.log('projection:', projection);
var path = d3.geo.path()
.projection(projection);

//SVG container

var svg = d3.select("#focusGlobe").append("svg")
.attr("width", width)
.attr("height", height);

//Adding water

svg.append("path")
.datum({type: "Sphere"})
.attr("class", "water")
.attr("d", path);

var countryTooltip = d3.select("#focusGlobe").append("div").attr("class", "countryTooltip"),
bitsTooltip = d3.select("#focusGlobe").append("div").attr("class", "bitsTooltip"),
countryList = d3.select("#focusGlobe").append("select").attr("name", "countries");

let hideSelect = document.querySelector('select');
hideSelect.classList.add('vis-hidden');

queue()
.defer(d3.json, "./custom.geo.json")
.await(ready);

//Main function

function ready(error, world, countryData) {

    var countryById = {},
    countries = world.features;

    //Adding countries to select

    countries.forEach(function(d) {
    countryById[d.properties.iso_n3] = d.properties.name;
    option = countryList.append("option");
    option.text(d.properties.name);
    option.property("value", d.properties.iso_n3);
    });

    //Drawing countries on the globe

    var world = svg.selectAll("path.land")
    .data(countries)
    .enter().append("path")
    .attr("class", "land")
    .attr("d", path)

    function country(cnt, sel) { 
        for(var i = 0, l = cnt.length; i < l; i++) {
            if(cnt[i].properties.name == sel) {return cnt[i];}
        }
    };

    

    // Twitch listening stuff
    var twitch = window.Twitch.ext;
    const focusGlobe = document.querySelector('#focusGlobe');
    twitch.listen('broadcast', function (target, contentType, payload) {


        twitch.rig.log('Globe recieved broadcast: ' + payload);
        const jsonPayload = JSON.parse(payload);
        console.log(countryColor[jsonPayload.country_id].name);
        

        let rotate = projection.rotate();
        let focusedCountry = country(countries, countryColor[jsonPayload.country_id].name);
        p = d3.geo.centroid(focusedCountry);
        if(focusedCountry){
            // Show country popup
            countryTooltip.text(`${focusedCountry.properties.name}`)
            .style("left", (15) + "px")
            .style("top", (15) + "px")
            .style("display", "block")
            .style("opacity", 1);

            bitsTooltip.text(`${jsonPayload.bits_used} Bits`)
            .style("left", (15) + "px")
            .style("top", (2.5) + "em")
            .style("display", "block")
            .style("opacity", 1);

            // Reset fadeout
            clearTimeout(this.fadeTimer);

            // Show map and rotate to show highlighted country.
            focusGlobe.classList.add('opaque');
            (function transition() 
            {
            d3.transition()
            .duration(2500)
            .tween("rotate", function() {
                var r = d3.interpolate(projection.rotate(), [-p[0], -p[1]]);
                return function(t) {
                projection.rotate(r(t));
                svg.selectAll("path").attr("d", path)
                .classed("focused", function(d, i) {
                    if(d.type == "Sphere") {return false;}
                    if(d.properties.name == focusedCountry.properties.name)
                    {
                        return (focused = d)
                    }
                    else
                    {
                        return false; 
                    }
                });
                };
            })
            
            })();
            this.fadeTimer = setTimeout(() => {
                focusGlobe.classList.remove('opaque');
            }, 5000);
        }
        else
        {
             // Show country popup
             countryTooltip.text(`Missing map data: ${countryColor[jsonPayload.country_id].name}`)
             .style("left", (15) + "px")
             .style("top", (15) + "px")
             .style("display", "block")
             .style("opacity", 1);

             bitsTooltip.text(`${jsonPayload.bits_used} Bits`)
            .style("left", (15) + "px")
            .style("bottom", (15) + "px")
            .style("display", "block")
            .style("opacity", 1);
             
            // Reset fadeout
            clearTimeout(this.fadeTimer);

            // Show map and rotate to show highlighted country.
            focusGlobe.classList.add('opaque');

            this.fadeTimer = setTimeout(() => {
                focusGlobe.classList.remove('opaque');
            }, 5000);
        }
        
        svg.selectAll(".focused").classed("focused", focused = false);


    });

};

});

