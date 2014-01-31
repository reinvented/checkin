/*jslint jQuery:true*/
/*global $:false */

/*\
|*|  checkin.js
|*|
|*|  This single JavaScript file handles all of the interactivity for the 
|*|  Checkin app: it handles all the UI elements and manages the sending
|*|  and receiving of data to/from the Foursquare API.
\*/

/*\
|*|
|*|  Global variables defined.
|*|
\*/

var currentPosition     = false; // We use this to store the human-readable geolocation returned by the GPS.
var positionInterval    = false; // We store a a "watch ID" when we set up navigator.geolocation.watchPosition so that we can reference it later.
var highlightedVenue    = false; // Stores the venue <li> we're checking into so we can "unhighlight" it later.
var opencellidkey       = atob('NzI1OWMxNjJmMjU1ZTI1ZTI4OGM2ZTk5MWZlMTE1OTI=');
var mozillakey          = 'net.reinvented.checkin';

/*\
|*|
|*|  App kicks off here...
|*|
\*/

$(document).ready(function() {
    console.log("Device language setting is " + navigator.mozL10n.language.code);
    console.log("Setting language direction to " + navigator.mozL10n.language.direction);
    $("html").attr("dir",navigator.mozL10n.language.direction);
    updateStatus("Starting up");
});

/*\
|*|
|*|  When the app becomes visible after being "away" switched to a different app, turned off,
|*|  we refresh the list of Foursquare locations from the current position.
|*|
\*/

function handleVisibilityChange() {
    if (!document.hidden) {
        console.log("The app woke up! Refreshing.");
        $('#venue_list').hide();
        $('#venue_list').html('');
        if (localStorage.send_to_foursquare) {
            getMyLocation();
        }
    }
}

document.addEventListener("visibilitychange", handleVisibilityChange, false);

/*\
|*|
|*|  If Foursquare has already been set up, then find our current location, either
|*|  from the GPS or from Mozilla Location Services.
|*|
\*/

if ((localStorage.send_to_foursquare) && (typeof localStorage.foursquare_access_token != 'undefined'))  {
    console.log("Starting up: Foursquare enabled.");
    // We've already set up Foursquare, so hide the explanation on the settings screen.
    $("#explanation").hide();
    // Check the "Enable Foursquare" checkbox on the settings screen.

    $('#send_to_foursquare').slider();
    $('#send_to_foursquare').val("on").slider("refresh");
    
    getMyLocation();
        
}
else {
    window.localStorage.setItem("foursquare_access_token", '');
    window.localStorage.setItem("send_to_foursquare", false);
    $('#send_to_foursquare').slider();
    $('#send_to_foursquare').val("off").slider("refresh");
    console.log("Starting up WITHOUT Foursquare.");
    console.log("Opening settings.");
    // Show the setting screen.
    $.mobile.changePage( "#settings-view");
}

/*\
|*|
|*|  Get my location (somehow) and proceed...
|*|
\*/

function getMyLocation() {
    
    if (localStorage.get_location_by == "gps") {
        // Fire up the GPS...
        console.log("Firing up the GPS.");
        updateStatus("Waiting for GPS...");
        navigator.geolocation.getCurrentPosition(successGeolocation, errorNoGeolocation, { enableHighAccuracy: false, maximumAge: 600000 });
    }
    else if (localStorage.get_location_by == "mls") {
        getLocationFromMLS();
    }
    else if (localStorage.get_location_by == "oci") {
        getLocationFromOCI();
    }

}

/*\
|*|
|*|  Set the initial values on the settings screen from those saved previously.
|*|
\*/

if (localStorage.confirm_checkins) {
    console.log("Confirm checkins ON.");
    $('#confirm_checkins').slider();
    $('#confirm_checkins').val("on").slider("refresh");
}

if (localStorage.get_location_by) {
    if (localStorage.get_location_by == "gps") {
        $("#get_location_by_gps").attr('checked',true);
    }
    else if (localStorage.get_location_by == "mls") {
        $("#get_location_by_mls").attr('checked',true);
    }
    else if (localStorage.get_location_by == "oci") {
        $("#get_location_by_oci").attr('checked',true);
    }   
}
else {
    $("#get_location_by_gps").attr('checked',true);
    window.localStorage.setItem("get_location_by", 'gps');
}

/*\
|*|
|*|  Bind to UI elements.
|*|
\*/

