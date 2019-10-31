# BCS430W-BitMap
Senior Project for Farmingdale State College; a Twitch extension to display donations on a map or globe

Installing: 
* Contact Fiona with your Twitch ID; it needs to be registered as a tester
* Clone this repo to your machine
* Run `npm install` in its directory. 
* Make a text file called `.env` in the services/ directory and copy the values from the document in our shared drive to it.
* Open the BitMap.json file in the Twitch Developer Rig
* Change the back end and front end paths in the extension setup to point to the public and services directories.
* Create Extension Views in the twitch rig for the component and the config screen
* Log into the Azure portal, go to the TwitchAPI DB, select Set Server Firewall, Add client IP Address, then Save.
* Run BitMap\bin\generate_cert.cmd
* You should now be able to run the front and back end from the Twitch Rig without errors.
