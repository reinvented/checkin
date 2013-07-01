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

var currentPosition = false; // We use this to store the human-readable geolocation returned by the GPS.
var positionInterval = false; // We store a a "watch ID" when we set up navigator.geolocation.watchPosition so that we can reference it later.
var highlightedVenue = false; // Stores the venue <li> we're checking into so we can "unhighlight" it later.

/*\
|*|
|*|  App kicks off here...
|*|  If we've already set up Foursquare, then starting the GPS and starting pinging.
|*|  As well, check the box on the settings page, and get our name from Foursquare API.
|*|
\*/

if (localStorage.send_to_foursquare) {
	// We've already set up Foursquare, so hide the explanation on the settings screen.
	$("#explanation").hide();
	// Check the "Enable Foursquare" checkbox on the settings screen.
	$("#send_to_foursquare").attr('checked',true);
	// Show the "waiting for GPS" screen, because getting a GPS lock might take awhile.
	$('#waiting-view').removeClass('move-down');
	$('#waiting-view').addClass('move-up');
	// Fire up the GPS...
  navigator.geolocation.getCurrentPosition(successGeolocation, errorNoGeolocation, { enableHighAccuracy: true, maximumAge: 0 });
	// Update our name from Foursquare to update the settings page.
	updateFoursquareName();
}
else {
	// Show the setting screen.
	$('#settings-view').removeClass('move-down');
	$('#settings-view').addClass('move-up');
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
$("#main li").live('click', function(e) { 
	// We only proceed if we haven't *already* highlighted a venue.
	if (!highlightedVenue) {
		// Save the venue we just highlighted so we can unhighlight it later.
		highlightedVenue = this;
		// Highlight this venue by changing the background colour and class of the text.
		$(highlightedVenue).removeClass('normal').addClass('highlighted');
		$(highlightedVenue).children("p").removeClass('normal-venue').addClass('highlighted-venue');
		// Do the actual Foursquare checkin.
		checkintoFoursquare($(this).attr('id'));
	}
});

/**
* Bind to a tap on a Settings button. 
* Opens the settings screen.
*/
$('#settings-btn').bind('click', function() {
	$('#settings-view').removeClass('move-down');
	$('#settings-view').addClass('move-up');
});

/**
* Bind to a tap on a Refresh button. 
* Reloads the list of Foursquare venues nearby.
*/
$('#refresh-btn').bind('click', function() {
	$('#venue_list').html('');
	if (localStorage.send_to_foursquare) {
		updateFoursquareVenues();
	}
});

/**
* Bind to a change in the "Enable Foursquare" checkbox.
* If box is getting checked, then start authentication to Foursquare.
* If box is getting unchecked, then forget we ever knew about Foursquare.
*/
$('#send_to_foursquare').bind('change', function() {
  if ($("#send_to_foursquare").is(':checked')) {
		$('#foursquare-view').removeClass('move-down');
		$('#foursquare-view').addClass('move-up');
		getFoursquareAccessToken();
	}
	else {
		window.localStorage.removeItem("send_to_foursquare");
		window.localStorage.removeItem("foursquare_access_token");
		$("#explanation").show();
		$("#foursquare_name").html('');
	}
});

/**
* Bind to a tap on a Close button on settings page.
* Moves back to the main app screen.
*/
$('#close-settings-btn').bind('click', function () {
    $('#settings-view').removeClass('move-up');
    $('#settings-view').addClass('move-down');
});

/**
* Bind to a tap on a Close button on Foursquare page.
* Moves back to the main app screen.
*/
$('#close-btn').bind('click', function () {
    $('#foursquare-view').removeClass('move-up');
    $('#foursquare-view').addClass('move-down');
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

  //-----------------------------------------------------------------------
	// This is a Foursquare OAuth "Client ID".
  //-----------------------------------------------------------------------
	// You can get one by visiting the "My Apps" page on the Foursquare
	// developer website (https://foursquare.com/developers/apps) and
	// defining an "app".
	client_id = 'RQDIJSO52A50Q0UKD3RWXFD2LXOFYSS5IPHKP1XOVPP12ZZO';

  //-----------------------------------------------------------------------
	// This is a Foursquare OAuth "Redirect URI".
  //-----------------------------------------------------------------------
	// You specify this when you define a new "app" on the Foursquare
	// developer website. Because we don't need to involve a server
	// in our OAuth process, we're using a "dummy" URI. We use a URL on
	// Foursquare.com simply to avoid confusion for others reading this
	// code who, if they saw a URI for a different server would think,
	// as I have, "why are they sending me to XXX.com"!?
  redirect_uri = 'https://foursquare.com/mobile';

  //-----------------------------------------------------------------------
	// This is the URL we're going to hit to get an "authorization token".
  //-----------------------------------------------------------------------
	// We send the "Client ID", the "Redirect URI" as parameters, as well
	// as a 'display' parameter to signal to Foursquare that we're on
	// a mobile device, and a 'response_type' token to tell Foursquare that
	// what we're looking for is a token.
	auth_url = 'https://foursquare.com/oauth2/authenticate' +
								'?client_id=' + client_id + 
								'&redirect_uri=' + redirect_uri +
								'&response_type=token' + 
								'&display=touch';

	// Set the 'src' attribute of the embedded browser to the URL
	// we just built, which displays the Foursquare authorization page.
	$('#browser').attr('src', auth_url);

	// Bind to the special 'mozbrowserlocationchange' event that fires when
	// the URL of the embedded browser changes, and look for the redirect_uri
	// at the start of the URL so we can tell if we got our authorization token.
	// If we did, then store the token, and update our first and last names from
	// the Foursquare API.
	document.getElementById('browser').addEventListener('mozbrowserlocationchange', function(e) {
      if (e.detail && (e.detail.indexOf(redirect_uri) === 0)) {
		    $('#foursquare-view').removeClass('move-up');
		    $('#foursquare-view').addClass('move-down');
        var result = parseTokens(e.detail);
        var tokens = JSON.stringify(result);
        window.localStorage.setItem("foursquare_access_token", result[redirect_uri + '/#access_token']);
        window.localStorage.setItem("send_to_foursquare", true);
				updateFoursquareName();
      }
    }); 
}

/**
* Update our first and last name using the Foursquare API.
* See Foursquare API documentation at https://developer.foursquare.com/docs/users/users
*/
function updateFoursquareName() {
	if (localStorage.foursquare_access_token != '') {
		var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});
		xhr.addEventListener("load", transferComplete, false);
		xhr.addEventListener("error", transferFailed, false);
		var geturl = "https://api.foursquare.com/v2/users/self?oauth_token=" + localStorage.foursquare_access_token;
		console.log(geturl);
		xhr.open('GET', geturl, true);
		xhr.send();
	}

	function transferFailed(evt) {
		console.log("An error occurred transferring the data: " + evt);
	}

	function transferComplete(evt) {
		console.log(xhr.status);
		if (xhr.status === 200 && xhr.readyState === 4) {
			var data = JSON.parse(xhr.response);
			$("#foursquare_name").html(data.response.user.firstName + " " + data.response.user.lastName);
			$("#explanation").hide();
			$('#waiting-view').removeClass('move-down');
			$('#waiting-view').addClass('move-up');
		  navigator.geolocation.getCurrentPosition(successGeolocation, errorNoGeolocation, { enableHighAccuracy: true, maximumAge: 0 });
		}
	}
}

