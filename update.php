<?php
/**
 * Liest die nächsten Termine der Stammtisch und ICALs aus pdata.json aus und speichert sie
 * entsprechend sortiert in events.json
 * Ein Gesamtkalender mit den nächsten Terminen wird in calendar.json und bzv-stuttgart.ical gespeichert.
 */

$oktime = 36000; // Maximales Alter (in s) der gecacheten Daten

require(dirname(__FILE__)."/res/ical-parser/IcalParser.php");
require(dirname(__FILE__)."/res/ical-parser/Freq.php");
require(dirname(__FILE__)."/res/ical-parser/Recurrence.php");
use om\IcalParser;

$starttime = time();
$LOG = array();
$error = false;

$icals = array();

if (isset($_REQUEST['force']) && ($_REQUEST['force'] == 1)) $oktime = 0;

function plog($text) {
	global $starttime;
	global $LOG;
	$LOG[] = (time()-$starttime)."|".$text;
}

function nl2br2($string) {
$string = str_replace(array("\r\n", "\r", "\n"), "<br />", $string);
return $string;
}

/**
 * Holt den Inhalt einer URL per curl oder aus dem Cache
 */
function getFile($url) {
	global $oktime;
	plog("getFile");
	$filehash = md5($url);
    plog($filehash);
        // Wenn aktueller Cache vorhanden, diesen benutzen, ansonsten neu einlesen
	if (file_exists(dirname(__FILE__)."/cache/".$filehash) && (filemtime(dirname(__FILE__)."/cache/".$filehash) > (time()-$oktime))) {
		plog("use cached file");
		$data = file_get_contents(dirname(__FILE__)."/cache/".$filehash);
		plog("file loaded");
		return $data;
	} else {
		plog("try curl");
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
		curl_setopt($ch, CURLOPT_TIMEOUT, 5);
		$data = curl_exec($ch);
                
                // Wenn vom Server holen fehlschlägt, alten Cache verwenden (wenn vorhanden, ansonsten Fehler zurückgeben)
		if(curl_errno($ch)) {
			if (file_exists(dirname(__FILE__)."/cache/".$filehash)) {
				plog("curl failed, use cache");
				$data = file_get_contents(dirname(__FILE__)."/cache/".$filehash);
				return $data;
			} else {
				plog("curl failed, no cache");
				return false;
			}
		} else {
                        // Eingelesene Daten in den Cache schreiben und zurückgeben
			curl_close($ch);
			file_put_contents(dirname(__FILE__)."/cache/".$filehash, $data);
			plog("curl success.");
			return $data;
		}
	}
}

/**
 * Löscht eine Cache-Datei
 */
function removeCache($url) {
	$filehash = md5($url);
	if (file_exists(dirname(__FILE__)."/cache/".$filehash)) unlink(dirname(__FILE__)."/cache/".$filehash);
}

/**
 * Nächsten Termin eines Stammtisches aus der Box Regionaltreff_header im Wiki auslesen
 */
function getnextWiki($url, $searchstring) {
	plog("getWiki");
	if (!($data = getFile($url))) return false;
	
        /**
         * Benötigte Informationen verarbeiten.
         * Suche 1: Ortsname
         * Suche 2: Datum
         * Scuhe 3: Uhrzeit
         */
        $pattern = '/<table>.+?(?=Ort)Ort.+?(?=<td>)<td>([a-zA-Z0-9\.\\\\\/\(\)ÄÖÜäöüß ]+).+?(?=Datum)Datum.+?(?=<td>)<td>([0-9a-zA-ZäöüßÄÖÜ\. ]+).+?(?=Uhrzeit)Uhrzeit.+?(?=<td>)<td>([0-9:]+).+?(?=<\/table>)<\/table>/s';
	preg_match_all ( $pattern , $data, $matches);
        
	if (is_array($matches) && (count($matches) >= 4)) {
		$k = false;
                
                // Ort der Treffer mit gesuchtem Ort vergleichen
		foreach ($matches[1] as $key => $val) {
			if ($searchstring == $val) {
				$k = $key;
				break;
			}
		}
		if ($k === false) return false; // Passender Ort nicht dabei.
		$search = array(" Januar ", " Februar ", " März ", " April ", " Mai ", " Juni ", " Juli ", " August ", " September ", " Oktober ", " November ", " Dezember ");
		$replace = array("01.", "02.", "03.", "04.", "05.", "06.", "07.", "08.", "09.", "10.", "11.", "12.");
		return strtotime(str_replace($search, $replace, $matches[2][$k])." ".$matches[3][$k]);
	} else {
		return false;   // Nichts gefunden.
	}
}

/**
 * Nächsten Termin eines Stammtisches aus ICAL auslesen
 * @param String $calfile - URL zur ICAL-Datei
 * @param String $searcharray - Array mit Suchworten
 */
