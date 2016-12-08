/* global initKey, initKey2, L, basePath, moment, baseURL, title */

var shariffDiv;

// JSON-Speicher
var pdata;	// Daten aus pdata.json
var events;	// Daten aus events.json
var calendar;	// Daten aus calendar.json
var plzdata;	// Daten aus plz.json
var kreiskeys = [];	// Zuordnung Kreisschlüssel->Gruppen
var slugToGruppe = {};	// Zuordnung Kreis-Slug -> Gruppennr
var slugToTreffen = {};	// Zuordnung Gruppennr+Treffen-Slug -> Treffennr

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

// Status-Variablen
var popupOpen = false;	// Ist ein Popup geöffnet?
var popupToClose = false;	// Wird gesetzt, wenn ein Popup per Funktion geschlossen werden soll.
var infoOpen = false;	// Ist das Info-Panel geöffnet?
var infoData;	// Was ist im Info-Panel geöffnet?
var anGoing = false;	// Läuft gerade eine Animation?

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
    iconUrl: basePath + '/res/img/piratenicon.png',
    iconSize:     [24, 24], // size of the icon
    shadowSize:   [30, 20], // size of the shadow
    iconAnchor:   [12, 12], // point of the icon which will correspond to marker's location
    shadowAnchor: [10, 0],  // the same for the shadow
    popupAnchor:  [0, -15] // point from which the popup should open relative to the iconAnchor
});

// Moment() initialisieren
moment.locale('de');

/**
 * Info-Panel einblenden
 * @param {string} content - HTML-Content
 * @param {function()} [callbackEnd] - Callback-Funktion, wird nach der Animation aufgerufen
 * @param {function()} [callbackMid] - Callback-Funktion, wird während der Animation aufgerufen
 */
function showInfo ( content, callbackEnd = null, callbackMid = null ) {
    $("#infoc").css("display", "block");    // Info-Div einblenden
    anGoing = true; // Animation ist gestartet

    if (infoOpen === false) {   // Info-Panel war bisher geschlossen
        infoOpen = true;
        $("#infocontent").html(content);
        $("#infocontent").scrollTop(0);
        if (callbackMid !== null) callbackMid();
        if (screenState === "big") {		
            $("#info").show('slide', {"direction": 'right'}, 500, function() { if (callbackEnd !== null) callbackEnd(); anGoing = false; });	
        } else if (screenState === "smallportrait") {
            $("#info").show('slide', {"direction": 'down'}, 500, function() { if (callbackEnd !== null) callbackEnd(); anGoing = false; });		
            $("#common").animate({"height": "50px"}, 500);
            $("#common > #mainimgc").animate({"height": "50px"}, 500);
            $(".leaflet-bottom").animate({"bottom": infoSize}, 500);
        } else if (screenState === "smalllandscape") {
            $("#info").show('slide', {"direction": 'right'}, 500, function() { if (callbackEnd !== null) callbackEnd(); anGoing = false; });		
            $("#common").animate({"width": 0}, 500);
            $(".leaflet-left").animate({"left": 0}, 500);
        }
    } else {    // Info-Panel ist offen
        if (screenState === "big") {		
            $("#info").hide('slide', {"direction": 'right'}, 200, function() {$("#infocontent").html(content); $("#infocontent").scrollTop(0); $("#info").show('slide', {"direction": 'right'}, 200); if (callbackEnd !== null) callbackEnd(); anGoing = false; });		
        } else if (screenState === "smallportrait") {
            $("#info").hide('slide', {"direction": 'down'}, 200, function() {$("#infocontent").html(content); $("#infocontent").scrollTop(0); $("#info").show("slide", {"direction": 'down'}, 200); if (callbackEnd !== null) callbackEnd(); anGoing = false;  });		
        } else if (screenState === "smalllandscape") {
            $("#info").hide("slide", {"direction": 'right'}, 200, function() {$("#infocontent").html(content); $("#infocontent").scrollTop(0); $("#info").show("slide", {"direction": 'right'}, 200); if (callbackEnd !== null) callbackEnd(); anGoing = false;  });		
        }
    }
}

