<?php
include(dirname(__FILE__).'/data/config.inc.php');

// PData laden
$data = file_get_contents(dirname(__FILE__).'/data/pdata.json', FILE_USE_INCLUDE_PATH);
$pdata = json_decode($data);
if ($pdata === null) {
    exit();
}

$slug = filter_input(INPUT_GET, "key", FILTER_SANITIZE_FULL_SPECIAL_CHARS);
$slug2 = filter_input(INPUT_GET, "key2", FILTER_SANITIZE_FULL_SPECIAL_CHARS); 

// Zuordnung Slug -> Key erzeugen
$slugToKreis = array();
$slugToTreffen = array();
foreach ($pdata as $key => $val)  {
    if (isset($val->slug)) {
        $slugToKreis[$val->slug] = $key;
    }
    if (is_array($val->treffen)) {			
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
function getURL() {
    $sn = filter_input(INPUT_SERVER, "SCRIPT_NAME");
    $snme = filter_input(INPUT_SERVER, "SERVER_NAME");
    $pp = preg_replace('/\/[^\/]+$/', '', $sn);
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] != 'off' && $_SERVER['HTTPS'] != '') {
        $protocol = "https";
    } else {
        $protocol = "http";
    }
    return $protocol."://".$snme.$pp;
}

// Pfad zur Homepage
function getBase() {
    $sn = filter_input(INPUT_SERVER, "SCRIPT_NAME");
    $pp = preg_replace('/\/[^\/]+$/', '', $sn);
    return $pp;
}

// Slug -> Keys
function getKeys($slug, $slug2 = false) {
    global $slugToKreis, $slugToTreffen, $pdata;
    $go = false;
    
    if (isset($slug) && ($slug == "plz") && isset($slug2) && is_numeric($slug2)) {
        return ["plz", $slug2];
    } else if (isset($slug) && !is_numeric($slug) && isset($slugToKreis[$slug])) {
        $key = $slugToKreis[$slug]; $go = true;
    } else if (isset($slug) && is_numeric($slug) && isset($pdata[$slug])) {
        $key = $slug; $go = true;
    }

    if ($go && $slug2) {
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

function getInitKeysJS() { 
    global $slug, $slug2;
    $keys = getKeys($slug, $slug2);
    if ($keys && is_array($keys)) {
        if (isset($keys[0]) && is_numeric($keys[0])) echo "initKey=".$keys[0].";\n";
        if (isset($keys[0]) && !is_numeric($keys[0])) echo "initKey='".$keys[0]."';\n";
        if (isset($keys[1])) echo "initKey2=".$keys[1].";\n";
    };
}

// OpenGraph und Twitter MetaTags erstellen
function handleOG() {
	global $slug, $slug2, $pdata;
	$std = true;
	$url = getURL();
	if ($keys = getKeys($slug, $slug2)) {
            if (isset($keys[0])) $key = $keys[0];
            if (isset($keys[1])) $key2= $keys[1];
		if (isset($key, $pdata[$key])) {
			$std = false;

			if (isset($pdata[$key]->name)) $title = $pdata[$key]->name." – ".PMAP_TITLE; else $title = PMAP_TITLE;
			if (isset($pdata[$key]->text) && (trim($pdata[$key]->text) != "")) $desc = $pdata[$key]->text; else $desc=PMAP_DESC;
			if (isset($pdata[$key]->img) && ($size = getimagesize('data/img/'.$pdata[$key]->img))) {
				$imgurl = $url.'/data/img/'.$pdata[$key]->img;
				$imgwidth = $size[0];		
				$imgheight = $size[1];
			} else 	if ($size = getimagesize('data/img/piratenbzvstgt.png')) {
				$imgurl = $url.'data/img/piratenbzvstgt.png';
				$imgwidth = $size[0];		
				$imgheight = $size[1];
			}

			if (isset($key2, $pdata[$key]->treffen[$key2])) {
				if (isset($pdata[$key]->treffen[$key2]->name)) $title = $pdata[$key]->treffen[$key2]->name." – ".$title = $pdata[$key]->name." – ".PMAP_TITLE;
				if (isset($pdata[$key]->treffen[$key2]->text) && (trim($pdata[$key]->treffen[$key2]->text) != "")) $desc = $$pdata[$key]->treffen[$key2]->text;
			}
		}
	}
	if ($std) {
			$title = PMAP_TITLE;
			$desc=PMAP_DESC;
			if ($size = getimagesize('data/img/logo.png')) {
				$imgurl = $url.'/data/img/logo.png';
				$imgwidth = $size[0];		
				$imgheight = $size[1];
			}

	}
	echo '<meta name="twitter:card" content="summary">';
	if (isset($title)) echo '<meta property="og:title" content="'.$title.'" /><meta name="twitter:title" content="'.$title.'">';
	if (isset($desc)) echo '<meta property="og:description" content="'.$desc.'" /><meta name="twitter:description" content="'.$desc.'">';
	if (isset($imgurl)) echo '<meta property="og:image" content="'.$imgurl.'" /><meta name="twitter:image" content="'.$imgurl.'">';
	if (isset($imgwidth)) echo '<meta property="og:image:width" content="'.$imgwidth.'" />';
	if (isset($imgheight)) echo '<meta property="og:image:height" content="'.$imgheight.'" />';
}

?>
