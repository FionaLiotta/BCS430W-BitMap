
import countryColor from './countryColor.mjs';

// Fetch Globe/Flat preference
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

const viewConfig = fetchConfig().MapType;
console.log("MapType: ", viewConfig);

var width = 225,
height = 225,
sens = 0.25,
focused,
option,
p;

//Setting projection

var projection = d3.geo.orthographic()
.scale(100)
.rotate([0, 0])
.translate([width / 2, height / 2])
.clipAngle(90);

var path = d3.geo.path()
.projection(projection);

//SVG container

var svg = d3.select("body").append("svg")
.attr("width", width)
.attr("height", height);

//Adding water

svg.append("path")
.datum({type: "Sphere"})
.attr("class", "water")
.attr("d", path);

var countryTooltip = d3.select("body").append("div").attr("class", "countryTooltip"),
bitsTooltip = d3.select("body").append("div").attr("class", "bitsTooltip"),
countryList = d3.select("body").append("select").attr("name", "countries");


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

    //Drag event
/*
    .call(d3.behavior.drag()
    .origin(function() { var r = projection.rotate(); return {x: r[0] / sens, y: -r[1] / sens}; })
    .on("drag", function() {
        var rotate = projection.rotate();
        projection.rotate([d3.event.x * sens, -d3.event.y * sens, rotate[2]]);
        svg.selectAll("path.land").attr("d", path);
        svg.selectAll(".focused").classed("focused", focused = false);
    }))

    //Mouse events
    
    .on("mouseover", function(d) {
    countryTooltip.text(countryById[d.id])
    .style("left", (d3.event.pageX + 7) + "px")
    .style("top", (d3.event.pageY - 15) + "px")
    .style("display", "block")
    .style("opacity", 1);
    })
    .on("mouseout", function(d) {
    countryTooltip.style("opacity", 0)
    .style("display", "none");
    })
    .on("mousemove", function(d) {
    countryTooltip.style("left", (d3.event.pageX + 7) + "px")
    .style("top", (d3.event.pageY - 15) + "px");
    });

    //Country focus on option select

    d3.select("select").on("change", function() {
    var rotate = projection.rotate(),
    focusedCountry = country(countries, this),
    p = d3.geo.centroid(focusedCountry);

    svg.selectAll(".focused").classed("focused", focused = false);

    //Globe rotating

    
    });
*/
    function country(cnt, sel) { 
    for(var i = 0, l = cnt.length; i < l; i++) {
        if(cnt[i].properties.name == sel) {return cnt[i];}
    }
    };

    

    // Twitch listening stuff
    var twitch = window.Twitch.ext;
    const body = document.querySelector('body');
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
            .style("bottom", (15) + "px")
            .style("display", "block")
            .style("opacity", 1);

            // Reset fadeout
            clearTimeout(this.fadeTimer);

            // Show map and rotate to show highlighted country.
            body.classList.add('opaque');
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
                body.classList.remove('opaque');
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
            body.classList.add('opaque');

            this.fadeTimer = setTimeout(() => {
                body.classList.remove('opaque');
            }, 5000);
        }
        
        svg.selectAll(".focused").classed("focused", focused = false);


    });

};