/**
 * Zeigt eine Gruppe im Info-Panel an
 * @param {number} key - Key der Gruppe
 * @param {number} [key2] - Key des Treffens
 * @param {function()} [callback] - Callback-Funktion, wird am Ende der Animation ausgeführt
 */
function showGruppe( key, key2 = undefined, callback = null ) {
    // Wenn passendes Panel bereits offen und richtiges Treffen ausgewählt: Nichts tun, außer Callback
    if (infoOpen === true && infoData !== undefined && infoData.key !== undefined && infoData.key === key && infoData.key2 === key2) { if (callback !== null) callback(); return; }

    // Wenn passendes Panel bereits offen und falsches Treffen ausgewählt: Richtiges Treffen auswählen, Shariff und Callback
    if (infoOpen === true && infoData !== undefined && key === infoData.key && key2 !== infoData.key2) {
        $(".treffenlink").removeClass("active");
        if (key2 !== undefined) {
            $("#treffen-" + key + "-" + key2).addClass("active");            
            initShariff(key, genLink([key, key2]), genTitle(key, key2));
        } else {
            initShariff(key, genLink([key]), genTitle(key));
        }
        infoData = {"key": key, "key2": key2};
        
        if (callback !== null) callback();
        return;
    }

    // Ansonsten

    // Aktiv-Klassen entfernen, Aktiv-Klasse zur Gruppe hinzufügen
    $(".activegroup").removeClass("active");
    $(".treffenlink").removeClass("active");
    $("#activegroup-" + key).addClass("active");

    var gruppe = pdata[key];

    // HTML erstellen
    var html_gruppe = "<h2>" + gruppe.name + "</h2>";
    if (gruppe.img !== undefined) {
            html_gruppe += "<img class=\"kreislogo\" src=\"" + basePath + "/data/img/" + gruppe.img + "\" alt=\"" + gruppe.name + "\">";
    }
    if (gruppe.text) html_gruppe += "<p class=\"text\">" + gruppe.text + "</p>";
    if (gruppe.homepage) html_gruppe += "<p><strong>Homepage:</strong><br><a href=\"" + gruppe.homepage + "\">" + gruppe.homepage + "</a></p>";
    if (gruppe.email) html_gruppe += "<p><strong>E-Mail:</strong><br><a href=\"mailto:" + gruppe.email + "\">" + gruppe.email + "</a></p>";
    html_gruppe += '<p><div class="shariff" id="shariff' + key + '"></div></p>';

    // Übersicht der Treffen
    if (pdata[key].treffen !== undefined) {
        html_gruppe += "<h3>Treffen</h3>";
        $.each( pdata[key].treffen, function( key2a, val ) {
            var exclass = "";
            if (key2 !== undefined && key2 === key2a) exclass = "active";
            html_gruppe += "<p><a data-key=\"" + key + "\" data-key2=\"" + key2a + "\" class=\"treffenlink " + exclass + "\" id=\"treffen-" + key + "-" + key2a + "\" href=\"" + genLink([key, key2a]) + "\"><strong>" + val.name + "</strong>";
            if (val.termin.text) html_gruppe += "<br>" +  val.termin.text;
            if (val.ort) html_gruppe += "<br>" +  val.ort;
            if (events !== undefined && events[key] !== undefined && events[key].treffen !== undefined && events[key].treffen[key2a] !== undefined) {
                    var datum = moment.unix(events[key].treffen[key2a]);
                    html_gruppe += "<br><small><em>Nächster Termin: " + datum.format("ddd, DD.MM.YYYY, HH:mm") + " Uhr</em></small>";
            }
            html_gruppe += "</a></p>";
        });
    }

    // Terminübersicht
    if (events && events[key] && events[key].ical) {
        html_gruppe += "<h3>Kommende Termine</h3>";
        $.each( events[key].ical, function( key, val ) {
            datum = moment.unix(val.start);
            datume = moment.unix(val.end);
            if (datume.isBefore(moment(), 'hour')) return true;
            html_gruppe += "<p><small>" + datum.format("ddd, DD.MM.YYYY, HH:mm") + " Uhr</small><br>";
            html_gruppe += val.title + "<br><small>" + val.location + "</small></p>";
        });
    }
    if (key2 === undefined) {
        showInfo(html_gruppe, function () { if (callback !== null) callback(); infoData = {"key": key}; }, function() { initShariff( key, genLink([key]), genTitle(key) ); });
    } else {
        showInfo(html_gruppe, function () { if (callback !== null) callback(); infoData = {"key": key, "key2": key2}; }, function() { initShariff( key, genLink([key, key2]), genTitle(key, key2) ); });
    }
}

