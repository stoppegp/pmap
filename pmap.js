/* global L, basePath, moment, baseURL, title, initData */

var shariffDiv;

// JSON-Speicher
var pdata;	// Daten aus pdata.json
var events;	// Daten aus events.json
var calendar;	// Daten aus calendar.json
var plzdata;	// Daten aus plz.json
var kreiskeys = [];	// Zuordnung Kreisschlüssel->Gruppen
var slugToGruppe = {};	// Zuordnung Kreis-Slug -> Gruppennr
var slugToTreffen = {};	// Zuordnung Gruppennr+Treffen-Slug -> Treffennr
var orte = [];

// Layout-Variablen
var infoSize;	// Größe des Info-Panels
var commonSize;	// Grüße des Haupt-Panels
var screenState = "big";	// big, smallportrait, smalllandscape
var pTLc;	// Padding (TopLeft) bei ausgeblendetem Info-Panel
var pBRc;	// Padding (BottomRight) bei ausgeblendetem Info-Panel
var pTLi;	// Padding (TopLeft) bei eingeblendetem Info-Panel
var pBRi;	// Padding (BottomRight) bei eingeblendetem Info-Panel

// Leaflet-Variablen
var map;	// Map-Objekt
var mainlayer;	// BzV-Layer
var plzmarker;
var plzpopup;
var treffenmarkers = [];
var eventmarker;
var eventpopup;

// Status-Variablen
var popupOpen = false;	// Ist ein Popup geöffnet?
var popupToClose = false;	// Wird gesetzt, wenn ein Popup per Funktion geschlossen werden soll.
var infoOpen = false;	// Ist das Info-Panel geöffnet?
var infoData;	// Was ist im Info-Panel geöffnet?
var anGoing = false;	// Läuft gerade eine Animation?
var beforeFirstStart = true;

// Konstanten
var TYP_GRUPPE = 1;
var TYP_TREFFEN = 2;
var TYP_PLZ = 3;
var TYP_EVENT = 4;

var DEBUG_MODE = false;

// Leaflet-Styles
var mainStyle = {
    "color": "#ff7800",
	"fillOpacity": 0.1,
    "weight": 4,
    "opacity": 0.65
};
var gruppeStyle = {
    "color": "#ff7800",
    "weight": 5,
    "opacity": 0.65
};
var piratenIcon = L.icon({
    iconUrl: basePath + '/res/img/piratenicon-v1.png',
    iconSize:     [24, 24], // size of the icon
    shadowSize:   [30, 20], // size of the shadow
    iconAnchor:   [12, 12], // point of the icon which will correspond to marker's location
    shadowAnchor: [10, 0],  // the same for the shadow
    popupAnchor:  [0, -15] // point from which the popup should open relative to the iconAnchor
});

// Moment() initialisieren
moment.locale('de', {
    calendar : {
        lastDay : '[Gestern um] LT [Uhr]',
        sameDay : '[Heute um] LT [Uhr]',
        nextDay : '[Morgen um] LT [Uhr]',
        lastWeek : '[letzten] dddd [um] LT [Uhr]',
        nextWeek : 'dddd [um] LT [Uhr]',
        sameElse : 'LLLL [Uhr]'
    }
});

var today = moment().startOf('day');	// Aktuelles Datum

/**
 * Bei aktiviertem Debug-Modus in den Log schreiben
 * @param {string} text - Zu loggender Text
 */
function logDebug(text) {
    if (DEBUG_MODE === true) console.log(text);
}

/**
 * Info-Panel einblenden
 * @param {string} content - HTML-Content
 * @param {function()} [callbackEnd] - Callback-Funktion, wird nach der Animation aufgerufen
 * @param {function()} [callbackMid] - Callback-Funktion, wird während der Animation aufgerufen
 */
function showInfo ( content, callbackEnd, callbackMid) {
    
    // Funktionsparameter initialisieren
    if (typeof content !== "string") content = "";
    
    $("#infoc").css("display", "block");    // Info-Div einblenden
    anGoing = true; // Animation ist gestartet

    if (infoOpen === false) {   // Info-Panel war bisher geschlossen
        infoOpen = true;
        $("#infocontent").html(content);
        setTimeout(function() {$("#infocontent").scrollTop(0);}, 50);
        if (typeof callbackMid === "function") callbackMid();
        if (screenState === "big") {		
            $("#info").show('slide', {"direction": 'right'}, 500, function() { if (typeof callbackEnd === "function") callbackEnd(); anGoing = false; });	
        } else if (screenState === "smallportrait") {
            $("#info").show('slide', {"direction": 'down'}, 500, function() { if (typeof callbackEnd === "function") callbackEnd(); anGoing = false; });		
            $("#common").animate({"height": "50px"}, 500);
            $("#common #mainimgc img").animate({"height": "40px"}, 500);
            $(".leaflet-bottom").animate({"bottom": infoSize}, 500);
        } else if (screenState === "smalllandscape") {
            $("#info").show('slide', {"direction": 'right'}, 500, function() { if (typeof callbackEnd === "function") callbackEnd(); anGoing = false; });		
            $("#common").animate({"width": 0}, 500);
            $(".leaflet-left").animate({"left": 0}, 500);
        }
    } else {    // Info-Panel ist offen
        if (screenState === "big") {		
            $("#info").hide('slide', {"direction": 'right'}, 200, function() {$("#infocontent").html(content); if (typeof callbackMid === "function") callbackMid(); $("#infocontent").scrollTop(0); $("#info").show('slide', {"direction": 'right'}, 200); if (typeof callbackEnd === "function") callbackEnd(); anGoing = false; });		
        } else if (screenState === "smallportrait") {
            $("#info").hide('slide', {"direction": 'down'}, 200, function() {$("#infocontent").html(content); if (typeof callbackMid === "function") callbackMid(); $("#infocontent").scrollTop(0); $("#info").show("slide", {"direction": 'down'}, 200); if (typeof callbackEnd === "function") callbackEnd(); anGoing = false;  });		
        } else if (screenState === "smalllandscape") {
            $("#info").hide("slide", {"direction": 'right'}, 200, function() {$("#infocontent").html(content); if (typeof callbackMid === "function") callbackMid(); $("#infocontent").scrollTop(0); $("#info").show("slide", {"direction": 'right'}, 200); if (typeof callbackEnd === "function") callbackEnd(); anGoing = false;  });		
        }
    }
}