/**
* Bind to a tap on a Foursquare venue. 
* Highlights it, and checks in to Foursquare.
*/
$("#venue_list").on('tap', "li", function() { 
    // We only allow checkins if they have enabled sending to Foursquare!
    if (localStorage.send_to_foursquare) {
        // We only proceed if we haven't *already* highlighted a venue.
        if ((!highlightedVenue) && (!localStorage.confirm_checkins)) {
            console.log("Tapped on a Foursquare venue: " + $(this).attr('id'));
            // Save the venue we just highlighted so we can unhighlight it later.
            highlightedVenue = this;
            // Highlight this venue by changing the background colour and class of the text.
            $(highlightedVenue).removeClass('normal').addClass('highlighted');
            $(highlightedVenue).children("p").removeClass('normal-venue').addClass('highlighted-venue');
            // Do the actual Foursquare checkin.
            checkintoFoursquare($(this).attr('id'));
        }
        else if ((!highlightedVenue) && (localStorage.confirm_checkins)) {
            console.log("Tapped on a Foursquare venue.");
            if (window.confirm(navigator.mozL10n.get("checkin-confirmation") + " " + $(this).attr('name') + '?')) {
                // Save the venue we just highlighted so we can unhighlight it later.
                highlightedVenue = this;
                // Highlight this venue by changing the background colour and class of the text.
                $(highlightedVenue).removeClass('normal').addClass('highlighted');
                $(highlightedVenue).children("p").removeClass('normal-venue').addClass('highlighted-venue');
                // Do the actual Foursquare checkin.
                checkintoFoursquare($(this).attr('id'));
            }
        }
    }
});

/**
* Bind to a tap on a Refresh button. 
* Reloads the list of Foursquare venues nearby.
*/
$('#refresh-btn').bind('click', function() {
    console.log("Tapped on Refresh button.");
    $('#venue_list').fadeOut();
    $('#venue_list').html('');
    if (localStorage.send_to_foursquare) {
        getMyLocation();
    }
});

/**
* Set the browser window size for the Foursquare OAuth authentication.
*/
$("#foursquare-view").on("pageshow", function(){
    $('#browser').height( $(window).height() ); // it will still respect your css, mine uses it up to 85%
    $('#browser').width( $(window).width() ); // as well as height
});

/**
* Bind to a change in the "Enable Foursquare" checkbox.
* If box is getting checked, then start authentication to Foursquare.
* If box is getting unchecked, then forget we ever knew about Foursquare.
*/
$('#send_to_foursquare').bind('change', function() {
    console.log("'Enable Foursquare' changed.");
    if ($("#send_to_foursquare").val() == 'on') {
        console.log("'Enable Foursquare' is checked now.");
        $.mobile.changePage( "#foursquare-view");
        getFoursquareAccessToken();
    }
    else {
        console.log("'Enable Foursquare' is NOT checked now.");
        window.localStorage.removeItem("send_to_foursquare");
        window.localStorage.removeItem("foursquare_access_token");
    }
});

/**
* Bind to a tap on a Save button on settings page.
* Moves back to the main app screen.
*/
$('#save-settings-btn').bind('click', function () {
    console.log("Tapped on Save Settings button.");

    if ($("#confirm_checkins").val() == 'on') {
        console.log("'Confirm checkins' is checked now.");
        window.localStorage.setItem("confirm_checkins", true);
    }
    else {
        console.log("'Confirm checkins' is NOT checked now.");
        window.localStorage.removeItem("confirm_checkins");
    }

    var get_location_by = $('input:radio[name=get_location_by]:checked').val();

    if (get_location_by == 'mls') {
        window.localStorage.setItem("get_location_by", "mls");  
      // If we currently had a watchPosition setup, then clear it.
        console.log("Turning off the GPS.");
        if (positionInterval) {
            navigator.geolocation.clearWatch(positionInterval);
        }
    }
    else if (get_location_by == 'oci') {
        window.localStorage.setItem("get_location_by", "oci");  
      // If we currently had a watchPosition setup, then clear it.
        console.log("Turning off the GPS.");
        if (positionInterval) {
            navigator.geolocation.clearWatch(positionInterval);
        }
    }   
    else {
        window.localStorage.setItem("get_location_by", "gps");  
        console.log("Firing up the GPS.");
        navigator.geolocation.getCurrentPosition(successGeolocation, errorNoGeolocation, { enableHighAccuracy: false, maximumAge: 600000 });
    }
    
    $.mobile.changePage( "#list-view");
    
    if (localStorage.send_to_foursquare) {
        $('#venue_list').fadeOut();
        $('#venue_list').html('');
        getMyLocation();
    }
});