function getnextIcal($calfile, $searcharray) {
	global $icals, $ic;
	plog("Nächsten Termin aus ICAL lesen");
	$calfilehash = md5($calfile);
        
        // Wenn bereits ein ICAL-Objekt für diese Datei besteht, dieses Verwenden
        // ansonsten neu einlesen und Objekt erstellen
	if (isset($icals[$calfilehash])) {
		$ical = $icals[$calfilehash];
	} else {
		if (!($data = getFile($calfile))) return false;
		$ical = new IcalParser();
		$ical->parseString($data);
		$icals[$calfilehash] = $ical;
	}
	
        // Termine in Array laden
	$evts = $ical->getSortedEvents();

	if (is_array($evts)) {
		foreach($evts as $id => $ev) {
			if ($ev['DTSTART']->getTimestamp() < time()) continue;  // Vergangene Termine überspringen
                        // Überprüfen, ob Termin mit einem Suchwort übereinstimmt
			foreach ($searcharray as $val0) {
				if (strpos(" ".$ev['SUMMARY'], $val0) != 0) {
					return $ev['DTSTART']->getTimestamp();
				}
			}				
		}
	}
	return false;
}

/**
 * Nächste Termine einer ICAL laden
 */
function getIcal($calfile, $suchworte) {
	global $icals, $ic;
	plog("ICAL-Termine laden");
	$calfilehash = md5($calfile);
        
        // Wenn bereits ein ICAL-Objekt für diese Datei besteht, dieses Verwenden
        // ansonsten neu einlesen und Objekt erstellen
	if (isset($icals[$calfilehash])) {
		plog("use cached object");
		$ical = $icals[$calfilehash];
	} else {
		if (!($data = getFile($calfile))) return false;
		plog("create ICAL object");
		$ical = new IcalParser();
		$ical->parseString($data);
		$icals[$calfilehash] = $ical;
	}
        
        // Termine in Array laden
	$evts = $ical->getSortedEvents();

	$data = array();    // Ergebnis-Array
	$starts = array();  // Startzeiten für die Sortierung
	if (is_array($evts)) {
		foreach($evts as $id => $ev) {
			if ($ev['DTSTART']->getTimestamp() < time()-3600*24*7) continue;    // Alte Termine übersprungen
			if ($ev['DTSTART']->getTimestamp() > time()+3600*24*60) continue;   // Termine in ferner Zukunft überspringen
			$jsEvt = array(
				"title" => $ev['SUMMARY'],
				"location" => $ev['LOCATION'],
				"description" => $ev['DESCRIPTION'],
				"start" => $ev['DTSTART']->getTimestamp(),
				"starta" => $ev['DTSTART']->format('d.m.Y'),
				"end" => $ev['DTEND']->getTimestamp(),
                "hash" => md5($ev['SUMMARY'].$ev['DTSTART']->format('d.m.Y'))
			);
                        
                        // Falls Termin zu einem Treffen passt, Verbindung hinzufügen
			if (is_array($suchworte) && (count($suchworte) > 0)) {
				foreach ($suchworte as $skey => $val0) {
					if (strpos(" ".$ev['SUMMARY'], $skey) != 0) {
						$jsEvt['key'] = $val0['key'];
						$jsEvt['key2'] = $val0['key2'];
					}
				}
			}
			$data[] = $jsEvt;
			$starts[] = $jsEvt['start'];
		}
	}
	if (is_array($data)) {
		return array($data, $starts);
	}
	return false;
}

plog("START");

// PDATA einlesen
$data = file_get_contents(dirname(__FILE__).'/data/pdata.json', FILE_USE_INCLUDE_PATH);
$pdata = json_decode($data);

plog("PDATA geladen");

$erg = array();