/**
* Initialisiert Shariff im Info-Panel

 * @param {number} key
 * @param {string} url
 * @param {string} title
 */
function initShariff( key, url, title ) {
    setTimeout(function() { shariffDiv = new Shariff($("#shariff" + key), {"url":  url, "title": title, theme: "white", services: ["twitter", "facebook", "googleplus", "whatsapp", "threema", "info"]});}, 0);
}

/**
* Zeigt die PLZ-Suchergebnisse an, wenn nichts gefunden wurde

 * @param {string} name - Name des gesuchten Ortes
*/
function showEmpty( name ) {
    // Wenn richtiges Panel bereits geöffnet: Nichts machen.
    if (infoOpen === true && infoData !== undefined && infoData.plzname !== undefined && infoData.plzname === name) { return; }

    var html_empty = "<h2>Suchergebnis</h2><p class=\"text\">Im Bereich <strong>" + name + "</strong> sind aktuell leider keine aktiven Treffen.</p>";

    // NÄchstgelegene Treffen suchen
    var nextdist1 = 9999999;
    var nextdist2 = 9999999;
    var nexto1;
    var nexto2;
    $.each( treffenmarkers, function( key, val ) {
        var dist = map.distance(plzmarker.getLatLng(), val.marker.getLatLng());
        if (nextdist1 > dist) {
            nextdist2 = nextdist1;
            nextdist1 = dist;
            nexto2 = nexto1;
            nexto1 = val;
        } else if (nextdist2 > dist) {
            nextdist2 = dist;
            nexto2 = val;
        }			
    });
    html_empty += "<p class=\"text\">Die nächsten aktive Treffen sind diese:<ul>";
    html_empty += "<li><a data-key=\"" + nexto1.key + "\" data-key2=\"" + nexto1.key2 + "\" href=\"" + genLink([nexto1.key, nexto1.key2]) + "\">" + nexto1.name + "</a></li>";
    html_empty += "<li><a data-key=\"" + nexto2.key + "\" data-key2=\"" + nexto2.key2 + "\" href=\"" + genLink([nexto2.key, nexto2.key2]) + "\">" + nexto2.name + "</a></li>";
    html_empty += "</ul></p>Wenn du in " + name + " ein neues Treffen starten möchtest, wende dich bitte an <a href=\"mailto:vorstand@piraten-bzv-stuttgart.de\">vorstand@piraten-bzv-stuttgart.de</a>";
    showInfo(html_empty, function() { infoData = {"plzname" : name}; });
}

/**
 * Info-Panel schließen
 * @param {boolean} [nopanning] - Verhindert das Panning bei kleinen Bildschirmen
 */
function closeInfo(nopanning = false) {
    anGoing = true; // Animation läuft
    infoOpen = false;  
    infoData = {};

    // Aktiv-Klassen entfernen
    $(".activegroup").removeClass("active");
    $(".treffenlink").removeClass("active");

    if (screenState === "big") {
        // Info-Panel slide to right, Info-Panel leeren und ausblenden
        $("#info").hide('slide', {"direction": "right"}, 500, function() {$("#infocontent").html(""); $("#infoc").css("display", "none"); anGoing = false;});
    } else if (screenState === "smallportrait") {
        // Info-Panel slide to bottom, Info-Panel leeren und ausblenden
        $("#info").hide("slide", {"direction": 'down'}, 500, function() {$("#infocontent").html(""); $("#infoc").css("display", "none"); anGoing = false;});
        // Common-Panel vergrößern
        $("#common").animate({"height": commonSize}, 500);
        $("#common > #mainimgc").animate({"height": "75px"}, 500);
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
    $( "#plz" ).val(plz);   // Suchfeld füllen

    // Wenn PLZ-Daten noch nicht geladen wurden, erst laden und Funktion erneut aufrufen
    if (!plzdata) {
        $.getJSON( "/data/plz.json", function( data ) {
            plzdata = data;
            return startPLZ( plz );
        });
    } else if (plzdata[plz]) {
        var dat = plzdata[plz]; 
        plzmarker.setLatLng([dat.lat, dat.lon]).addTo(map);
        var key = "0" + dat.ags.toString().substr(0,4);
        plzmarker.plz = plz;
        if (kreiskeys[key] !== undefined) {
            // Gruppe zur Suche gefunden
            plzpopup.setContent("<strong>" + dat.name + "</strong>");
            showGruppe(kreiskeys[key]);
            repeatUntil(100, 5, function() { 
                if (pdata[kreiskeys[key]].layer !== undefined) {
                    map.fitBounds(pdata[kreiskeys[key]].layer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});
                } else {
                    map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});;
                }
                plzmarker.openPopup();
            });
        } else {
            // Keine Gruppe gefunden
            if (!plzpopup.isOpen()) closeAllPopups();
            plzpopup.setContent("<strong>" + dat.name + "</strong>");
            showEmpty( dat.name );
            repeatUntil(100, 5, function() { 
                map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});;
                plzmarker.openPopup();
            });
        }
        return true;
    }
    return false;
}