/**
 * Zeigt eine Gruppe im Info-Panel an
 * @param {number} typ - Typ der Anzeige
 * @param {number} data - Daten-Variable der Anzeige
 * @param {function()} [callback] - Callback-Funktion, wird am Ende der Animation ausgeführt
 */
function showGruppe( typ, data, callback ) {

    switch (typ) {
        case TYP_GRUPPE:
            // Funktionsparameter initialisieren
            if (typeof data === "undefined" || typeof data.gruppeId !== "number" || typeof pdata[data.gruppeId] === "undefined") return false;
            
            // Wenn passendes Panel bereits offen und kein Treffen ausgewählt: Nichts tun, außer Callback
            
            // Wenn passendes Gruppen-Panel bereits offen
            if (infoOpen === true && typeof infoData !== "undefined" && typeof infoData.typ !== "undefined" && typeof infoData.gruppeId === "number" && infoData.gruppeId === data.gruppeId) {
                // Wenn kein Treffen ausgewählt
                if (infoData.typ === TYP_GRUPPE) {
                    if (typeof callback === "function") callback();
                    return;
                } else {
                    $(".eventlink").removeClass("active");
                    initShariff(data.gruppeId, genLink(TYP_GRUPPE, {"gruppeId": data.gruppeId}), genTitle(TYP_GRUPPE, {"gruppeId": data.gruppeId}));
                    infoData = {"typ": TYP_GRUPPE, "gruppeId": data.gruppeId};

                    if (typeof callback === "function") callback();
                    return;
                }
            }
            
            break;
        case TYP_EVENT:
            // Funktionsparameter initialisieren
            logDebug(data);
            if (typeof data === "undefined" || typeof data.gruppeId !== "number" || typeof pdata[data.gruppeId] === "undefined") return false;
            if (typeof data.eventId === "undefined") return false;
            logDebug("TYP_EVENT");
            // Wenn passendes Gruppen-Panel bereits offen
            if (infoOpen === true && typeof infoData !== "undefined" && typeof infoData.typ !== "undefined" && typeof infoData.gruppeId === "number" && infoData.gruppeId === data.gruppeId) {
                logDebug("richtiges Panel offen");
                // Wenn richtiges Treffen ausgewählt
                if (infoData.typ === TYP_EVENT && typeof infoData.eventId !== "undefined" && infoData.eventId === data.eventId) {
                    logDebug("richtiges Event");
                    $("#event-" + data.gruppeId + "-" + data.eventId).focus();    
                    if (typeof callback === "function") callback();
                    return;
                } else {
                    logDebug("falsches Event");
                    $(".eventlink").removeClass("active");
                    $("#event-" + data.gruppeId + "-" + data.eventId).addClass("active").focus();            
                    initShariff(data.gruppeId, genLink(TYP_EVENT, {"gruppeId": data.gruppeId, "eventId": data.eventId}), genTitle(TYP_EVENT, {"gruppeId": data.gruppeId, "eventId": data.eventId}));
                    infoData = {"typ": TYP_EVENT, "gruppeId": data.gruppeId, "eventId": data.eventId};
                    
                    if (typeof callback === "function") callback();
                    return;
                }
            }
            break;
    }
    
    // Ansonsten

    // Aktiv-Klassen entfernen, Aktiv-Klasse zur Gruppe hinzufügen
    $(".activegroup").removeClass("active");
    $(".eventlink").removeClass("active");
    $("#activegroup-" + data.gruppeId).addClass("active");

    var gruppe = pdata[data.gruppeId];

    // HTML erstellen
    var html_gruppe = "<h2>" + gruppe.name + "</h2>";
    if (typeof gruppe.img === "string") {
            html_gruppe += "<img class=\"kreislogo\" src=\"" + basePath + "/data/img/" + gruppe.img + "\" alt=\"" + gruppe.name + "\">";
    }
    if (typeof gruppe.text === "string") html_gruppe += "<p class=\"text\">" + gruppe.text + "</p>";
    if (typeof gruppe.homepage === "string") html_gruppe += "<p><strong>Homepage:</strong><br><a href=\"" + gruppe.homepage + "\">" + gruppe.homepage + "</a></p>";
    if (typeof gruppe.email === "string") html_gruppe += "<p><strong>E-Mail:</strong><br><a href=\"mailto:" + gruppe.email + "\">" + gruppe.email + "</a></p>";
    if (typeof gruppe.twitter === "string") html_gruppe += "<p><strong>Twitter:</strong><br><a href=\"https://twitter.com/" + gruppe.twitter + "\">@" + gruppe.twitter + "</a></p>";
    html_gruppe += '<p><div class="shariff" id="shariff' + data.gruppeId + '"></div></p>';

    // Terminübersicht
    if (typeof events !== "object") {
        events = {};
        $.each(calendar, function ( key, val ) {
            if (!$.isArray(events[val.key])) {
                events[val.key] = [];
            }
            val.eventId = key;
            events[val.key].push(val);
        });
    }

    if (typeof events === "object" && $.isArray(events[data.gruppeId])) {
        html_gruppe += "<div id=\"treffen\"><h3>Kommende Termine</h3><ul>";
        $.each( events[data.gruppeId], function( key3, val ) {
            var exclass = "";
            if (typ === TYP_EVENT && data.eventId == val.eventId) exclass = "active";
            datum = moment.unix(val.start);
            datume = moment.unix(val.end);
            if (datume.isBefore(moment(), 'hour')) return true;
            html_gruppe += "<li><a id=\"event-" + data.gruppeId + "-" + val.eventId + "\" " + genLinkData(TYP_EVENT, {"gruppeId": data.gruppeId, "eventId": val.eventId}) + " class=\"eventlink " + exclass + "\" href=\"" + genLink(TYP_EVENT, {"gruppeId": data.gruppeId, "eventId": val.eventId}) + "\"><small>" + datum.calendar() + "</small><br>";
            html_gruppe += val.title + "<br><span class=\"eventmore\"><span>" + val.description.replace("\n", "<br>", "g") + "<br></span></span><small>" + val.location + "</small></a></li>";
        });
        html_gruppe += "</ul>";
    }
    if (typ === TYP_GRUPPE) {
        showInfo(html_gruppe, function () { if (typeof callback === "function") callback(); infoData = {"typ": TYP_GRUPPE, "gruppeId": data.gruppeId}; $("#infocontent .active").focus(); }, function() { initShariff( data.gruppeId, genLink(TYP_GRUPPE, {"gruppeId": data.gruppeId}), genTitle(TYP_GRUPPE, {"gruppeId": data.gruppeId}) ); });
    } else if (typ === TYP_EVENT) {
        showInfo(html_gruppe, function () { if (typeof callback === "function") callback(); infoData = {"typ": TYP_EVENT, "gruppeId": data.gruppeId, "eventId": data.eventId}; $("#infocontent .active").focus(); }, function() { initShariff( data.gruppeId, genLink(TYP_EVENT, {"gruppeId": data.gruppeId, "eventId": data.eventId}), genTitle(TYP_EVENT, {"gruppeId": data.gruppeId, "eventId": data.eventId}) ); });
    }
}

