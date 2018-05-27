"use strict";

var wxIframe = document.createElement("iframe");

function registerHandlers()
{
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

    wxRequest.open('GET', "/taf?icao=KSAT&time=now");
    wxRequest.send();
}

function autoFillWXResponseHandler()
{
    if(wxRequest.readyState === XMLHttpRequest.DONE && wxRequest.status === 200)
    {
        console.log("asdf");
        console.log(wxRequest.responseText);
        var myParser = new DOMParser();
        var myWxDOM = myParser.parseFromString(wxRequest.responseText, "text/xml");
        //console.log(wxRequest.responseText);
        var rawTAFText = myWxDOM.evaluate("//raw_text", myWxDOM, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent;
        var icao = myWxDOM.evaluate("//station_id", myWxDOM, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent;

        //display dialog
        var wxDialog = jQuery('<div></div>').html("I found this TAF for " + icao + ": <br /><b> " + rawTAFText + " </b><br /> Would you like me to add this WX to your card?") 
        .dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            title: "Add WX to card?",
            buttons: { "Yes": function(){
                addWXToCard(myWxDOM);
                jQuery(this).dialog("close");
            },
            Cancel: function(){
                jQuery(this).dialog("close");
            }
            }
        });
        
        //alert(rawTAFText.singleNodeValue.textContent);
        
        //extract relevant WX
        var curDate = new Date();
        var forecasts = myWxDOM.evaluate("//forecast", myWxDOM, null, XPathResult.ANY_TYPE, null);
    }
}

function addWXToCard(wxXml)
{


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
                formFreq = "141.25";
                break;
            case "TONG":
                formFreq = "142.25";
                break;
            case "SCUB":
                formFreq = "143.25";
                break;
            case "CANE":
                formFreq = "144.25";
                break;
            case "CASA":
                formFreq = "145.25";
                break;
            case "LYRE":
                formFreq = "146.25";
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
        chockField.value = myChockDate.getHours().toString().concat(myChockDate.getMinutes().toString());
    }
}

function loadCard()
{
    //display dialog
    //if local, load object from disk
    //if server-side, send xmlhttprequest and get data from server
    var jsonCardData = '{"frontPilot1" : "Doc"}';
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

function saveCard()
{
    //serialize all "userdata" class elements
    var userDataFields = document.getElementsByClassName("userdata");
    
    for(var i = 0; i < userDataFields; i++)
    {

    }

}

function printCard()
{

}

function sendORM()
{

}