/**
 * Hauptansicht starten
 */
function startMain( ) {
    $(".activegroup").removeClass("active");    // Aktiv-Klassen entfernen
    $(".treffenlink").removeClass("active");
    
    // Karte an BzV anpassen
    map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLc, "paddingBottomRight" : pBRc});
    
    closeAllPopups();
    closeInfo(true);
}

/**
 * Gruppe starten
 * @param {number} key - key der Gruppe
 * @param {(boolean|Object.<L.LatLng, number>)} [zoom=false] - true für Zoom, L.LatLng&Zoom für setView
 * @param {function()} [callback] - Callback-Funktion, wird nach der Animation ausgeführt
 */
function startGruppe( key , zoom = false, callback = null) {
    // Karte anpassen
    if (zoom === true && pdata[key].layer !== undefined) {
        map.fitBounds(pdata[key].layer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});
    } else if (zoom.center !== undefined && zoom.zoom !== undefined) {
        map.setView(zoom.center, zoom.zoom);
    } else if (zoom === true) {
        map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});;
    }
    if (pdata[key].popup !== undefined) {
        // Wenn richtiges Popup nicht geöffnet, werden vorher alle anderen Popups geschlossen
        if (!pdata[key].popup.isOpen()) { closeAllPopups(); pdata[key].layer.openPopup(); }
    } else {
        closeAllPopups();
        // Wenn kein Popup vorhanden, wird die Karte bei kleinen Bildschirmen manuell verschoben
        if (infoOpen === false && screenState === "smallportrait") map.panBy([0, infoSize], {"duration": 0.5});
        if (infoOpen === false && screenState === "smalllandscape") map.panBy([infoSize, 0], {"duration": 0.5});
    }
    showGruppe( key, undefined, callback );
}

/**
 * Treffen starten
 * @param {number} key - key der Gruppe
 * @param {number} key2 - key des Treffens
 * @param {(boolean|Object.<L.LatLng, number>)} [zoom=false] - true für Zoom, L.LatLng&Zoom für setView
 * @param {function()} [callback] - Callback-Funktion, wird nach der Animation ausgeführt
 */
function startTreffen( key , key2, zoom = false, callback = null) {
    // Karte anpassen
    if (zoom === true && pdata[key].layer !== undefined) {
        map.fitBounds(pdata[key].layer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});
    } else if (zoom.center !== undefined && zoom.zoom !== undefined) {
        map.setView(zoom.center, zoom.zoom);
    } else if (zoom === true) {
        map.fitBounds(mainlayer.getBounds(), {"paddingTopLeft": pTLi, "paddingBottomRight" : pBRi});;
    }
    if (pdata[key].treffen[key2].popup !== undefined) {
        // Wenn richtiges Popup nicht geöffnet, werden vorher alle anderen Popups geschlossen
        if (!pdata[key].treffen[key2].popup.isOpen()) { closeAllPopups(); pdata[key].treffen[key2].marker.openPopup(); }
    } else {
        closeAllPopups();
        // Wenn kein Popup vorhanden, wird die Karte bei kleinen Bildschirmen manuell verschoben
        if (infoOpen === false && screenState === "smallportrait") map.panBy([0, infoSize], {"duration": 0.5});
        if (infoOpen === false && screenState === "smalllandscape") map.panBy([infoSize, 0], {"duration": 0.5});
    }
    showGruppe( key, key2, callback );	
}