/* TERMINE einlesen */
if (is_array($pdata) && (count($pdata) > 0)) {
	foreach ($pdata as $key => $val) {
		plog("Datensatz ".$key." | ".$val->name);	
		
                $asuchworte = array();	// Gesammelte ICAL-Suchworte
                
                // Nächste Termine der einzelnen Treffen finden
		if (is_array($val->treffen) && (count($val->treffen) > 0)) {
			foreach ($val->treffen as $tkey => $treffen) {
				plog("treffen ".$tkey);
                                
                                // Terminquelle: ICAL
				if (isset($treffen->termin->quelle) && ("ical" == $treffen->termin->quelle->typ)) {
					plog("Typ: ICAL");
					$quelle = $treffen->termin->quelle;
					$ical = $quelle->ical;
					$suchworte = $quelle->suchworte;
					if (!$ical) { plog("FAILED."); $error = true; continue; }
					if (is_array($suchworte) && (count($suchworte) > 0)) {
						// Suchworte ins globale Array mit Zuordnung übernehmen
                                                foreach ($suchworte as $sv) {
							$asuchworte[$sv] = array("key" => $key, "key2" => $tkey);
						}						
						$date = getnextIcal($ical, $suchworte);
						if ($date != false) {
							$erg[$key]['treffen'][$tkey] = $date;
							plog($date);
						} else {
							plog("FAILED.");
                                                        $error = true;
						}
					}
                                // Terminquelle: WIKI
				} else if (isset($treffen->termin->quelle) && ("wiki" == $treffen->termin->quelle->typ)) {
					plog("Typ: WIKI");
					$quelle = $treffen->termin->quelle;
					$wiki = $quelle->wiki;
					$ort = $quelle->ort;
					if (!$wiki) { plog("FAILED."); $error = true; continue; }
					if ($ort) {
						$date = getnextWiki($wiki, $ort);
						if ($date != false) {
							$erg[$key]['treffen'][$tkey] = $date;
							plog($date);
						} else {
							plog("FAILED.");
                                                        $error = true;
							removeCache($wiki); // Wenn Wiki-Datei keinen Termin beinhaltet, aus dem Cache löschen
						}
					}
				}
			}
		}
                
                // ICAL-Termine einlesen
		if (isset($val->icals) && is_array($val->icals) && (count($val->icals) > 0)) {
			plog("ICALS gefunden");
			$events = array();			
			$starts = array();	
			foreach ($val->icals as $ikey => $ical) {
				plog("ical ".$ikey);
				$ret = getIcal($ical, $asuchworte);
				$events = array_merge($events, $ret[0]);
				$starts = array_merge($starts, $ret[1]);
			}		
			array_multisort($starts, $events);
			$erg[$key]['ical'] = $events;
		}
	}
}
// Eingelesene Daten abspeichern
$ergdata = json_encode($erg, JSON_FORCE_OBJECT);
file_put_contents(dirname(__FILE__)."/gen/events.json", $ergdata);

// Gesamtkalender erstellen
plog("combined calendar");
$events = array();
$starts = array();
foreach ($erg as $key => $val) {
	if (isset($val['ical'])) {
		foreach ($val['ical'] as $key2 => $val2) {
			$newev = $val2;
			$newev['key'] = $key;
			$events[] = $newev;
			$starts[] = $val2['start'];
		}
	} else if ($val['treffen']) {
		foreach ($val['treffen'] as $key2 => $val2) {
			$newev = array(
				"key"	=>	$key,
				"key2"	=>	$key2,
				"start"	=>	$val2,
				"end"	=>	$val2+7200,
				"title"	=>	$pdata[$key]->treffen[$key2]->name
			);
			if (isset($pdata[$key]->treffen[$key2]->ort)) $newev['location'] = $pdata[$key]->treffen[$key2]->ort;
			if (isset($pdata[$key]->treffen[$key2]->text)) $newev['description'] = $pdata[$key]->treffen[$key2]->text;
			$events[] = $newev;
			$starts[] = $val2;
		}
	}
}
array_multisort($starts, $events);
file_put_contents(dirname(__FILE__)."/gen/calendar.json", json_encode($events, JSON_FORCE_OBJECT));

// Gesamt-ICAL erzeugen
plog("ICAL");
$idata = <<< START
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//hacksw/handcal//NONSGML v1.0//EN\n
START;
date_default_timezone_set('UTC');
$cdata = $events;
$co = 0;
foreach ($cdata as $val) {
	$uid = date("YmdHis", $val['start'])."K".$co++."@PDATAPIRATENBZVSTUTTGART";
	$idata .= "BEGIN:VEVENT\n";
	$idata .=  "UID:".$uid."\n";
	$idata .=  "DTSTAMP:".date("Ymd", time())."T".date("His", time())."Z\n";		
	$idata .=  "SUMMARY:".nl2br2($val['title'])."\n";	
	if (isset($val['location'])) 	$idata .=  "LOCATION:".nl2br2($val['location'])."\n";	
	if (isset($val['description'])) 	$idata .=  "DESCRIPTION:".nl2br2($val['description'])."\n";	
	$idata .=  "DTSTART:".date("Ymd", $val['start'])."T".date("His", $val['start'])."Z\n";
	if (isset($val['end'])) $idata .=  "DTEND:".date("Ymd", $val['end'])."T".date("His", $val['end'])."Z\n"; else $idata .=  "DTEND:".date("Ymd", $val['start']+7200)."T".date("His", $val['start']+7200)."Z\n";
	$idata .=  "END:VEVENT\n";
}
$idata .= "END:VCALENDAR";
file_put_contents(dirname(__FILE__).'/gen/calendar.ics', str_replace("\n", "\r\n", $idata));

if ($error == true || !isset($_GET['quet'])) {
    echo (time()-$starttime)." Sekunden\n";
    echo implode("\n", $LOG);
}
?>
