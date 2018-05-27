"use strict";

//Register event listeners for the datacard, also do some other setup.
function registerHandlers()
{
    //set up Wicked Good XPath (for IE11 XML DOM compatibility)
    wgxpath.install();
    
    var list = document.getElementsByClassName("missionCells");
    
    for(var i = 0; i < list.length; i++)
    {
        console.log("adding event to " + list[i].getAttribute("name"));
        list[i].addEventListener("keydown", gridKeyEvent, false);
    }
}

function gridKeyEvent (event) 
{
    console.log("event: " + event);   
    var key;
    var handled = false;
    var tabableCells = document.getElementsByClassName("missionCells");

    if(event.keyCode !== undefined)
    {
        key = event.keyCode;
        handled = true;
    }
    else if(event.keyIdentifier !== undefined)
    {
        key = event.keyIdentifier;
        handled = true;
    }
    else if(event.key !== undefined)
    {
        key = event.key;
        handled = true;
    }

    if(handled)
    {
        var curTab = document.activeElement.tabIndex;
        console.log("cur tab: " + curTab + " key pressed: " + key);
        
        if(curTab > 0 && curTab < 28 && ((key > 36 && key < 41) || key == 13))  
        {
            event.preventDefault();

            switch(key)
            {
                case 37: //left
                    curTab = curTab - 1;
                    break;
                case 38: //up
                    curTab = curTab - 5;
                    break;
                case 39: //right
                    curTab = curTab + 1;
                    break;
                case 40: //down
                    curTab = curTab + 5;
                    break;
                case 13: //enter
                    curTab = curTab + 5;
                    break;
            }

            console.log("new Tab: " + curTab);
            if(curTab < 0 || curTab > 27)
            {
                return;
            }
            else
            {
                for(var i = 0; i < tabableCells.length; i++)
                {
                    var curCell = tabableCells[i];

                    if(curCell.getAttribute("tabIndex") == curTab)
                    {
                        curCell.focus();

                        if(curCell.setSelectionRange && curCell.value !== undefined)
                        {
                            console.log("select range " + curCell.value.length);
                            curCell.setSelectionRange(0, curCell.value.length);
                            //curCell.select();
                        }
                        console.log("setting tab to: " + tabableCells[i].getAttribute("name"));
                    }
                }
            }
        }
        else
        {
            return;
        }
    }
}

var wxRequest;

function autoFillWX()
{
    console.log("auto fill");
    wxRequest = new XMLHttpRequest();

    if(!wxRequest)
    {
        alert('Unable to retrieve wx, sorry about that!');
        return false;
    }

    wxRequest.onreadystatechange = autoFillWXResponseHandler;
    //wxRequest.open('GET', "http://www.aviationweather.gov/dataserver/httpparam?datasource=tafs&requesttype=retrieve&format=xml&mostRecentForEachStation=constraint&stationString=KRND&hoursBeforeNow=0&timeType=valid", true);
    //TODO: use KRND's TAF, or better yet allow user to choose somehow. Consider parsing the sortie details and grabbing ICAOs.

    wxRequest.open('GET', "/services/getTAFXML?stations=KRND");
    wxRequest.send();
}