/*\
|*|
|*|  Foursquare API calls.
|*|
\*/

/**
* Get a Foursquare OAuth access token.
* See Foursquare Connect documentation at https://developer.foursquare.com/overview/auth
*/
function getFoursquareAccessToken() {

    console.log("Getting a Foursquare OAuth access token.");

    //-----------------------------------------------------------------------
    // This is a Foursquare OAuth "Client ID".
    //-----------------------------------------------------------------------
    // You can get one by visiting the "My Apps" page on the Foursquare
    // developer website (https://foursquare.com/developers/apps) and
    // defining an "app".
    var client_id = 'RQDIJSO52A50Q0UKD3RWXFD2LXOFYSS5IPHKP1XOVPP12ZZO';

    //-----------------------------------------------------------------------
    // This is a Foursquare OAuth "Redirect URI".
    //-----------------------------------------------------------------------
    // You specify this when you define a new "app" on the Foursquare
    // developer website. Because we don't need to involve a server
    // in our OAuth process, we're using a "dummy" URI. We use a URL on
    // Foursquare.com simply to avoid confusion for others reading this
    // code who, if they saw a URI for a different server would think,
    // as I have, "why are they sending me to XXX.com"!?
    var redirect_uri = 'https://foursquare.com/mobile';

    //-----------------------------------------------------------------------
    // This is the URL we're going to hit to get an "authorization token".
    //-----------------------------------------------------------------------
    // We send the "Client ID", the "Redirect URI" as parameters, as well
    // as a 'display' parameter to signal to Foursquare that we're on
    // a mobile device, and a 'response_type' token to tell Foursquare that
    // what we're looking for is a token.
    var auth_url = 'https://foursquare.com/oauth2/authenticate' +
                                '?client_id=' + client_id + 
                                '&redirect_uri=' + redirect_uri +
                                '&response_type=token' + 
                                '&display=touch';

    // Set the 'src' attribute of the embedded browser to the URL
    // we just built, which displays the Foursquare authorization page.
    console.log(auth_url);
    $('#browser').attr('src', auth_url);

    // Bind to the special 'mozbrowserlocationchange' event that fires when
    // the URL of the embedded browser changes, and look for the redirect_uri
    // at the start of the URL so we can tell if we got our authorization token.
    // If we did, then store the token, and update our first and last names from
    // the Foursquare API.
    document.getElementById('browser').addEventListener('mozbrowserlocationchange', function(e) {
      if (e.detail && (e.detail.indexOf(redirect_uri) === 0)) {
        console.log(e.detail);
        var result = parseTokens(e.detail);
        console.log(result);
        var tokens = JSON.stringify(result);
        console.log(tokens);
        $.mobile.changePage( "#settings-view");
        window.localStorage.setItem("foursquare_access_token", result['#access_token']);
        window.localStorage.setItem("send_to_foursquare", true);
        console.log("Received a Foursquare OAuth access token of: " + result['#access_token']);
      }
    }); 
}


/**
* Update the list of nearby Foursquare venues on the main app screen.
* See Foursquare API documentation at https://developer.foursquare.com/docs/venues/search
*/
function updateFoursquareVenues() {

    updateStatus("Looking for venues near<br>" + currentPosition);

    console.log("Updating the list of Foursquare venues.");

    if (localStorage.foursquare_access_token !== '') {
        var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});
        xhr.addEventListener("load", transferComplete, false);
        xhr.addEventListener("error", transferFailed, false);

        var geturl = "https://api.foursquare.com/v2/venues/search?oauth_token=" + localStorage.foursquare_access_token + "&ll=" + currentPosition + "&intent=checkin&v=20130629";
        xhr.open('GET', geturl, true);
        xhr.send();
    }

    function transferFailed(evt) {
        updateStatus("Foursquare error.<br>No venues found :-(");
        console.log("An error occurred transferring the data: " + evt);
    }

    function transferComplete() {
        if (xhr.status === 200 && xhr.readyState === 4) {
            var data = JSON.parse(xhr.response);
            hideStatus();
            $.each(data.response.venues, function(i,venue){
                console.log("Venue " + i);
                var content = '<li class="normal-venue" id="' + venue.id + '" name="' + venue.name + '">';
                if (typeof venue.categories[0] !== 'undefined') {
                    content += '<img class="venue_icon" src="' + venue.categories[0].icon.prefix + 'bg_88' + venue.categories[0].icon.suffix + '">';
                }
                else {
                    content += '<img class="venue_icon" src="style/icons/nocategory.png">';
                }
                content +=  '<p><b>' + venue.name + '</b><br><span class="venue_address">' + (venue.location.address || '') + '</span></p></li>';
                $(content).appendTo("#venue_list");
                $('#venue_list').listview('refresh'); 
                $('#venue_list').show();  
            });
                        
            console.log("List of Foursquare venues updated.");
        }
    }
}

