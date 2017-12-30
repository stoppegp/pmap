<?php
header("Content-Security-Policy: default-src 'self'; img-src 'self' stamen-tiles.a.ssl.fastly.net; frame-ancestors 'self'");
?>
<!DOCTYPE html>
<?php
    include('serverh.php'); // Server-Methoden einbinden
?>
<html id="html" class="nonjs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<?php
    handleOG(); // Meta-Tags für Crawler generieren
?>
<title><?php echo PMAP_TITLE; ?></title>
<?php
if (file_exists("data/img/favicon.ico")) {
    ?>
<link rel="shortcut icon" type="image/x-icon" href="<?=getBase();?>/data/img/favicon.ico" />
    <?php
} else {
?>
<link rel="shortcut icon" type="image/x-icon" href="<?=getBase();?>/res/favicon-v1.ico" />
<?php } ?>
<link rel="stylesheet" href="<?=getBase();?>/res/leaflet-1.0.2/leaflet.css" />
<script src="<?=getBase();?>/res/jquery/jquery-3.1.1.min.js"></script>
<script src="<?=getBase();?>/res/jquery-ui-1.12.1.custom/jquery-ui.min.js"></script>
<script src="<?=getBase();?>/res/leaflet-1.0.2/leaflet.js"></script>
<script src="<?=getBase();?>/res/leaflet-1.0.2/leaflet.ajax.min.js"></script>
<script src="<?=getBase();?>/res/moment/moment-with-locales.js"></script>
<link rel="stylesheet" type="text/css" href="<?=getBase();?>/res/css/main.css?v=2">
<link type="text/css" href="<?=getBase();?>/res/shariff-2.0.4/shariff.complete.css" rel="stylesheet">

<script type="application/json" id="datavar"><?php
$datavar['basePath'] = getBase();
$datavar['title'] = PMAP_TITLE;
$datavar['pdata'] = $pdata;
$datavar['calendar'] = $cdata;
$datavar['initData'] = getData();

echo json_encode($datavar, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES);
?></script>

<?php echo getOG(); ?>
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
                <h2>Lokale Gruppen</h2>
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
<script src="<?=getBase();?>/pmap.js?v=2"></script>
<script src="<?=getBase();?>/res/shariff-2.0.4/shariff.min.js"></script>
</body>
</html> 