/**
* Initialisiert Shariff im Info-Panel

 * @param {number} gruppeId
 * @param {string} url
 * @param {string} title
 */
function initShariff( gruppeId, url, title ) {
    // Funktionsparameter initialisieren
    if (typeof gruppeId !== "number") return false;
    if (typeof url !== "string") url = "";
    if (typeof title !== "string") title = "";
    
    setTimeout(function() { shariffDiv = new Shariff($("#shariff" + gruppeId), {"url":  url, "title": title, theme: "white", services: ["twitter", "facebook", "googleplus", "whatsapp", "threema", "info"]});}, 0);
}

/**
* Zeigt die PLZ-Suchergebnisse an, wenn nichts gefunden wurde

 * @param {string} name - Name des gesuchten Ortes
*/
function showEmpty( name, kreiskey = null ) {
    // Funktionsparameter initialisieren
    if (typeof name !== "string") name = "";
    
    // Wenn richtiges Panel bereits geöffnet: Nichts machen.
    if (infoOpen === true && typeof infoData !== "undefined" && typeof infoData.plzname === "string" && infoData.plzname === name) { return; }

    if (typeof kreiskey == "number" && typeof pdata[kreiskey] !== "undefined") {
        
        var kreis = pdata[kreiskey];
        var html_empty = "<h2>Suchergebnis</h2><p class=\"text\">Im Bereich <strong>" + name + "</strong> sind Piraten aktiv!</p>";
        html_empty += "<p><a href=\"" + genLink(TYP_GRUPPE, {"gruppeId": kreiskey}) + "\"" + genLinkData(TYP_GRUPPE, {"gruppeId": kreiskey}) + "><strong>Zu den Piraten im " + kreis.name + "!</strong></a></p>";

    } else {

        var html_empty = "<h2>Suchergebnis</h2><p class=\"text\">Im Bereich <strong>" + name + "</strong> sind aktuell leider keine aktiven Treffen.</p>";
        html_empty += "<p>Wenn du in " + name + " ein neues Treffen starten möchtest, wende dich bitte an <a href=\"mailto:vorstand@piraten-bzv-stuttgart.de\">vorstand@piraten-bzv-stuttgart.de</a></p>";

    }

    html_empty += "<h3>Treffen in der Nähe</h3>";

    // NÄchstgelegene Treffen suchen
    var sortOrte = [];
    $.each( orte, function( key, val ) {
        console.log(val);		
        var dist = map.distance(plzmarker.getLatLng(), val.marker.getLatLng());
        console.log(dist);
        sortOrte.push({"dist": dist, "key": key});
    });
    sortOrte = sortOrte.sort(function (a, b) {
        return a.dist - b.dist;
    });
    console.log(sortOrte);
    
    var cOrt = 0;
    $.each(sortOrte, function (key, val) {
        var ort = orte[val.key];
        html_empty += "<p><strong>" + ort.ort + "</strong>, " + ort.strasse + "</p><ul>";
        var cEvent = 0;
        $.each(ort.events, function(key2, val2) {
            var event = calendar[val2];
            if (event.moment.isBefore(today)) return;
            var linkData = genLinkData(TYP_EVENT, {"gruppeId": event.key, "eventId": val2});
            var link = genLink(TYP_EVENT, {"gruppeId": event.key, "eventId": val2});
            html_empty += "<li>" +  event.moment.calendar() + ": <a href=\"" + link + "\" " + linkData + " >" + event.title + "</a></li>";
            if (++cEvent >= 3) return false;
        });
        html_empty += "</ul>";
        if (++cOrt >= 3 && (val.dist > 30000 || cOrt > 5)) return false;
    });
    
    showInfo(html_empty, function() { infoData = {"plzname" : name}; });
}

/**
 * Info-Panel schließen
 * @param {boolean} [nopanning] - Verhindert das Panning bei kleinen Bildschirmen
 */