/**
* Update the list of nearby Foursquare venues on the main app screen.
* See Foursquare API documentation at https://developer.foursquare.com/docs/venues/search
*/
function updateFoursquareVenues() {
	if (localStorage.foursquare_access_token != '') {
		var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});
		xhr.addEventListener("load", transferComplete, false);
		xhr.addEventListener("error", transferFailed, false);
		var geturl = "https://api.foursquare.com/v2/venues/search?oauth_token=" + localStorage.foursquare_access_token + "&ll=" + currentPosition + "&intent=checkin&v=20130629";
		console.log(geturl);
		xhr.open('GET', geturl, true);
		xhr.send();
	}

	function transferFailed(evt) {
		console.log("An error occurred transferring the data: " + evt);
	}

	function transferComplete(evt) {
		if (xhr.status === 200 && xhr.readyState === 4) {
			$('#venue_list').html();
			var data = JSON.parse(xhr.response);
			$.each(data.response.venues, function(i,venues){
        content = '<li class="normal-venue" id="' + venues.id + '"><p>' + venues.name + '</p><p>' + (venues.location.address || '') + '</p></li>';
        $(content).appendTo("#venue_list");		
      });
    }
	}
}

/**
* Checkin to a Foursquare venue.
* See Foursquare API documentation at https://developer.foursquare.com/docs/checkins/add
*/    
function checkintoFoursquare(vid) {
	if (localStorage.foursquare_access_token != '') {
		var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});
		xhr.addEventListener("load", transferComplete, false);
		xhr.addEventListener("error", transferFailed, false);
		var geturl = "https://api.foursquare.com/v2/checkins/add?oauth_token=" + localStorage.foursquare_access_token + "&venueId=" + vid + "&ll=" + currentPosition + "&v=20130629";
		console.log(geturl);
		xhr.open('POST', geturl, true);
		xhr.send();
	}

	function transferFailed(evt) {
		console.log("An error occurred transferring the data: " + evt);
	}

	function transferComplete(evt) {
		if (xhr.status === 200 && xhr.readyState === 4) {
			var data = JSON.parse(xhr.response);
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
	$('#statusmessagetext').html("Checked in.");
	$('#statusmessage').show('slow');
	$(highlightedVenue).removeClass('highlighted').addClass('normal');
	$(highlightedVenue).children("p").removeClass('highlighted-venue').addClass('normal-venue');
	highlightedVenue = false;
	setTimeout(function() { $('#statusmessage').hide('slow'); },3000);
}
	
/**
* Utility function to parse OAuth authorization token out of a URL.
*/     
function parseTokens(url) {
	var url = url.slice(url.lastIndexOf('?') + 1);
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
* Success callback for geolocation. This gets called when the device learns its GPS position.
*/
function successGeolocation(position) {

	// Go back to the main app screen, remove the "waiting for gps" screen.
	$('#waiting-view').removeClass('move-up');
	$('#waiting-view').addClass('move-down');

	// Used to display position on the main app screen, the latitude and longitude rounded to 3 decimal places.
	currentPosition = position.coords.latitude + ","  + position.coords.longitude;
	updateFoursquareVenues();
	// If we currently had a watchPosition setup, then clear it.
	if (positionInterval) {
			navigator.geolocation.clearWatch(positionInterval);
	}
	// Set up a watchPosition to constantly poll the device for its location. On success updatePosition gets called.
	positionInterval = navigator.geolocation.watchPosition(updatePosition, noPositionFound, { enableHighAccuracy: true, maximumAge: 0 });
}

/**
* Error callback for geolocation. Right now we do, well, nothing.
*/
function errorNoGeolocation(error) {
}

/**
* Success callback for geolocation watchPosition. This gets called when the device updates its GPS position.
*/
function updatePosition(position) {
	// Update the current position and update the main app screen.
	currentPosition = position.coords.latitude + ","  + position.coords.longitude;
}

/**
* Error callback for geolocation watchPosition. Right now we do, well, nothing.
*/
function noPositionFound() {
}