//TODO: fail gracefully if TAF service unavailable or if no TAFs published (use METAR instead?)
function autoFillWXResponseHandler()
{
    if(wxRequest.readyState === XMLHttpRequest.DONE && wxRequest.status === 200)
    {
        console.log("asdf");
        console.log(wxRequest.responseText);
        var myParser = new DOMParser();
        var myWxDOM = myParser.parseFromString(wxRequest.responseText, "text/xml");
        
        //Parse XML Response
        // TODO: work with JSON instead
        // Note: XPathResult not included by default on IE11, used Wicked Good XPath library instead.
        //
        var rawTAFText = myWxDOM.evaluate("//raw_text", myWxDOM, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent;
        var icao = myWxDOM.evaluate("//station_id", myWxDOM, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent;
        
        //extract relevant WX
        var takeoffDate = new Date();
        var takeoff = document.getElementById("schedTakeoff1").value;
        console.log("takeoff time on card: " + takeoff);
        var takeoffHour;
       
        if(jQuery.isNumeric(takeoff))
        {
            takeoffHour = takeoff.substring(0,4);
            takeoffDate.setHours(takeoffHour);
        }
        else
        {
            //If no takeoff time provided, assume two hours from now.
            // TODO: notify the user
            takeoffDate.setHours(takeoffDate.getHours() + 2);
        }
        
        console.log("Takeoff time: " + takeoffDate.toString());

        var forecasts = myWxDOM.evaluate("//forecast", myWxDOM, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var validTAFFound = false;
        
        //iterate through forecasts looking for one valid for our takeoff time
        //TODO: if there is another forecast valid for our time period, then either see which one the user wants on the card
        // OR pick the worst one.
        for(var k = 0; k < forecasts.snapshotLength; k++)
        {
            var thisForecast = forecasts.snapshotItem(k);
            var fcstFrom = new Date(thisForecast.getElementsByTagName("fcst_time_from")[0].childNodes[0].nodeValue);
            var fcstTo = new Date(thisForecast.getElementsByTagName("fcst_time_to")[0].childNodes[0].nodeValue);
            
            if(fcstFrom < takeoffDate && takeoffDate < fcstTo)
            {
                //sweet, this one is valid. extract the relevant WX data
                 
                console.log("using fcst_time_from: " + fcstFrom.toString());
                console.log("using fcst_time_to: " + fcstTo.toString());
            
                validTAFFound = true;
                
                var visElement = thisForecast.getElementsByTagName("visibility_statute_mi")[0];
                var windBearingElement = thisForecast.getElementsByTagName("wind_dir_degrees")[0];
                var windSpeedElement = thisForecast.getElementsByTagName("wind_speed_kt")[0];
                var windGustElement = thisForecast.getElementsByTagName("wind_gust_kt")[0];

                //ceiling has no child nodes, just attributes, but we need the LOWEST OVC or BKN layer, or the lowest SCT/FEW/SKC layer if those don't exist.
                var ceilingElements = thisForecast.getElementsByTagName("sky_condition");
                
                var ceilingRaw = "";
                var ceilingType = "";

                //This lets us compare the sky covers w/ <= without having to do a bunch of if/then for each condition 
                var ceilingEnum = {SKC : 0, FEW : 1, SCT : 1, BKN : 2, OVC : 2};

                for(var ces = 0; ces < ceilingElements.length; ces++)
                {
                    if(ceilingElements[ces].hasAttributes)
                    {
                        //TODO: iterate through the attributes to find the lowest ceiling
                        var attrs = ceilingElements[ces].attributes;

                        var thisCeilingType;        //set so that pretty much anything we find is a worse ceiling than this.
                        var thisCeilingRaw;       
                        
                        for(var ats = 0; ats < attrs.length; ats++)
                        {
                            if(attrs[ats].name == "sky_cover")
                            {
                                thisCeilingType = attrs[ats].value;
                            }
                            else if(attrs[ats].name == "cloud_base_ft_agl")
                            {
                                thisCeilingRaw = attrs[ats].value;
                            }

                            //once we get both the sky_cover and cloud_base we can decide if this is a worse ceiling than the one we already have.
                            
                            if(thisCeilingType && thisCeilingRaw)
                            {
                                if(!ceilingType && !ceilingRaw)     //nothing else used yet, so use this.
                                {
                                    ceilingType = thisCeilingType;
                                    ceilingRaw = thisCeilingRaw;
                                }else if(ceilingEnum[thisCeilingType] > ceilingEnum[ceilingType])    //if we go from SKC to FEW, or SCT to BKN, we use the worse one
                                {
                                    ceilingType = thisCeilingType;
                                    ceilingRaw = thisCeilingRaw;
                                }else if(ceilingEnum[thisCeilingType] == ceilingEnum[ceilingType] && thisCeilingRaw < ceilingRaw)  //lower cloud base wins
                                {
                                    ceilingType = thisCeilingType;
                                    ceilingRaw = thisCeilingRaw;
                                }

                                //eh, we already have a worse ceiling, try again.
                                thisCeilingRaw = null;
                                thisCeilingType = null;
                                
                            }
                        }
                    }
                }
                
                var vis = visElement? visElement.childNodes[0].nodeValue : "";
                var windBearing = windBearingElement? windBearingElement.childNodes[0].nodeValue : "";
                var windSpeed = windSpeedElement? windSpeedElement.childNodes[0].nodeValue : "";
                var windGust = windGustElement? windGustElement.childNodes[0].nodeValue : "";
               
                console.log("ceilingRaw: " + ceilingRaw);
                //hacky way to add leading zeroes to ceiling
                var ceiling = ceilingRaw.toString().substring(0, ceilingRaw.length-2);
                
                if(ceiling.length == 1){
                    ceiling = "00" + ceiling;
                }else if(ceiling.length == 2){
                    ceiling = "0" + ceiling;
                }
                
                console.log("vis: " + vis);
                console.log("windBearing: " + windBearing);
                console.log("windSpeed: " + windSpeed);
                console.log("windGust: " + windGust);                   
                console.log("ceiling: " + ceiling);
                console.log("ceilingType: " + ceilingType);
            }
        }

        windSpeed = Math.floor(windSpeed);
        vis = Math.floor(vis);

        var displayWinds = windGust != ""? windBearing + " " + windSpeed + "G" + windGust : windBearing + " " + windSpeed;
        var displayCeilingVis = ceilingType + ceiling + " " + vis + "SM";

        var myWxObject = { surfaceWinds : displayWinds, ceilingAndVis : displayCeilingVis };
        //TODO: get altitude winds, somehow

        //display dialog
        
        var wxDialog;
        if(validTAFFound)
        {
            wxDialog = jQuery('<div></div>').html("I found this TAF for " + icao + ": <br /><b> " + rawTAFText + " </b><br /><br /> Would you like me to add this WX to your card?");
        }
        else
        {
            wxDialog = jQuery('<div></div>').html("No valid TAFs found for " + icao + " at your takeoff time. Sorry!");
        }
        wxDialog.dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            title: "Add WX to card?",
            buttons: { "OK": function(){
                addWXToCard(myWxObject);
                jQuery(this).dialog("close");
            },
            Cancel: function(){
                jQuery(this).dialog("close");
            }
            }
        });
    }
}

function addWXToCard(myWxObject)
{
   document.getElementById("ceilingVis").value = myWxObject.ceilingAndVis;
   document.getElementById("surfaceWinds").value = myWxObject.surfaceWinds;
}

function autoFillFormFreq()
{
    //TODO: put the correct freqs in here
    //only do this if it doesn't already have something in it
    var field = document.getElementById("formFreq");
        
    if(field !== undefined && field.value.trim() === "")
    {
        var callsign = document.getElementById("callsign1").value;
        var formFreq = "";
        var callsignName = callsign.substring(0,4).toUpperCase();

        switch(callsignName)
        {
            case "PREY":
                formFreq = "139.27";
                break;
            case "JINX":
                formFreq = "141.05";
                break;
            case "ROUGH":
                formFreq = "141.02";
                break;
            case "TONG":
                formFreq = "139.57";
                break;
            case "SCUB":
                formFreq = "141.07";
                break;
            case "CANE":
                formFreq = "139.40";
                break;
            case "CASA":
                formFreq = "148.97";
                break;
            case "LYRE":
                formFreq = "141.42";
                break;
                
        }

        field.value = formFreq;
    }
}

/**
 * function getTakeoffTime(var time)
 * params: a four-character string with local military time (i.e. "1205")
 * returns: a Date object with that time set.
 */
function getTakeoffTime(timeString)
{
        var myDate = new Date();
        var takeoffHour = timeString.substring(0,2);
        var takeoffMinute = timeString.substring(2,4);

        //modify date w/ takeoff hour and minutes
        myDate.setHours(takeoffHour);
        myDate.setMinutes(takeoffMinute);

        return myDate;
}

function autoFillChock()
{
    var takeoffField = document.getElementById("schedTakeoff1");

    if(takeoffField !== undefined && takeoffField.value.trim() !== "")
    {
        var myDate = getTakeoffTime(takeoffField.value.trim());

        var onePlus45 = 45*60*1000 + 60*60*1000;    //45 minutes + 60 minutes (in milliseconds)
        var myChockDate = new Date(myDate.getTime() + onePlus45);

        var chockField = document.getElementById("chockTime");
        var chockMinutes = myChockDate.getMinutes() < 10 ? "0" + myChockDate.getMinutes() : myChockDate.getMinutes().toString();

        chockField.value = myChockDate.getHours().toString().concat(chockMinutes);
    }
}

function loadCard()
{
    //display dialog
    //if local, load object from disk
    //if server-side, send xmlhttprequest and get data from server
    var cardObj = JSON.parse(jsonCardData);

    for(var fieldName in cardObj)
    {
        var fieldElem = document.getElementsByName(fieldName);

        if(fieldElem.length > 0)
        {
            //just set first one
            fieldElem[0].value = cardObj[fieldName];
        }
    }
}

function loadCardResponseHandler()
{

}

//TODO: pass this so we don't keep it here as a global (also the wxRequest above)

function saveCard()
{
    //serialize all "userdata" class elements
    var userDataFields = document.getElementsByClassName("userdata");
    var dataCardObject = new Object();
    
    for(var i = 0; i < userDataFields.length; i++)
    {
        dataCardObject[userDataFields[i].id] = userDataFields[i].value;
    }

    console.log("Attempting to save datacard");

    console.log("datacard Object: " + JSON.stringify(dataCardObject));

    var saveRequest = new XMLHttpRequest();

    if(!saveRequest)
    {
        //TODO: offer option to save card locally.
        alert('Unable to save card to server, sorry about that!');
        return false;
    }

    saveRequest.onreadystatechange = function(){
        var saveDialog;

        if(saveRequest.readyState == XMLHttpRequest.DONE && saveRequest.status == 200)
        {
            saveDialog = jQuery('<div></div>').html("Datacard Saved");
        }
        else
        {
            saveDialog = jQuery('<div></div>').html("Unable to save datacard. Sorry!");
        }
        
        saveDialog.dialog({
                resizable: false,
                height: "auto",
                width: 400,
                modal: true,
                title: "success",
                buttons: { "OK": function(){
                    jQuery(this).dialog("close");
                },
                Cancel: function(){
                    jQuery(this).dialog("close");
                }
                }
            });
    }

    saveRequest.open('POST', "/services/saveCard");
    saveRequest.setRequestHeader('content-type', 'application/json; charset=UTF-8');
    saveRequest.send(JSON.stringify(dataCardObject));
}

function printCard()
{

}

function sendORM()
{

}