function closeInfo(nopanning) {
    
    // Funktionsparameter initialisieren
    if (typeof nopanning !== "boolean") nopanning = false;
    
    anGoing = true; // Animation läuft
    infoOpen = false;  
    infoData = {};

    // Aktiv-Klassen entfernen
    $(".activegroup").removeClass("active");

    if (screenState === "big") {
        // Info-Panel slide to right, Info-Panel leeren und ausblenden
        $("#info").hide('slide', {"direction": "right"}, 500, function() {$("#infocontent").html(""); $("#infoc").css("display", "none"); anGoing = false;});
    } else if (screenState === "smallportrait") {
        // Info-Panel slide to bottom, Info-Panel leeren und ausblenden
        $("#info").hide("slide", {"direction": 'down'}, 500, function() {$("#infocontent").html(""); $("#infoc").css("display", "none"); anGoing = false;});
        // Common-Panel vergrößern
        $("#common").animate({"height": commonSize}, 500);
        $("#common #mainimgc img").animate({"height": "75px"}, 500);
        // Leaflet-Attribute nach unten schieben
        $(".leaflet-bottom").animate({"bottom": 0}, 500);
        // Karte verschieben
        if (!nopanning) map.panBy([0, -infoSize], {"duration": 0.5});
    } else if (screenState === "smalllandscape") {
        // Info-Panel slide to right, Info-Panel leeren und ausblenden	
        $("#info").hide("slide", {"direction": 'right'}, 500, function() {$("#infocontent").html(""); $("#infoc").css("display", "none"); anGoing = false;});
        // Common-Panel einblenden	
        $("#common").animate({"width": commonSize}, 500);
        // Leaflet-Attribute nach links schieben
        $(".leaflet-left").animate({"left": commonSize}, 500);
        // Karte verschieben
        if (!nopanning) map.panBy([-infoSize, 0], {"duration": 0.5});
    }

}

/**
 * PLZ-Suche starten
 * @param {number} plz - Postleitzahl
 */
function startPLZ( plz ) {
    // Funktionsparameter initialisieren
    if (typeof plz !== "number") return false;
    
    $( "#plz" ).val(plz);   // Suchfeld füllen

    // Wenn PLZ-Daten noch nicht geladen wurden, erst laden und Funktion erneut aufrufen
    if (!plzdata) {
        $.getJSON( "/data/plz.json", function( data ) {
            plzdata = data;
            startPLZ( plz );
        });
    } else if (plzdata[plz]) {
        $("#plz").get(0).setCustomValidity("");
        var dat = plzdata[plz]; 
        plzmarker.setLatLng([dat.lat, dat.lon]).addTo(map);
        var key = "0" + dat.ags.toString().substr(0,4);
        plzmarker.plz = plz;
        if (kreiskeys[key] !== undefined) {
            // Gruppe zur Suche gefunden
            if (!plzpopup.isOpen()) closeAllPopups();
            plzpopup.setContent("<strong>" + dat.name + "</strong>");
            showEmpty( dat.name , kreiskeys[key] );
            repeatUntil(function() { 
                map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});
                beforeFirstStart = false;
                plzmarker.openPopup();
            }, 100, 5);
        } else {
            // Keine Gruppe gefunden
            if (!plzpopup.isOpen()) closeAllPopups();
            plzpopup.setContent("<strong>" + dat.name + "</strong>");
            showEmpty( dat.name );
            repeatUntil(function() { 
                map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});
                beforeFirstStart = false;
                plzmarker.openPopup();
            }, 100, 5);
        }
    } else {
        $("#plz").get(0).setCustomValidity("Die gesuchte PLZ wurde leider nicht gefunden.");
        $("#plz").get(0).reportValidity();
        if (beforeFirstStart === true) {
            startMain();
            setHash();
            beforeFirstStart = false;
        }
    }
}

/**
 * Hauptansicht starten
 */
function startMain( ) {
    $(".activegroup").removeClass("active");    // Aktiv-Klassen entfernen
    
    // Karte an BzV anpassen
    map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLc, "paddingBottomRight" : pBRc});
    
    beforeFirstStart = false;
    
    closeAllPopups();
    closeInfo(true);
}

/**
 * Gruppe starten
 * @param {number} gruppeId - key der Gruppe
 * @param {(boolean|Object.<L.LatLng, number>)} [zoom=false] - true für Zoom, L.LatLng&Zoom für setView
 * @param {function()} [callback] - Callback-Funktion, wird nach der Animation ausgeführt
 */
function startGruppe( gruppeId, zoom, callback) {

    // Funktionsparameter initialisieren
    if (typeof gruppeId !== "number" || typeof pdata[gruppeId] === "undefined") { startMain(); return; }
    if (typeof zoom !== "boolean" && typeof zoom !== "object") zoom = false;
    
    // Karte anpassen
    if (zoom === true && typeof pdata[gruppeId].layer !== "undefined") {
        map.fitBounds(pdata[gruppeId].layer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});
    } else if (typeof zoom.center === "object" && typeof zoom.zoom === "number") {
        map.setView(zoom.center, zoom.zoom);
    } else if (zoom === true) {
        map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});;
    }
    
    beforeFirstStart = false;
    
    if (typeof pdata[gruppeId].popup !== "undefined") {
        // Wenn richtiges Popup nicht geöffnet, werden vorher alle anderen Popups geschlossen
        if (!pdata[gruppeId].popup.isOpen()) { closeAllPopups(); pdata[gruppeId].layer.openPopup(); }
    } else {
        closeAllPopups();
        // Wenn kein Popup vorhanden, wird die Karte bei kleinen Bildschirmen manuell verschoben
        if (infoOpen === false && screenState === "smallportrait") map.panBy([0, infoSize], {"duration": 0.5});
        if (infoOpen === false && screenState === "smalllandscape") map.panBy([infoSize, 0], {"duration": 0.5});
    }
    showGruppe(TYP_GRUPPE, {"gruppeId": gruppeId}, callback );
}


/**
 * Event starten
 * @param {number} gruppeId - key der Gruppe
 * @param {number} eventId - key des Events
 * @param {(boolean|Object.<L.LatLng, number>)} [zoom=false] - true für Zoom, L.LatLng&Zoom für setView
 * @param {function()} [callback] - Callback-Funktion, wird nach der Animation ausgeführt
 */
