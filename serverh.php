<?php

define('TYP_GRUPPE',1);
define('TYP_TREFFEN', 2);
define('TYP_PLZ', 3);
define('TYP_EVENT', 4);

if(file_exists(dirname(__FILE__).'/data/config.inc.php')){
    include(dirname(__FILE__).'/data/config.inc.php');
} else {
    echo "Das DATA-Verzeichnis ist nicht vollständig.";
    exit();
}

// PData laden
if(file_exists(dirname(__FILE__).'/data/pdata.json')){
    $data = file_get_contents(dirname(__FILE__).'/data/pdata.json', FILE_USE_INCLUDE_PATH);
    $pdata = json_decode($data);
    if ($pdata === null) {
        echo "Das DATA-Verzeichnis ist nicht vollständig.";
        exit();
    }
} else {
    echo "Das DATA-Verzeichnis ist nicht vollständig.";
    exit();
}

$slug = filter_input(INPUT_GET, "key", FILTER_SANITIZE_FULL_SPECIAL_CHARS);
$slug2 = filter_input(INPUT_GET, "key2", FILTER_SANITIZE_FULL_SPECIAL_CHARS); 
$slug3 = filter_input(INPUT_GET, "key3", FILTER_SANITIZE_FULL_SPECIAL_CHARS); 

// Zuordnung Slug -> Key erzeugen
$slugToKreis = array();
$slugToTreffen = array();
foreach ($pdata as $key => $val)  {
    if (isset($val->slug)) {
        $slugToKreis[$val->slug] = $key;
    }
    if (isset($val->treffen) && is_array($val->treffen)) {			
		$stt = array();
		foreach ($val->treffen as $key2 => $val2)  {
                    if (isset($val2->slug)) {
                $stt[$val2->slug] = $key2;
            }
        }
		$slugToTreffen[$key] = $stt;
	}
}

// URL zur Homepage
function getURL($noprotocol = false) {
    $sn = filter_input(INPUT_SERVER, "SCRIPT_NAME");
    $snme = filter_input(INPUT_SERVER, "SERVER_NAME");
    $pp = preg_replace('/\/[^\/]+$/', '', $sn);
    if (!$noprotocol) {
        if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] != 'off' && $_SERVER['HTTPS'] != '') {
            $protocol = "https";
        } else {
            $protocol = "http";
        }
        return $protocol."://".$snme.$pp;
    } else {
        return "//".$snme.$pp;
    }
}

// Pfad zur Homepage
function getBase() {
    $sn = filter_input(INPUT_SERVER, "SCRIPT_NAME");
    $pp = preg_replace('/\/[^\/]+$/', '', $sn);
    return $pp;
}

// Slug -> Keys
function getKeys($slug, $slug2 = false, $slug3 = false) {
    global $slugToKreis, $slugToTreffen, $pdata;
    $go = false;
    if (isset($slug) && ($slug == "plz") && isset($slug2) && is_numeric($slug2)) {
        return ["plz", $slug2];
    } else if (isset($slug, $slug2, $slug3) && ("event" == $slug2)) {
        return ["event", $slug, $slug3];
    } else if (isset($slug) && !is_numeric($slug) && isset($slugToKreis[$slug])) {
        $key = $slugToKreis[$slug]; $go = true;
    } else if (isset($slug) && is_numeric($slug) && isset($pdata[$slug])) {
        $key = $slug; $go = true;
    }

    if ($go && isset($slug2)) {
        $go = false;
        if (!is_numeric($slug2) && isset($slugToTreffen[$key][$slug2])) {
            $key2 = $slugToTreffen[$key][$slug2]; $go = true;
        } else if (is_numeric($slug2) && isset($pdata[$key]->treffen[$slug2])) {
            $key2 = $slug2; $go = true;
        }		
    }

    if ($go) {
        if (isset($key2)) {
            return [$key, $key2];
        } else {
            return [$key];
        }
    } else {
	return false;
    }
}