/**
* Checkin to a Foursquare venue.
* See Foursquare API documentation at https://developer.foursquare.com/docs/checkins/add
*/    
function checkintoFoursquare(vid) {

    console.log("Checking in at a Foursquare venue.");

    if (localStorage.foursquare_access_token !== '') {
        var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});
        xhr.addEventListener("load", transferComplete, false);
        xhr.addEventListener("error", transferFailed, false);
        var geturl = "https://api.foursquare.com/v2/checkins/add?oauth_token=" + localStorage.foursquare_access_token + "&venueId=" + vid + "&ll=" + currentPosition + "&v=20130629";
        xhr.open('POST', geturl, true);
        xhr.send();
    }

    function transferFailed(evt) {
        console.log("An error occurred transferring the data: " + evt);
    }

    function transferComplete() {
        if (xhr.status === 200 && xhr.readyState === 4) {
            console.log("Foursquare checkin complete; showing status message.");
            showStatusMessage();
        }
    }
}    

/*\
|*|
|*|  Utility Functions
|*|
\*/

/**
* Show the "status message" on the main screen.
*/  
function showStatusMessage() {
    console.log("Displaying status message 'Checked in.'");
    $(highlightedVenue).removeClass('highlighted').addClass('normal');
    $(highlightedVenue).children("p").removeClass('highlighted-venue').addClass('normal-venue');
    highlightedVenue = false;
    window.navigator.vibrate(200);
}
    
/**
* Utility function to parse OAuth authorization token out of a URL.
*/     
function parseTokens(url) {
    url = url.slice(url.lastIndexOf('?') + 1);
    url = url.replace('continue=%2Fmobile','');
    var result = {};

    url.split('&').forEach(function(parts) {
        parts = parts.split('=');
        result[parts[0]] = parts[1];
    });
    return result;
} 

/*\
|*|
|*|  Geolocation callbacks.
|*|
\*/

/**
* Get current location from Mozilla Location Services.
*/
function getLocationFromMLS() {

    updateStatus("Getting Location from<br>Mozilla Location Services");

    var conn = window.navigator.mozMobileConnection;
    
    if (typeof conn != 'undefined') {
        console.log(conn);

        var item = {
            radio: "gsm",
            cell: [
                {
                    radio: "gsm", // hard-coding this because "conn.voice.type" returns 'hspa', which is rejected by Mozilla
                    mcc: conn.voice.network.mcc,
                    mnc: conn.voice.network.mnc,
                    lac: conn.voice.cell.gsmLocationAreaCode,
                    cid: conn.voice.cell.gsmCellId,
                    signal: conn.voice.signalStrength
                }
            ]
        };

        updateStatus("Getting Location from Cell<br>" + conn.voice.network.mcc + "/" + conn.voice.network.mnc + "/" + conn.voice.cell.gsmCellId);

        var itemsPost = JSON.stringify(item);

        console.log("Payload: " + itemsPost);

        var url = "https://location.services.mozilla.com/v1/search?key=" + mozillakey;
                
        var extraheaders = [
                [ 'X-Nickname', localStorage.mozilla_nickname ],
                [ 'Content-Type', 'application/json' ] 
        ];

        console.log("Fetching location from Mozilla.");
        
        // Set up an XMLHttpRequest
        var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 204)) {
                var data = JSON.parse(xhr.response);
                if (typeof data.lat != 'undefined') {
                    currentPosition = data.lat + ","  + data.lon;
                    updateStatus("Found location of<br>" + currentPosition);
                    updateFoursquareVenues();
                    console.log(data);
                }
                else {
                    console.log("LOCATION ERROR");
                    console.log(data);
                    updateStatus("Could not get location from<br>" + conn.voice.network.mcc + "/" + conn.voice.network.mnc + "/" + conn.voice.cell.gsmCellId,'#f66');
                }
            }
            else if (xhr.readyState == 4 && xhr.status == 400) {
                console.log("Error sending to " + url);
                console.log("statusText=" + xhr.statusText);
                console.log("responseText=" + xhr.responseText);
            }
        };

        xhr.open('POST', url, true);
        if (extraheaders) {
            extraheaders.forEach(function(entry) {
                xhr.setRequestHeader(entry[0],entry[1]);
            });
        }   
    
        xhr.send(itemsPost);
    }
}

