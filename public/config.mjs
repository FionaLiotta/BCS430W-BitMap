import countryColor from './countryColor.mjs';
const form = document.querySelector("#countrySelect");

let html = '';

for (const index in countryColor)
{
    const {color, name} = countryColor[index]; 
    html += `<option value="${color}">${index} : ${name}</option>`
}

form.innerHTML = html;