function startEvent( gruppeId , eventId, zoom, callback) {
    
    // Funktionsparameter initialisieren
    if (typeof gruppeId !== "number" || typeof pdata[gruppeId] === "undefined") { startMain(); return; }
    if (typeof eventId === "undefined") { startMain(); return; }
    if (typeof zoom !== "boolean") zoom = false;
    
    // Karte anpassen
    if (zoom === true && typeof pdata[gruppeId].layer !== "undefined") {
        map.fitBounds(pdata[gruppeId].layer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});
    } else if (typeof zoom.center === "object" && typeof zoom.zoom === "number") {
        map.setView(zoom.center, zoom.zoom);
    } else if (zoom === true) {
        map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});;
    }
    

    beforeFirstStart = false;
    
    closeAllPopups();

    dat = calendar[eventId];

    if (typeof calendar[eventId].location_key !== "undefined" && typeof orte[calendar[eventId].location_key].popup !== "undefined") {
        // Wenn richtiges Popup nicht geöffnet, werden vorher alle anderen Popups geschlossen
        orte[calendar[eventId].location_key].popup.setContent("<strong>" + dat.title + "</strong><br>" + dat.moment.calendar() + "<br>" + dat.location + "<p>" + dat.description + "</p>");
        if (!orte[calendar[eventId].location_key].popup.isOpen()) { closeAllPopups(); orte[calendar[eventId].location_key].marker.openPopup(); }
    } else {
        closeAllPopups();
        // Wenn kein Popup vorhanden, wird die Karte bei kleinen Bildschirmen manuell verschoben
        if (infoOpen === false && screenState === "smallportrait") map.panBy([0, infoSize], {"duration": 0.5});
        if (infoOpen === false && screenState === "smalllandscape") map.panBy([infoSize, 0], {"duration": 0.5});
    }

    
    showGruppe(TYP_EVENT, {"gruppeId": gruppeId, "eventId": eventId}, callback );	
}

/**
 * Neuen History-Eintrag hinzufügen und Titel setzen
 * @param {number} typ - Typ der Anzeige
 * @param {number} data - Daten-Variable der Anzeige
 * @param {boolean} replace - Wenn true, wird der aktuelle History-Eintrag ersetzt
 */
function setHash(typ, data, replace) {
    logDebug("setHash - " + typ);
    // Funktionsparameter initialisieren
    if (typeof replace !== "boolean") replace = false;  
    
    var newhash = genLink(typ, data);
    
    if (newhash.substr(1) !== window.location.pathname.substr(1) || replace === true) {
        var state = {"typ": typ, "data": data};
        if (replace === true) {
            history.replaceState(state, null, newhash);
        } else {
            history.pushState(state, null, newhash);
        }
        setTitle(typ, data);
    }
}

/**
 * Generiert eine Link-URL
 * @param {number} typ - Typ der Anzeige
 * @param {number} data - Daten-Variable der Anzeige
 * @returns {String}
 */
function genLink(typ, data) {
    if (typeof typ === "undefined") return baseURL + "/";
    if (typeof data === "undefined") return baseURL + "/";
    
    switch (typ) {
        case TYP_GRUPPE:
            if (typeof data.gruppeId !== "number") return baseURL + "/";
            if (pdata[data.gruppeId] !== undefined && pdata[data.gruppeId].slug !== undefined) return baseURL + "/" + pdata[data.gruppeId].slug; else return baseURL + "/" + data.gruppeId;	
            break;
        case TYP_EVENT:
            if (typeof data.gruppeId !== "number") return baseURL + "/";
            if (pdata[data.gruppeId] !== undefined && pdata[data.gruppeId].slug !== undefined) part1 = pdata[data.gruppeId].slug; else part1 = data.gruppeId;		
            if (data.eventId !== undefined && calendar[data.eventId] !== undefined && calendar[data.eventId].hash !== undefined)
                part2 = calendar[data.eventId].hash;
            else
                part2 = '';		
            return baseURL + "/" + part1 + "/" + part2;
            break;
    }
    
    return baseURL + "/";
}

/**
 * Generiert die JS-Daten für einen Link
 * @param {number} typ - Typ der Anzeige
 * @param {number} data - Daten-Variable der Anzeige
 * @returns {String}
 */
function genLinkData(typ, data) {
    switch (typ) {
        case TYP_GRUPPE:
            if (typeof data === "undefined" || typeof data.gruppeId !== "number") return "";
            return 'data-typ="' + TYP_GRUPPE + '" data-gruppeid="' + data.gruppeId + '"';
            break;
        case TYP_EVENT:
            if (typeof data === "undefined" || typeof data.gruppeId !== "number" || typeof data.eventId === "undefined") return "";
            return 'data-typ="' + TYP_EVENT + '" data-gruppeid="' + data.gruppeId + '" data-eventid="' + data.eventId + '"';
            break;
    }
    return "";
}

/**
 * Website-Titel setzen
 * @param {number} typ - Typ der Anzeige
 * @param {number} data - Daten-Variable der Anzeige
 */
function setTitle(typ, data) {
    logDebug("setTitle");
    document.title = genTitle(typ, data);
}

/**
 * Website-Titel generieren
 * @param {number} typ - Typ der Anzeige
 * @param {number} data - Daten-Variable der Anzeige
 * @returns {String}
 */
function genTitle(typ, data) {
    logDebug("genTitle - " + typ);
    logDebug(data);
    if (typeof typ === "undefined") return title;
    if (typeof data === "undefined") return title;
    
    switch (typ) {
        case TYP_GRUPPE:
            if (typeof data.gruppeId !== "number" || typeof pdata[data.gruppeId] === "undefined" || typeof pdata[data.gruppeId].name === "undefined") return title;
            return pdata[data.gruppeId].name + " – " + title;
            break;
        case TYP_EVENT:
            if (typeof data.gruppeId !== "number" || typeof pdata[data.gruppeId] === "undefined" || typeof pdata[data.gruppeId].name === "undefined" || typeof data.eventId !== "number" || typeof calendar[data.eventId] === "undefined") return title;
            return calendar[data.eventId].title + " – " + pdata[data.gruppeId].name + " – " + title;
            break;
        case TYP_PLZ:
            if (typeof data.plz !== "number") return title;
            return "PLZ " + data.plz + " – " + title;
    }

    return title;
}

/**
 * Passt das Layout der Bildschirmgröße an.
 */