function getData() { 
    global $slugToKreis, $slugToTreffen, $pdata;
    global $slug, $slug2, $slug3;

    $go = false;
    
    if (isset($slug) && ($slug == "plz") && isset($slug2) && is_numeric($slug2)) {
        $r_typ = TYP_PLZ;
        $r_data = array("plz" => $slug2);
    } else if (isset($slug, $slug2, $slug3) && ("event" == $slug2) && !is_numeric($slug) && isset($slugToKreis[$slug])) {
        $r_typ = TYP_EVENT;
        $r_data = array("gruppeId" => $slugToKreis[$slug], "eventHash" => $slug3);
    } else if (isset($slug, $slug2, $slug3) && ("event" == $slug2) && is_numeric($slug)) {
        $r_typ = TYP_EVENT;
        $r_data = array("gruppeId" => $slug, "eventHash" => $slug3);
    } else if (isset($slug) && !is_numeric($slug) && isset($slugToKreis[$slug])) {
        $r_typ = TYP_GRUPPE;
        $r_data = array("gruppeId" => $slugToKreis[$slug]);
        $gruppeId = $slugToKreis[$slug];
    } else if (isset($slug) && is_numeric($slug) && isset($pdata[$slug])) {
        $r_typ = TYP_GRUPPE;
        $r_data = array("gruppeId" => $slug);
        $gruppeId = $slug;
    }

    if (isset($slug2, $r_typ) && (TYP_GRUPPE === $r_typ)) {
        if (!is_numeric($slug2) && isset($slugToTreffen[$gruppeId][$slug2])) {
            $r_typ = TYP_TREFFEN;
            $r_data['treffenId'] = $slugToTreffen[$gruppeId][$slug2];
        } else if (is_numeric($slug2) && isset($pdata[$key]->treffen[$slug2])) {
            $r_typ = TYP_TREFFEN;
            $r_data['treffenId'] = $slug2;
        }		
    }
    if (isset($r_typ, $r_data)) {
        $r_data['typ'] = $r_typ;
        return $r_data;
    } else {
        return false;
    }
}

function getInitKeysJS() { 
    
    $data = getData();
    if (is_array($data)) {
        $json_data = json_encode($data);    
        echo "var initData=".$json_data.";\n";
    }

}

// OpenGraph und Twitter MetaTags erstellen
function handleOG() {
	global $slug, $slug2, $pdata;
	$std = true;
	$url = getURL();
        $data = getData();
            
        try {
            if ($data['typ'] !== TYP_GRUPPE && $data['typ'] !== TYP_TREFFEN && $data['typ'] !== TYP_EVENT) throw new Exception("");
            if (!isset($data['gruppeId'])) throw new Exception("");
            $key = $data['gruppeId'];

            if (isset($pdata[$key]->name)) $title = $pdata[$key]->name." – ".PMAP_TITLE; else $title = PMAP_TITLE;
            if (isset($pdata[$key]->text) && (trim($pdata[$key]->text) != "")) $desc = $pdata[$key]->text; else $desc=PMAP_DESC;
            if (isset($pdata[$key]->img) && ($size = getimagesize('data/img/'.$pdata[$key]->img))) {
                    $imgurl = $url.'/data/img/'.$pdata[$key]->img;
                    $imgwidth = $size[0];		
                    $imgheight = $size[1];
            } else if ($size = getimagesize('data/img/logo.png')) {
                    $imgurl = $url.'data/img/logo.png';
                    $imgwidth = $size[0];		
                    $imgheight = $size[1];
            }

            if ($data['typ'] === TYP_TREFFEN && isset($data['treffenId'])) {
                $key2 = $data['treffenId'];
                if (isset($pdata[$key]->treffen[$key2]->name)) $title = $pdata[$key]->treffen[$key2]->name." – ".$pdata[$key]->name." – ".PMAP_TITLE;
                if (isset($pdata[$key]->treffen[$key2]->text) && (trim($pdata[$key]->treffen[$key2]->text) != "")) $desc = $$pdata[$key]->treffen[$key2]->text;
            }

        } catch (Exception $e)    {
            $title = PMAP_TITLE;
            $desc=PMAP_DESC;
            if ($size = getimagesize('data/img/logo.png')) {
                    $imgurl = $url.'/data/img/logo.png';
                    $imgwidth = $size[0];		
                    $imgheight = $size[1];
            }
        }

	echo '<meta name="twitter:card" content="summary_large_image">';
	if (isset($title)) echo '<meta property="og:title" content="'.$title.'" /><meta name="twitter:title" content="'.$title.'">';
	if (isset($desc)) echo '<meta name="description" content="'.$desc.'" /><meta property="og:description" content="'.$desc.'" /><meta name="twitter:description" content="'.$desc.'">';
	if (isset($imgurl)) echo '<meta property="og:image" content="'.$imgurl.'" /><meta name="twitter:image" content="'.$imgurl.'">';
	if (isset($imgwidth)) echo '<meta property="og:image:width" content="'.$imgwidth.'" />';
	if (isset($imgheight)) echo '<meta property="og:image:height" content="'.$imgheight.'" />';
}

?>