/**
* Get current location from OpenCellID.org
*/
function getLocationFromOCI() {

    updateStatus("Getting Location from<br>OpenCellID.org");

    var conn = window.navigator.mozMobileConnection;
    
    if (typeof conn != 'undefined') {
        console.log(conn);

        updateStatus("Getting Location from Cell<br>" + conn.voice.network.mcc + "/" + conn.voice.network.mnc + "/" + conn.voice.cell.gsmCellId);

        var url = "http://www.opencellid.org/cell/get?key=" + opencellidkey + "&cellid=" + conn.voice.cell.gsmCellId + "&lac=" + conn.voice.cell.gsmLocationAreaCode + "&mcc=" + conn.voice.network.mcc + "&mnc=" + conn.voice.network.mnc;

        console.log("Fetching location from OpenCellID.org");
        
        // Set up an XMLHttpRequest
        var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 204)) {
                console.log(xhr.response);
                var $xml = $(xhr.response);
                currentPosition = $xml.find('cell').attr('lat') + ","  + $xml.find('cell').attr('lon');
                updateStatus("Found location of<br>" + currentPosition);
                updateFoursquareVenues();
                console.log(xhr.response);
            }
            else if (xhr.readyState == 4 && xhr.status == 400) {
                console.log("Error sending to " + url);
                console.log("statusText=" + xhr.statusText);
                console.log("responseText=" + xhr.responseText);
            }
        };

        xhr.open('GET', url, true);
        
        xhr.send();
    }
}

/**
* Success callback for geolocation. This gets called when the device learns its GPS position.
*/
function successGeolocation(position) {

    hideStatus();

    console.log("Got a GPS lock for the first time. Sending position to Foursquare.");

    // Used to display position on the main app screen, the latitude and longitude rounded to 3 decimal places.
    currentPosition = position.coords.latitude + ","  + position.coords.longitude;

    console.log("Updating list of FourSquare venues from successGeolocation.");
    updateFoursquareVenues();
    
    // If we currently had a watchPosition setup, then clear it.
    if (positionInterval) {
        navigator.geolocation.clearWatch(positionInterval);
    }
    // Set up a watchPosition to constantly poll the device for its location. On success updatePosition gets called.
    positionInterval = navigator.geolocation.watchPosition(updatePosition, noPositionFound, { enableHighAccuracy: false, maximumAge: 600000 });
}

/**
* Error callback for geolocation. Right now we do, well, nothing.
*/
function errorNoGeolocation() {
    console.log("An error occurred getting a GPS lock.");
}

/**
* Success callback for geolocation watchPosition. This gets called when the device updates its GPS position.
*/
function updatePosition(position) {
    console.log("Updating GPS position.");

    var accuracy = position.coords.accuracy;

    // Update the current position and update the main app screen.
    currentPosition = position.coords.latitude + ","  + position.coords.longitude;

    if (accuracy <= 5000) { 

        // Go back to the main app screen, remove the "waiting for gps" screen.
        $('#waiting-view').removeClass('move-up');
        $('#waiting-view').addClass('move-down');

        // Used to display position on the main app screen, the latitude and longitude rounded to 3 decimal places.
        currentPosition = position.coords.latitude + ","  + position.coords.longitude;
        
    }
    else {
        var d = new Date(position.timestamp);
        $('#gps-accuracy').html(d.toLocaleString() + '<br>Location: ' + position.coords.latitude.toFixed(2) + ","  + position.coords.longitude.toFixed(2) + "<br>Accuracy: " + parseInt(accuracy/1000) + " km");
    }

}

/**
* Error callback for geolocation watchPosition. Right now we do, well, nothing.
*/
function noPositionFound() {
    console.log("An error occurred getting updated GPS position.");
}

function updateStatus(message,colour) {
    if (typeof colour == 'undefined') {
        $("#status").css("background","#666");
    }
    else {
        $("#status").css("background",colour);
    }
    $("#status").show();
    $("#status").html("<p>" + message + "</p>");
}

function hideStatus() {
    $("#status").hide();
}