function initState() {
    var w = $( window ).width();
    var h = $( window ).height();

    if (w<800 && h>=w) {
        // smallportrait
        // Common-Panel oben, Info-Panel unten. Common-Panel wird bei aktivem Info-Panel verkleinert.
        screenState = "smallportrait";
        $("body").removeClass("smalllandscape");
        $("body").addClass("smallportrait");
        infoSize = 0.55*h;
        commonSize = 0.45*h;

        $("#info").css({"height": infoSize + "px", "width": ""});
        $("#common").css({"width": ""});
        $("#commonc").css({"width": "", "height": ""});

        if (infoOpen === true) {
            // Bei geöffnetem Info-Panel: Common-Panel verkleinern & Leaflet-Attribution verschieben
            $("#common").css("height", "50px");
            $("#common #mainimgc img").css("height", "40px");
            $(".leaflet-bottom").css("bottom", infoSize + "px");
        } else {
            // Bei geschlossenem Info-Panel: Common-Panel vergrößern & Leaflet-Attribution verschieben
            $("#common").css("height", commonSize + "px");
            $("#common #mainimgc img").css("height", "75px");
            $(".leaflet-bottom").css("bottom", 0);
            $("#info").hide();
        }
        $(".leaflet-left").css("left", "0");
        pTLc = [5, commonSize+5];
        pBRc = [5, 5];
        pTLi = [5, 55];
        pBRi = [5, infoSize+5];
    } else if (w<800 && h<w) {
        // smalllandscape
        // Common-Panel links, Info-Panel rechts. Common-Panel wird bei aktivem Info-Panel ausgeblendet.
        screenState = "smalllandscape";
        $("body").removeClass("smallportrait");
        $("body").addClass("smalllandscape");
        commonSize = 300;
        infoSize = 300;

        $("#info").css({"width": infoSize + "px", "height": ""});
        $("#common").css({"height": ""});
        $("#commonc").css({"width": commonSize + "px", "height": ""});
        $("#common #mainimgc img").css("height", "");

        if (infoOpen === true) {
            // Bei geöffnetem Info-Panel: Common-Panel ausblenden & Leaflet-Attribution verschieben
            $("#common").css("width", "0px");
            $(".leaflet-left").css("left", 0);
        } else {
            // Bei geschlossenem Info-Panel: Common-Panel einblenden & Leaflet-Attribution verschieben
            $("#common").css("width", commonSize + "px");
            $(".leaflet-left").css("left", commonSize + "px");
            $("#info").hide();
        }
        $(".leaflet-bottom").css("bottom", "0");
        pTLc = [commonSize, 0];
        pBRc = [0, 0];
        pTLi = [0, 0];
        pBRi = [infoSize, 0];
    } else {
        // big
        // Common-Panel links, Info-Panel rechts.
        screenState = "big";
        $("body").removeClass("smallportrait");
        $("body").removeClass("smalllandscape");
        commonSize = w/5;
        if (commonSize < 250) commonSize = 250;
        infoSize = w/4;
        if (infoSize < 250) infoSize = 250;

        $("#info").css({"width": infoSize + "px", "height": ""});
        $("#common").css({"width": commonSize + "px", "height": ""});
        $("#commonc").css({"width": commonSize + "px", "height": ""});
        $("#common #mainimgc img").css("height", "");

        if (infoOpen === false) $("#info").hide();

        $(".leaflet-left").css("left", commonSize + "px");
        $(".leaflet-bottom").css("bottom", "0");

        pTLc = [$("#common").width(), 0];
        pBRc = [0, 0];
        pTLi = [$("#common").width(), 0];
        pBRi = [infoSize, 0];
    }
}
/**
 * Funktion wird ausgeführt, wenn ein Popup geöffnet wird.
 * popupOpen wird auf false gesetzt.
 * Das Popup wird mit den aktuellen Padding-Werten aktualisiert.
 * @param {L.Popup} popup - Das Popup-Objekt
 */
function onPopupAdd( popup ) {
    if (typeof popup === "object" && popup instanceof L.Popup) {
        popupOpen = true;
        popup.options.autoPanPaddingTopLeft = pTLi;
        popup.options.autoPanPaddingBottomRight = pBRi;
        popup.update();
    }
}

/**
 * Funktion wird ausgeführt, wenn ein Popup geschlossen wird.
 * Schließt das Info-Panel. Kurze Wartezeit um abzufragen, ob vorher
 * ein anderes Popup geöffnet wurde. popupOpen wird auf false gesetzt.
 * popupToClose wird abgefragt um festzustellen, ob das Popup per Funktionsaufruf
 * geschlossen wurde. In diesem Fall wird keine Aktion ausgeführt.
 */
function onPopupRemove() {
    if (popupToClose === true) {
            popupToClose = false;
            return;
    }
    popupOpen = false; 
    setTimeout(function() {
            if (popupOpen === false) {
                    closeInfo();
                    setHash();
            }
    }, 50);
}

/**
 * Schließt alle Popups, sofern welche geöffnet sind.
 */
function closeAllPopups() {
    if (popupOpen === false) return;
    popupToClose = true;
    map.closePopup();
    map.removeLayer(eventmarker);
}

/**
 * Wiederholt eine Funktion bei fehlerhafter Ausführung mit zeitlichem Abstand.
 * @param {function} callback - Auszuführende Funktion
 * @param {numer} [timeout=200] - Zeit zwischen den Ausführungen
 * @param {number} [maxTries=5] - Maximale Anzahl der Versuche
 * @param {number} [it=1] - Aktuelle Versuchsnummer
 */
function repeatUntil(callback, timeout, maxTries, it) {
    
    // Funktionsparameter initialisieren
    if (typeof callback !== "function") return false;
    if (typeof timeout !== "number") timeout = 200;
    if (typeof maxTries !== "number") maxTries = 5;
    if (typeof it !== "number") it = 1;
    
    if (it < maxTries) {
        try {
            callback();
        } catch (err) {
            logDebug(err);
            setTimeout(function() { repeatUntil(callback, timeout, maxTries, ++it); }, timeout);
        }
    } else {
        callback();
    }
}

function genSchema(title, location, startDate, url) {
    
    var el = document.createElement("script");
    el.type = 'application/ld+json';
    el.text = JSON.stringify({ "@context": "http://schema.org",  "@type": "Event", "name": title, "url": url, "startDate": startDate, "location": { "@type": "place", "address": location } });
    document.querySelector('body').appendChild(el);

}

