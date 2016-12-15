<!DOCTYPE html>
<?php
    include('serverh.php'); // Server-Methoden einbinden
?>
<html id="html" class="nonjs">
<head>
<meta name="robots" content="noindex,nofollow">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<?php
    handleOG(); // Meta-Tags für Crawler generieren
?>
<title><?php echo PMAP_TITLE; ?></title>
<link rel="shortcut icon" type="image/x-icon" href="<?=getBase();?>/res/favicon-v1.ico" />
<link rel="stylesheet" href="<?=getBase();?>/res/leaflet-1.0.2/leaflet.css" />
<script src="<?=getBase();?>/res/jquery/jquery-3.1.1.min.js"></script>
<script src="<?=getBase();?>/res/jquery-ui-1.12.1.custom/jquery-ui.min.js"></script>
<script src="<?=getBase();?>/res/leaflet-1.0.2/leaflet.js"></script>
<script src="<?=getBase();?>/res/leaflet-1.0.2/leaflet.ajax.min.js"></script>
<script src="<?=getBase();?>/res/moment/moment-with-locales.js"></script>
<link rel="stylesheet" type="text/css" href="<?=getBase();?>/res/css/main-v1.css">
<link type="text/css" href="<?=getBase();?>/res/shariff-1.24.1/shariff.complete.css" rel="stylesheet">
<script type="text/javascript">
var initKey, initKey2;
document.getElementById("html").className = "js";
<?php getInitKeysJS(); ?>
var basePath = "<?=getBase();?>";
var baseURL = document.location.protocol + "//" + document.location.hostname + basePath;
var title = "<?php echo PMAP_TITLE; ?>";
</script>
</head>

<body>
<div id="common">
    <div id="commonc">
            <div id="mainimgc">
            <a href="/" id="homelink"><img alt="<?php echo PMAP_TITLE; ?>" src="<?=getBase();?>/data/img/logo.png"></a>
            </div>
            <div id="commons">
               <?php
                if (file_exists(dirname(__FILE__)."/data/text.html")) include(dirname(__FILE__)."/data/text.html");
               ?>
                <form id="plzform">
                    <input id="plz" type="text" placeholder="PLZ eingeben..." name="plz" size="10">
                    <button type="submit">PLZ Suchen</button>
                </form>
                <h2>Aktive Gruppierungen</h2>
                <div id="activegroups"></div>
                <h2 class="calendar" >Kalender&nbsp;<a href="<?=getBase();?>/gen/calendar.ics"><img src="<?=getBase();?>/res/img/calicon-v1.png" alt="Kalender abonnieren"></a></h2>
                <div class="calendar" id="calendar"></div>
            </div>
    </div>
</div>
<div id="mapid"></div>
<div id="info">
    <a id="closelink" href="/#!">✖</a>
    <div id="infocontent"></div>
</div>
<script src="<?=getBase();?>/pmap-v1.js"></script>
<script src="<?=getBase();?>/res/shariff-1.24.1/shariff.min.js"></script>
</body>
</html> 