/**
 * Neuen History-Eintrag hinzufügen und Titel setzen
 * @param {(Number|string)} key - key der Gruppe
 * @param {Number} key2 - key des Treffens
 * @param {boolean} replace - Wenn true, wird der aktuelle History-Eintrag ersetzt
 */
function setHash(key = undefined, key2 = undefined, replace = false) {
    if (key !== undefined && key2 !== undefined) var newhash = genLink([key, key2]); else newhash = genLink([key]);
    if (newhash.substr(1) !== window.location.pathname.substr(1) || replace === true) {
        var state = {"key": key, "key2": key2};
        if (replace === true) history.replaceState(state, null, newhash); else history.pushState(state, null, newhash);
        setTitle(key, key2);
    }
}

/**
 * Link generieren
 * @param {Array.number,Object.<number, number>),(Object.<String, number>)} keys - keys
  * @returns {String}  
 */
function genLink(keys) {
    if (keys === undefined) return baseURL + "/";
    if (keys.length === 2 && keys[0] !== undefined && keys[1] !== undefined) {
        if (keys[0] === "plz" && $.isNumeric(keys[1])) return baseURL + "/plz/" + keys[1]; else if (keys[0] === "plz") return baseURL + "/";
        var part1, part2;
        if (pdata[keys[0]].slug !== undefined) part1 = pdata[keys[0]].slug; else part1 = keys[0];		
        if (pdata[keys[0]] !== undefined && pdata[keys[0]].treffen !== undefined && pdata[keys[0]].treffen[keys[1]].slug !== undefined) part2 = pdata[keys[0]].treffen[keys[1]].slug; else part2 = keys[1];	
        return baseURL + "/" + part1 + "/" + part2;	
    } else if (keys.length === 1 && keys[0] !== undefined) {
        if (pdata[keys[0]].slug !== undefined) return baseURL + "/" + pdata[keys[0]].slug; else return baseURL + "/" + keys[0];		
    }

    return baseURL + "/" + keys.join("/");
}

/**
 * Website-Titel setzen
 * @param {(int|String)} key - key der Gruppe
 * @param {int} key2 - key des Treffens
 */
function setTitle(key = undefined, key2 = undefined) {
    document.title = genTitle(key, key2);
}

/**
 * Website-Titel generieren
 * @param {(int|string)} key - key der Gruppe
 * @param {int} key2 - key des Treffens
 * @returns {String}
 */
function genTitle(key = undefined, key2 = undefined) {
    if (key !== undefined && key2 === undefined) {
        if (pdata[key]) {
                return pdata[key].name + " – " + title;
        }
    } else if (key !== undefined && key2 !== undefined) {
        if (key === "plz" && $.isNumeric(key2)) {return "PLZ " + key2 + " – " + title;}
        return pdata[key].treffen[key2].name + " – " + pdata[key].name + " – " + title;
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
            $("#common > #mainimgc").css("height", "50px");
            $(".leaflet-bottom").css("bottom", infoSize + "px");
        } else {
            // Bei geschlossenem Info-Panel: Common-Panel vergrößern & Leaflet-Attribution verschieben
            $("#common").css("height", commonSize + "px");
            $("#common > #mainimgc").css("height", "75px");
            $(".leaflet-bottom").css("bottom", 0);
            $("#info").hide();
        }

        pTLc = [5, commonSize-50+5];
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

        if (infoOpen === false) $("#info").hide();

        $(".leaflet-left").css("left", commonSize + "px");

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
    popupOpen = true;
    popup.options.autoPanPaddingTopLeft = pTLi;
    popup.options.autoPanPaddingBottomRight = pBRi;
    popup.update();
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
}

/**
 * Wiederholt eine Funktion bei fehlerhafter Ausführung mit zeitlichem Abstand.
 * @param {type} timeout - Zeit zwischen den Auführungen
 * @param {type} maxTries - Maximale Anzahl der Versuche
 * @param {type} callback - Auszuführende Funktion
 * @param {type} [it] - Aktuelle Versuchsnummer
 */