$( document ).ready(function start() {
    // Layout der Fenstergröße anpassen	
    initState();
    $(window).resize(function() { initState(); });

    // Map initialisieren
    map = L.map('mapid', {attributionControl: false });
    var osmUrl = 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg';
    var osmAttrib = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.';
    var osm = new L.TileLayer(osmUrl, {minZoom: 6, maxZoom: 19, attribution: osmAttrib});		
    map.addLayer(osm);
    L.control.attribution({position: 'bottomleft'}).addTo(map);

    // Standard-Popup-Aktionen definieren
    map.on("popupclose", function(e) { onPopupRemove(); });
    map.on("popupopen", function(e) {  onPopupAdd(e.popup); });

    // BzV-Layer laden und auf Karte anzeigen
    mainlayer = new L.GeoJSON.AJAX(basePath + '/data/geojson/mainlayer.geojson', {style:mainStyle});
    mainlayer.addTo(map);

    // Marker & Popup für PLZ-Suche initialisieren
    plzmarker = new L.marker([0, 0]);
    plzpopup = new L.popup().setContent("");
    plzmarker.bindPopup(plzpopup);
    plzmarker.on("click", function() {
        plzmarker.openPopup();	// PLZ-Popup öffnent
        setHash(TYP_PLZ, {"plz": plzmarker.plz});	// Hash setzen
        startPLZ( plzmarker.plz , true );	// Aktion: PLZ suchen
    });  

    // Marker & Popup für Events initialisieren
    eventmarker = new L.marker([0, 0]);
    eventpopup = new L.popup().setContent("");
    eventmarker.bindPopup(eventpopup);
    eventpopup.on("remove", function() {
        map.removeLayer(eventmarker);
    });

    // Links umschreiben
    $(document).on("click", "a[data-typ="+ TYP_GRUPPE + "][data-gruppeid]", function() {
        var linko = $(this);
        startGruppe(linko.data("gruppeid"), true, function () {setHash(TYP_GRUPPE, {"gruppeId": linko.data("gruppeid")});});
        return false;
    });
    $(document).on("click", "a[data-typ="+ TYP_EVENT + "][data-gruppeid][data-eventid]", function() {
        var linko = $(this);
        logDebug("eventlink");
        startEvent(linko.data("gruppeid"), linko.data("eventid"), true, function () {setHash(TYP_EVENT, {"gruppeId": linko.data("gruppeid"), "eventId": linko.data("eventid")});});
        return false;
    });

    // PData verarbeiten
    var html_activegroup = "<ul>";
    $.each( pdata, function( key, val ) {
        if (val.slug !== undefined) slugToGruppe[val.slug] = key; 			// Slug-Zuordnung
        html_activegroup += "<li><a " + genLinkData(TYP_GRUPPE, {"gruppeId": key}) + " class=\"activegroup\" id=\"activegroup-" + key + "\" href=\"" + genLink(TYP_GRUPPE, {"gruppeId": key}) + "\">" + val.name + "</a></li>";

        if (val.gebiet !== undefined) {
            // Zurdnung Kreisschlüssel -> Gruppennr
            if (val.gebiet.typ !== undefined && val.gebiet.nr !== undefined && val.gebiet.typ === "kreis") {
                kreiskeys[val.gebiet.nr] = key;
            }
            // Layer zur Karte hinzufügen
            if (val.gebiet.geojson !== undefined) {
                pdata[key].layer = new L.GeoJSON.AJAX(basePath + "/data/geojson/" + val.gebiet.geojson + '.geojson', {onEachFeature: function initlayer(feature, layer) {
                    // Popup erstellen						
                    pdata[key].popup = new L.popup().setContent("<strong>" + val.name + "</strong>");
                    pdata[key].layer.bindPopup(pdata[key].popup);
                    pdata[key].layer.on("click", function(e) {
                        if (anGoing === true) return;	// Abbrechen, wenn wereits eine Aktion läuft
                        setHash(TYP_GRUPPE, {"gruppeId": key});	// Hash setzen
                        startGruppe(key, false);	// Aktion: Gruppe starten
                    });
                }, style:gruppeStyle});
                pdata[key].layer.addTo(map);
            }
        }
    });
    html_activegroup += "</ul>";
    $("#activegroups").html(html_activegroup);	// Gruppenübersicht befüllen

    $.getJSON( basePath + "/gen/orte.json", function( data ) {
        orte = data;

        $.each(orte, function( key, ort ) {
            orte[key].marker = new L.marker([ort.loc.lat, ort.loc.lng], {icon: piratenIcon}).addTo(map);
            // Popup erstellen
            var popUpContent = "<strong>";
            if (ort.name !== undefined) {
                popUpContent += ort.name + "</strong><br>";
            }
            popUpContent += ort.strasse;
            if (ort.nr !== undefined) {
                popUpContent += " " + ort.nr;
            }
            popUpContent += ", " + ort.ort + "<br>";
            orte[key].popup = new L.popup().setContent(popUpContent);
            orte[key].marker.bindPopup(orte[key].popup);
            orte[key].marker.on("click", function(e) {
                var today = moment().startOf('day');	// Aktuelles Datum
                var tomorrow = moment().startOf('day').add(1, 'days');	// Morgiges Datum
                var popUpContent = "<strong>";
                if (ort.name !== undefined) {
                    popUpContent += ort.name + "</strong><br>";
                }
                popUpContent += ort.strasse;
                if (ort.nr !== undefined) {
                    popUpContent += " " + ort.nr;
                }
                popUpContent += ", " + ort.ort + "<br>";
                $.each(ort.events, function (key, eventkey) {
                    if (calendar[eventkey].moment.isBefore(today, 'day')) {
                        return;
                    }
                    var datumstring = calendar[eventkey].moment.calendar();
                    var linkData = genLinkData(TYP_EVENT, {"gruppeId": calendar[eventkey].key, "eventId": eventkey});
                    var link = genLink(TYP_EVENT, {"gruppeId": calendar[eventkey].key, "eventId": eventkey});
                    popUpContent += "<p>" + datumstring + ":<br><strong><a " + linkData + " href=\"" + link + "\">" + calendar[eventkey].title + "</a></strong></p>";
                });
                orte[key].popup.setContent(popUpContent);
            });

        });

    });

    // Events laden
    $.getJSON( basePath + "/gen/calendar.json", function( data ) {

        calendar = data;

        var html_calendar = "";

        var adatum = moment(0);	// Datum des vorherigen Schleifendurchgangs

        var tomorrow = moment().startOf('day').add(1, 'days');	// Morgiges Datum
        var count = 0;	// Schleifenzähler
        $.each( data, function( key, val ) {
            var datum = moment.unix(val.start);	// Event-Startdatumzeit
            calendar[key].moment = datum;
            if (datum.isBefore(today)) return true;	// Vergangene Termine ignorieren
            // Tages-Überschriften erzeugen
            if (!datum.isSame(adatum, 'day')) {
                if (count !== 0) html_calendar += "</ul>";
                    var datumstring = "";
                    if (datum.isSame(today, 'day')) {
                        datumstring = "Heute";
                    } else if (datum.isSame(tomorrow, 'day')) {
                        datumstring = "Morgen";
                    } else {
                        datumstring = datum.format("dddd, D. MMMM");
                    }
                html_calendar += "<h3>" + datumstring + "</h3><ul>";
                count++;
            }
            adatum = datum;

            // Termin-Einträge
            html_calendar += "<li>";

            // Mit ICAL-Eintrag oder Treffen verbinden, wenn möglich
            if (val.key !== undefined && val.hash !== undefined && pdata[val.key] !== undefined) {
                var linkData = genLinkData(TYP_EVENT, {"gruppeId": val.key, "eventId": key});
                var link = genLink(TYP_EVENT, {"gruppeId": val.key, "eventId": key});
                genSchema(val.title, val.location, datum.format(), link);
            } else {
                var linkData = genLinkData(TYP_GRUPPE, {"gruppeId": val.key});
                var link = genLink(TYP_GRUPPE, {"gruppeId": val.key});
            } 
            html_calendar += "<a " + linkData  + " href=\"" + link + "\">";
            html_calendar += "<small>" + datum.format("HH:mm") + " Uhr, " + pdata[val.key].name + "</small><br>" + val.title + "</a></li>";
        });
        html_calendar += "</ul>";
        $("#calendar").html(html_calendar);	// Kalender befüllen

        // Ansicht zu Beginn handeln
        if (typeof initData !== "undefined" && typeof initData.typ !== "undefined") {
            if (initData.typ === TYP_GRUPPE && typeof initData.gruppeId === "number" && typeof pdata[initData.gruppeId] !== "undefined") {
                repeatUntil(function() { startGruppe(initData.gruppeId, true); }, 200, 5);
                setHash(TYP_GRUPPE, {"gruppeId": initData.gruppeId}, true);
            } else if (initData.typ === TYP_PLZ && typeof initData.plz === "number") {
                startPLZ(initData.plz);
                setHash(TYP_PLZ, {"plz": initData.plz}, true);
            } else if (initData.typ === TYP_EVENT && typeof initData.gruppeId === "number" && typeof pdata[initData.gruppeId] !== "undefined"
                && typeof initData.eventHash !== "undefined") {
                $.each(calendar, function (key2, val2) {
                    if (val2.hash == initData.eventHash) {
                        var eventId = key2;
                        repeatUntil(function() { startEvent(initData.gruppeId, eventId, true); }, 200, 5);
                        setHash(TYP_EVENT, {"gruppeId": initData.gruppeId, "eventId": eventId}, true);
                        return false;
                    }

                })
            } else {
                repeatUntil(function() { startMain(); }, 200, 5);
                setHash(undefined, undefined, true);
            }
        } else {
            repeatUntil(function() { startMain(); }, 200, 5);
            setHash(undefined, undefined, true);
        }

    }).fail(function() {
            $(".calendar").hide();
    });
    
    // PLZ-suche handeln
    $( "#plzform" ).submit(function( event ) {
        var plz = $( "#plz" ).val();	// PLZ aus Suchfeld abfragen
        if (plz !== "" && !isNaN(parseInt(plz))) {			
            setHash(TYP_PLZ, {"plz": parseInt(plz)});	// Hash setzen
            startPLZ(parseInt(plz));      // Aktion: PLZ suchen
        }
      event.preventDefault();
      return false;
    });
    $("#plz").on("input", function( e ) {
        var plz = $( "#plz" ).val();
        if (plz !== "" && isNaN(parseInt(plz))) {
            e.target.setCustomValidity("Eine PLZ besteht ausschließlich aus Ziffern.");
            $("#plz").get(0).reportValidity();
        } else {
            e.target.setCustomValidity("");
        }
    });

    // Vor- und Zurück-Buttons handeln
    $(window).on('popstate',function(e){ 
        // Prüfen, ob State-Objekt vorhanden
        if (e.originalEvent.state === null) { setTitle(); startMain(); return; }

        typ = e.originalEvent.state.typ;
        data = e.originalEvent.state.data;

        setTitle(typ, data);
        
        switch (typ) {
            case TYP_EVENT:
                startEvent(data.gruppeId, data.eventId, {"center": e.originalEvent.state.center, "zoom": e.originalEvent.state.zoom});
                break;
            case TYP_GRUPPE:
                startGruppe(data.gruppeId, {"center": e.originalEvent.state.mapCenter, "zoom": e.originalEvent.state.mapZoom});
                break;
            case TYP_PLZ:
                startPLZ(data.plz);
                break;
            default:
                startMain();
        }
    });

    // Klick auf das BzV-Logo handeln
    $("#homelink").click(function() {
        setHash();
        startMain();
        $("#commons").scrollTop(0);
        return false;
    });

    // Klick auf Info-Schließen handeln
    $("#closelink").click(function() {
        setHash();
        closeInfo();
        closeAllPopups();
        return false;
    });
});