function repeatUntil(timeout, maxTries, callback, it = 1) {
    if (it < maxTries) {
        try {
            callback();
        } catch (err) {
            setTimeout(function() { repeatUntil(timeout, maxTries, callback, ++it); }, timeout);
        }
    } else {
        callback();
    }
}

$( document ).ready(function start() {
    // Layout der Fenstergröße anpassen	
    initState();
    $(window).resize(function() { initState(); });

    // Map initialisieren
    map = L.map('mapid', {attributionControl: false });
    var osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var osmAttrib = 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
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
        setHash("plz", plzmarker.plz);	// Hash setzen
        startPLZ( plzmarker.plz , true );	// Aktion: PLZ suchen
    });  

    // Links umschreiben
    $(document).on("click", "a[data-key]:not([data-key2])", function() {
        var linko = $(this);
        startGruppe(linko.data("key"), true, function () {setHash(linko.data("key"));});
        return false;
    });
    $(document).on("click", "a[data-key][data-key2]", function() {
        var linko = $(this);
        startTreffen(linko.data("key"), linko.data("key2"), true, function () {setHash(linko.data("key"), linko.data("key2"));});
        return false;
    });

    // PData laden und verarbeiten
    $.getJSON( basePath + "/data/pdata.json", function( data ) {
        pdata = data;
        var html_activegroup = "<ul>";
        $.each( data, function( key, val ) {
            if (val.slug !== undefined) slugToGruppe[val.slug] = key; 			// Slug-Zuordnung
            html_activegroup += "<li><a data-key=\"" + key + "\" class=\"activegroup\" id=\"activegroup-" + key + "\" href=\"" + genLink([key]) + "\">" + val.name + "</a></li>";

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
                            setHash(key);	// Hash setzen
                            startGruppe(key, false);	// Aktion: Gruppe starten
                        });
                    }, style:gruppeStyle});
                    pdata[key].layer.addTo(map);
                }
            }

            // Treffen verarbeiten
            if (val.treffen !== undefined && val.treffen.length > 0) {
                var stt = {};
                $.each( val.treffen, function( key2, val2 ) {
                    if (val2.slug !== undefined) stt[val2.slug] = key2; // Zuordnung Gruppennr+Treffen-Slug -> Treffen
                    if (val2.lat !== undefined & val2.lon !== undefined) {
                        // Marker zu Karte hinzufügen
                        pdata[key].treffen[key2].marker = new L.marker([val2.lat, val2.lon], {icon: piratenIcon}).addTo(map);

                        // Marker in globalem Array zusammenfassen
                        var dm =  [];
                        dm.key = key;
                        dm.key2 = key2;
                        dm.name = val2.name;
                        dm.marker = pdata[key].treffen[key2].marker;
                        treffenmarkers.push(dm);

                        // Popup erstellen
                        var popUpContent = "<strong>" + val2.name + "</strong>";
                        if (val2.ort !== undefined) popUpContent += "<br>" + val2.ort;
                        pdata[key].treffen[key2].popup = new L.popup().setContent(popUpContent);
                        pdata[key].treffen[key2].marker.bindPopup(pdata[key].treffen[key2].popup);
                        pdata[key].treffen[key2].marker.on("click", function(e) {
                            if (anGoing === true) return;	// Abbrechen, wenn wereits eine Aktion läuft
                            startTreffen(key, key2, false);	// Hash setzen
                            setHash(key, key2);	// Aktion: Treffen starten
                        });
                    }

                });
                slugToTreffen[key] = stt;	// Zuordnung Gruppennr+Treffen-Slug -> Treffen
            }
        });
        html_activegroup += "</ul>";
        $("#activegroups").html(html_activegroup);	// Gruppenübersicht befüllen

        // Events (pro Gruppe) laden
        $.getJSON( basePath + "/gen/events.json", function( data ) {
            events = data;
        });

        // Gesamtkalender laden und verarbeiten
        $.getJSON( basePath + "/gen/calendar.json").done(function( data ) {
            calendar = data;
            var html_calendar = "";

            var adatum = moment(0);	// Datum des vorherigen Schleifendurchgangs
            var today = moment().startOf('day');	// Aktuelles Datum
            var tomorrow = moment().startOf('day').add(1, 'days');	// Morgiges Datum
            var count = 0;	// Schleifenzähler
            $.each( data, function( key, val ) {
                var datum = moment.unix(val.start);	// Event-Startdatumzeit
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

                // Mit Treffen verbinden, wenn möglich
                if (val.key !== undefined && val.key2 !== undefined && pdata[val.key] !== undefined && pdata[val.key].treffen[val.key2] !== undefined) {
                    html_calendar += "<a data-key=\"" + val.key + "\" data-key2=\"" + val.key2 + "\" href=\"" + genLink([val.key, val.key2])  + "\">";
                } else if (val.key !== undefined && pdata[val.key] !== undefined) {
                    html_calendar += "<a data-key=\"" + val.key + "\" href=\"" + genLink([val.key]) + "\">";
                } 
                html_calendar += "<small>" + datum.format("HH:mm") + " Uhr, " + pdata[val.key].name + "</small><br>" + val.title + "</a></li>";
            });
            html_calendar += "</ul>";
            $("#calendar").html(html_calendar);	// Kalender befüllen	

        }).fail(function() {
            $(".calendar").hide();
        });
        
        // Ansicht zu Beginn handeln
        if (initKey !== undefined && $.isNumeric(initKey) && initKey2 !== undefined && $.isNumeric(initKey2)) {
            repeatUntil(100, 5, function() { startTreffen(initKey, initKey2, true); });
            setHash(initKey,initKey2, true);
        } else if (initKey !== undefined && $.isNumeric(initKey)) {
            repeatUntil(100, 5, function() { startGruppe(initKey, true); });
            setHash(initKey, undefined, true);
        } else if (typeof initKey !== undefined && initKey === "plz" && initKey2 !== undefined && $.isNumeric(initKey2)) {
            if (startPLZ(initKey2)) {
                setHash("plz", initKey2, true);
            } else {
                repeatUntil(100, 5, function() { startMain(); });
                setHash(undefined, undefined, true);
            }
        } else {
            repeatUntil(100, 5, function() { startMain(); });
            setHash(undefined, undefined, true);
        }
        
        // PLZ-suche handeln
        $( "#plzform" ).submit(function( event ) {
            var plz = $( "#plz" ).val();	// PLZ aus Suchfeld abfragen
            if ($.isNumeric(plz)) {			
                setHash("plz", plz);	// Hash setzen
                if (startPLZ(plz)) {    // Aktion: PLZ suchen
                    $("#plz").get(0).setCustomValidity("");
                } else {
                    $("#plz").get(0).setCustomValidity("Die gesuchte PLZ wurde leider nicht gefunden.");
                    $("#plz").get(0).reportValidity();
                }
            }
          event.preventDefault();
          return false;
        });
        $("#plz").on("input", function( e ) {
            var val = $( "#plz" ).val();
            if (!$.isNumeric(val) && val !== "") {
                e.target.setCustomValidity("Eine PLZ besteht ausschließlich aus Ziffern.");
                $("#plz").get(0).reportValidity();
            } else {
                e.target.setCustomValidity("");
            }
        });
    });

    // Vor- und Zurück-Buttons handeln
    $(window).on('popstate',function(e){ 
        // Prüfen, ob State-Objekt vorhanden
        if (e.originalEvent.state === null) { setTitle(); startMain(); return; }

        key = e.originalEvent.state.key;
        key2 = e.originalEvent.state.key2;

        if ($.isNumeric(key)) {
            if (key2 !== undefined && $.isNumeric(key2)) {
                // Aktion: Treffen
                setTitle(key, key2);
                startTreffen(key, key2, {"center": e.originalEvent.state.center, "zoom": e.originalEvent.state.zoom});
            } else {
                // Aktion: Gruppe
                setTitle(key);
                startGruppe(key, {"center": e.originalEvent.state.mapCenter, "zoom": e.originalEvent.state.mapZoom});
            }
        } else if (key === "plz" && $.isNumeric(key2)) {
            // Aktion: PLZ suchen
            setTitle("plz", key2);
            startPLZ(key2);
        } else {
            setTitle();
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