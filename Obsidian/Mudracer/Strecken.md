
Stand 2026-10-14, Branch `map_pack`. Die Strecken 1 bis 6 sind umgesetzt, 7 bis 15 als Prototyp (15 Regenbogen als Rework der alten Plattform-Strecke). Reihenfolge in Einzelstrecke und Zeitfahren heute: Wiese, Wald, Strand, Zug, Baustelle, Garten, Rennstrecke, Wüste, Eis, Vulkan, Dschungel, Weltall, Süßigkeitenland, Spielzimmer, Regenbogen.

**Streckenereignisse** lassen sich im Code pro Ereignis ein- und ausschalten: `PREFS.events` in `src/state.js` (`kuehe`, `regen`, `flut`, `kois`, `kipper`, `zug`, `reifen`, `sandsturm`, `frost`, `pinguine`, `ausbruch`, `baeume`, `kroko`, `asteroiden`, `schwarzesloch`, `schoko`, `zuckerwatte`, `spielzeug`, `saugroboter`, `einhorn`, `gewitter`, alle auf `true`). Im Spiel gibt es einen gemeinsamen Schalter „Streckeneffekte“ (Einzelstrecke und Zeitfahren in den Optionen; im Grand Prix ab MITTEL an; im Kindermodus immer aus, `fxActive` in `src/diff.js`). Die Ereignisse ändern die Karte während des Rennens (die Karte wird dafür zur Laufzeit umgemalt). Nach dem Rennen stellt das Spiel die Strecke wieder her, Menüs und Vorschaubilder zeigen die saubere Strecke.

**Kartengröße:** Die Strecken sind 800×450 px groß (Standard), größer sind das Weltall (1360×765), das Süßigkeitenland (1200×675), das Spielzimmer (1280×720) und der Regenbogen (1440×810). Seit 2026-10-12 kann eine Strecke eine eigene Größe bekommen (`W` und `H` in ihrer Definition in `TRACK_DEFS`, `src/tracks.js`). Die Strecken werden erst gebaut, wenn sie gebraucht werden (im Hintergrund oder auf einem kurzen Ladebildschirm), also verlängern größere Karten den Spielstart nicht.

**Zeitfahren-Rekorde:** Wiese (jetzt `rev: 2`), Wald, Strand und Regenbogen haben durch die Änderungen eine neue Revision (`rev: 1`). Ihre Rekorde starten neu (Schlüssel mit Zusatz `-r1`), die alten Zeiten bleiben unangetastet im Speicher.

**Cups:** Die Strecken sind in Cups 1-5 eingeteilt. Das kindliche Zielpublikum ist mit Cup 1 gut bedient, ab Cup 2 können und sollen die Strecken immer aufwendiger und verrückter werden (Sprungschanzen etc.) selbst im Modus ohne Streckenereignis, während der Ursprung des Spiels natürlich nicht verloren geht.
# Cup 1
## 1. Wiese
Status: **umgesetzt** (Streckenereignis Kühe)

Vorher:
![[Pasted image 20261006220058.png]]
Simpler Rundkurs

Cup: Bronze (Cup 1)
Musik: Hüpfender Kart-Racer in C-Dur. Quadratwellen-Lead, Slap-Bass und Akkord-Stabs auf dem Off-Beat.

Jetzt:
![[Wiese Kuehe.jpg]]
Streckenereignis **Kühe** (`kuehe`):
- Fünf Kühe im unteren rechten Rand, zwei davon auf der Strecke, drei daneben (innen und außen).
- Sie laufen langsam hin und her und bleiben an den Wendepunkten stehen, um zu grasen. Ihre Bewegung hängt nur an der Rennzeit, im Zeitfahren sind sie also bei jedem Versuch gleich.
- Sie sind Hindernisse. Wer hart dagegenfährt, wird wie beim Zug zur Seite geschleudert, dreht sich und sieht Sterne, die Kuh macht „MUH!" (Text und neuer Ton). Langsames Anrempeln schiebt das Auto nur zurück.
- Die Computerautos weichen Kühen aus, die vor ihnen stehen.

Rev 2 (1S1-1, 1A-1, 1A-4): Die Startlinie liegt jetzt weiter oben auf der verlängerten linken Geraden, die 10 Autos stehen komplett gerade (6° statt 109°). Matsch und Pfützen liegen auf der Innenseite der Kurven (die kürzere Linie), außen bleibt mindestens 26 px sauber (der längere Weg). Anzahl bleibt (3 Matsch, 3 Pfützen), die Stellen sind etwas länger. ✅ umgesetzt

Offen: nichts aus der Änderungsliste.

## 2. Wald
Status: **umgesetzt** (dunkle Strecke mit Scheinwerfern, Streckenereignis Regen)

Vorher (die roten Markierungen sind die Löcher, die Vorlage für den Regen):
![[Pasted image 20261006220109.png]]
![[Pasted image 20261006232540.png]]
Weiterer Simpler Rundkurs.

Cup: Bronze (Cup 1)
Musik: Waldabenteuer in a-Moll. Flöte über Marimba, dazu Toms, Rim und Shaker.

Jetzt:
Die ganze Strecke ist dunkel (blaue Dämmerung, gilt immer, ist kein Ereignis; Schleier seit Rev 2 nur noch 50 %, Vignette leichter; der Matsch hat einen hellen Rand und hellere Glanzpunkte, ✅ umgesetzt, ROADMAP 1S2-1; die Startaufstellung steht auf der langen Geraden links, Straße dreht sich auf 200 px nur um 7° statt 69°), und jedes Auto hat einen Scheinwerferkegel. Die Glühwürmchen leuchten über der Dunkelheit. Die Sonnenstrahlen gibt es im Dunkeln nicht mehr.
![[Wald Dunkel Loecher.jpg]]
Streckenereignis **Regen** (`regen`):
- Von Anfang an liegen sieben dunkle Löcher auf der Strecke, an den markierten Stellen. Sie sind nur ein Hinweis und bremsen nicht.
- Sobald du in Runde 2 gehst, setzen Donner und Regen ein. Nacheinander füllen sich die Löcher mit Schlamm (wirklicher Schlamm: bremst, macht dreckig).
- Der Regen setzt langsam ein und dauert bis zum Ende des Rennens, ebenso das Rauschen.
- Seit Rev 3 sind alle Matschflecken und Wasserpfützen bis zum Regen nur halb gefüllt (halbe Fläche). Mit dem Regen wachsen sie nacheinander innerhalb weniger Sekunden auf ihre volle Größe. Ohne Regen (Ereignis aus) bleiben sie halb. ✅ umgesetzt (WALD Rev 3, ROADMAP 1S2-3)
![[Wald Regen.jpg]]

Rev 3 (Wunsch aus `Screenshots/WALD_Improvements.jpg`, nach dem Regen kein Slalom mehr): Matsch oben links und oben rechts nur noch an der Außenseite (innen bleibt die Linie sauber, oben links auch der Anfang weg), Matsch unten links nur noch am unteren Rand, das Loch in der Mitte unten liegt am Innenrand des Buckels, das Loch auf der Startgeraden auf der rechten Hälfte (beide auf der Ideallinie). ✅ umgesetzt (WALD Rev 3, ROADMAP 1S2-2)

Offen: nichts aus der Änderungsliste. Die Auswahl- und Vorschaubilder zeigen die Strecke noch hell.

## 3. Strand
Status: **umgesetzt** (Strandduschen, Flut), Rev 2 (2026-10-21): Start auf der geraden Oberkante (5° statt 101°, Strecke oben geradegezogen, Rundenrichtung gleich), Matsch wie nasser Sand, die Eckpfütze rechts liegt im Trockenen und die kleine Pfütze auf der gefluteten Gerade ist weg (drei statt vier Pfützen), die Duschen waschen etwa doppelt so lange. Rekorde starten neu (`-r2`).

Vorher (die roten Linien zeigen, wo der Steg bleiben soll):
![[Pasted image 20261006220122.png]]
![[Pasted image 20261006233141.png]]

Cup: Bronze (Cup 1)
Musik: Entspannte Inselstimmung. Gerollte Steel-Pans, Vibraphon, Ukulele-Anschläge, Calypso-Bass, Son-Clave, Congas und Windspiel-Auftakt.

Jetzt:
Änderungen an der Strecke (immer):
- Keine Pfützen auf der Strecke mehr und keine Hauptdusche (Waschanlage). Die Lagune im Infield habe ich behalten.
- Stattdessen drei kleine Strandduschen, die dauernd laufen und eine Minipfütze unter sich lassen (Wasser wäscht das Auto). Im unteren Teil der Strecke stehen bewusst keine, dort steht später die Flut.
- Zwei kleine Schlammpfützen mehr.
- Der **Holzsteg** ist von Anfang an da, damit er bei der Flut nicht aus dem Nichts kommt. Er beginnt am Matsch unten rechts, überbrückt die Strecke über die trockene Lücke in der Mitte und endet kurz vor dem Ziel (nach etwa 51 % bis 94 % der Runde). Für die Autos ist er normale Strecke, schmal (16 px) mit Pfählen an beiden Seiten.
![[Strand Duschen.jpg]]
![[Strand Steg.jpg]]
Streckenereignis **Flut** (`flut`):
- Ab Runde 2 steigt das Meer. Die Wasserlinie samt Schaum und Wellen wandert in rund 9 Sekunden über die gesamte Breite nach oben bis knapp unter die Lagune und geht ohne Naht ins Meer über.
- Nur der schmale Holzsteg („schwimmender Steg", siehe oben) bleibt als normale Strecke. Das Wasser daneben bremst, wäscht aber auch.
- Reifenspuren und Schlamm im überfluteten Bereich werden weggespült. Auf dem Steg fahren die Computerautos mittig, damit sie nicht ins Wasser geraten.
![[Strand Flut.jpg]]
![[Strand Flut Steg.jpg]]

Offen: nichts aus der Änderungsliste. Die Auswahl- und Vorschaubilder zeigen den Strand noch ohne Flut (gewollt, so sieht man die saubere Strecke).


## Cup 2

## 4. Zug
Status: **umgesetzt, Rev 2** (Tunnel, zwei Bahnlinien mit je einem Zug, Autos halten nicht mehr an der Bahn; seit Rev 1 größer, Startgerade, Sprungschanze, Zug kommt von Runde zu Runde öfter; seit Rev 2 zwei graue Schanzen, Matsch neu verteilt, bayerisches Dorf als Kulisse).
- **Rev 1 (Mehr Eskalation, ROADMAP 1S4-1):** Karte 1120×630 statt 800×450 (Runde ca. 17 s statt 14 s). Start auf der langen Geraden links (Startaufstellung 7° statt 85°), die Waschanlage liegt jetzt unten links zwischen Teich und Bahn. Der Zug kommt von Runde zu Runde öfter: Pause zwischen zwei Zügen in Runde 1 7–12 s, Runde 2 etwa 4,5–8 s, Runde 3 etwa 3–5,5 s. Neue **Sprungschanze** (Holzrampe mit gelb-schwarzer Kante) auf der äußeren Hälfte der unteren Geraden kurz vor dem rechten Bahnübergang: wer mit Schwung (ab etwa 160 px/s) drüberfährt, springt über den Zug; wer langsam ist (z. B. direkt aus dem Matsch davor), wird erwischt. Die innere Hälfte bleibt flach, die Schanze ist freiwillig.
- **Rev 2 (ROADMAP 1S4-2, nach ![[Zug_Improvements.jpg]]):** Matsch neu verteilt, jeweils nur auf einer Hälfte der Straße (Matsch ist eine Entscheidung): oben zwischen den beiden Bahnübergängen innen, neu oben rechts außen hinter dem rechten Übergang, rechts die alte Pfütze in zwei Hälften geteilt (außen weiter oben, innen weiter unten), unten auf der Außenhälfte genau in Linie vor der ersten Schanze. Zweite **Sprungschanze** auf der Innenhälfte vor dem linken Bahnübergang unten. Beide Schanzen sind jetzt aus grauem Beton (vorher Holz, zu wenig Kontrast). Die **Waschanlage** steht auf der linken Geraden hinter der Startaufstellung (vorher unten links). Teich im Infield und Pfütze unten links sind weg. **Zwei Züge:** jede Linie hat ihren eigenen Zug mit eigenem Fahrplan, also doppelt so viele Züge; manchmal fahren beide gleichzeitig. Das Weichenhäuschen ist damit weg. **Kulisse:** links ein bayerisches Dorf (Häuser mit roten Dächern, Holzbalkon und Geranien, Kirche mit Zwiebelturm, Maibaum auf dem Dorfplatz, Feldweg), im Infield ein Bauernhof mit Stadel, Misthaufen und Hühnern, eine Kuhweide (Fleckvieh), ein Acker mit pflügendem Traktor, Weizenfeld mit Feldkreuz, Sonnenblumen, oben Felder und ein Hopfengarten, rechts Streuobstwiese und Weide, unten ein kleiner Bahnhof mit Bahnsteig, dazu ein Stellwerk und Telegrafenmasten an den Gleisen (`bahnmap.js`). Häuser, Kirche, Maibaum und Obstbäume sind fest, Felder und Weidezaun flach und befahrbar.
- Statt der Wand mit Schranke liegt in der Mitte ein Berg mit Tunnelportalen (Nord- und Südseite). Der Zug verschwindet im Berg und kommt auf der anderen Seite wieder heraus. Der Berg ist fest, links und rechts davon bleibt die Absperrung.
- **Zwei Bahnlinien** (seit Rev 1 x=602 und x=420) mit je einem Tunnel. Bis Rev 1 stellte eine Weiche vor jeder Fahrt, welche Linie der eine Zug nimmt (Weichenhäuschen mit Hebel und grüner Lampe). Seit Rev 2 fährt auf jeder Linie ein eigener Zug; es blinken und schließen nur die Übergänge der Linie, auf der gerade ein Zug kommt (im Zeitfahren fester Fahrplan).
- Die Computerautos halten nicht mehr an der Bahn an, sie können vom Zug erwischt werden. Die Warnung „ZUG KOMMT“ für dich bleibt.
- Der Teich im Infield war nach rechts gewandert (Platz für die zweite Linie); seit Rev 2 ist er weg.
![[Pasted image 20261006220149.png]]
Rundkurs mit Bahnübergang, auf dem der Zug fährt.

Cup: Silber (Cup 2)
Streckenereignis: Der Zug (schon im Spiel).
Änderung: In die Mitte der Strecke, kommt statt der Wand über die nur der Zug fahren kann, einfach ein Tunnel. Ist wesentlich verständlicher warum man dort nicht durch kann.
![[Pasted image 20261007173448.png]]

## 5. Baustelle
Status: **umgesetzt** (Streckenname `BAUSTELLE`, Streckenereignis Kipplaster `kipper`, neue Oberfläche „Zement“). Im Cup SILBER eingetragen (Zug, Baustelle, Garten). Zeitfahr-Revision 3 (`rev: 3`, Baustelle Rev 3: Startgerade links, keine Pfützen mehr, zwei Wasserschläuche, Zementumfahrung, Erdhaufen als Matsch auf der Fahrbahn).

Umsetzung: Die Strecke ist ein Erdweg (Matsch und Pfützen bleiben wie gehabt, drei Matschstellen, seit Rev 3 keine Pfützen mehr). Fahrtrichtung im Uhrzeigersinn, Start links, es geht zuerst nach oben. Wie im Garten ist die Strecke ein Ring mit Ausbuchtungen: oben ein U nach unten (um das Betonwerk), rechts ein Zickzack (Haarnadel nach links und wieder zurück), unten ein ∩ nach oben (um die Baugrube). Alles innerhalb des Rings sind **Baustellenhöfe**: feste Fläche, die niemand betreten kann (ein Ring aus festen Kreisen am Rand, dadurch gibt es keine Abkürzungen). Die Höfe sind nur Kulisse: Rohbau mit Säulen und Aufzugschacht, Materiallager mit Betonrohren, Ziegelpaletten, Sand und Kies, Bauwagen und Dixis, Baugrube mit Bagger, Betonwerk mit Silos, Containerdorf, Fundament mit Armierung, Holzstapel. Außerhalb der Strecke liegen Schutt, Bretter, Fässer, Reifen und Pylonen. Der Rand der Strecke ist mit orangem Bauzaun gesäumt.
- **Engstellen:** An drei Stellen ragt eine Betonleitwand (orange-weiß, fest) von einer Seite in die Fahrbahn, davor und dahinter Pylonen (fest), dazu eine blinkende Warnlampe. Die Fahrbahn wird dort auf etwa drei Viertel schmal.
- **Betonmischer:** Ein geparkter Betonmischer steht im U (die Trommel dreht sich, aus der Rutsche tropft es) und läuft aus. Das graue Rinnsal führt über den Straßenrand in eine **graue Pfütze** auf der Strecke (Terrain 6, Zement) auf der Innenseite der Kurve; außen bleiben 28 px sauber, die Umfahrung ist länger (Entscheidung statt Zwang, Rev 3). Wer hindurchfährt, wird **grau** statt braun (die Farbe des Drecks ist das, wodurch man zuletzt gefahren ist). Zement bremst viel stärker als Matsch (die Höchstgeschwindigkeit ist nur etwa ein Viertel, genau 1/3,8, so hoch wie im Matsch, seit 42eb5ec; vorher 1/2,6), klebt stärker und macht dreckig. Schlauch und Waschanlage waschen seit 42eb5ec viel kräftiger (großer Spülstoß beim Hineinfahren, dann schnell).
- **Kran mit Rohr:** Oben an der Geraden steht ein Turmdrehkran. Sein Ausleger quert die Strecke und hält an einem Haken ein Betonrohr, das über der Fahrbahn hängt (stillstehend, mit Schatten auf dem Boden). Man fährt **unter** dem Rohr durch, das Auto verschwindet kurz dahinter (das Rohr liegt auf der obersten Ebene).
- Gewaschen wird an zwei Schläuchen (Hydrant außen an der Kurve oben rechts und unten rechts) und in der Waschanlage unten links am Ende der Runde.
Streckenereignis **Kipplaster** (`kipper`):
- An vier Stellen am Streckenrand (links, oben, rechts, unten) fährt ein gelber Kipplaster von außerhalb rückwärts (mit Piepsen) an den Rand, kippt die Ladung (Hydraulik, Poltern) und fährt wieder weg. Er steht dabei neben der Strecke, ist aber fest.
- Die Laster sind etwas größer (Faktor 1,2). Die Reihenfolge der Strecken im Spiel (Einzelstrecke, Zeitfahren) folgt der Doku: Wiese, Wald, Strand, Zug, Baustelle, Garten, Regenbogen.
- Beim Kippen steigt eine große **Erdwolke** auf, die langsam über den Streckenrand in die Fahrbahn zieht und dann dünner wird. Wer hindurchfährt, wird matschig (die Wolke macht etwa 1,1 Schmutz pro Sekunde, Matsch 0,55). Der Erdhaufen, der liegen bleibt, ragt als Matsch etwa 14 px in die Fahrbahn (bremst, verdreckt, die KI weicht aus; Rev 3), die Wolke ist größer und macht etwa 2,6 Schmutz pro Sekunde.
- Die Besuche hängen nur an der Rennzeit (alle 23 bis 29 Sekunden, versetzt), im Zeitfahren sind sie also bei jedem Versuch gleich.
- Musik `site`: Industrial-Funk in e-Moll, Warnpiepser als Lead, Sägezahn-Bass, Amboss-Schläge und Presslufthammer-Rattern.

Offen: nichts aus der Änderungsliste.

Ursprüngliche Vorgabe (die Abrissbirne und „Mud ist Zement“ wurden durch die Vorgaben oben ersetzt, Pylonen und Absperrungen bleiben als Hindernisse):
Enger Kurs um Kräne, Betonmischer und Baugruben, viele Engstellen.

Cup: Silber (Cup 2)
Musik: Stampfender Industrial-Funk in e-Moll. Metallisches Hämmern als Percussion, Sägezahn-Bass, Presslufthammer-Rhythmus, Warnsignal-Piepser als Lead.
Streckenereignis: (Vorschlag) Ein Abrissbirnen-Kran schwingt periodisch über die Strecke; wer getroffen wird, wird weggeschleudert. Ein Schatten kündigt den Einschlag an. **Ersetzt durch:** Kipplaster, Erdwolke, Rohr am Kran, auslaufender Betonmischer.

## 6. Japanischer Garten
Status: **umgesetzt** (Streckenname `GARTEN`, Streckenereignis Kois, neue Mechanik „Ins Wasser fallen"). Im Cup SILBER eingetragen (Zug, Baustelle, Garten).

Umsetzung (Abweichungen von der Skizze, weil die Welt 800x450 quer ist): Start links, es geht zuerst die Schlängellinie nach oben (drei Bahnen), dann oben das U um den Teich mit dem Fluss von oben (Stein-Abkürzung über den Teich), rechts außen runter, über eine Brücke, unten links herum, die zweite Brücke und das ∩ um den See in der Mitte (zweite Stein-Abkürzung quer über den See). Der Fluss unten kommt vom rechten Rand, kreuzt die Strecke zweimal und speist den See; der See läuft nach unten ab. Brücken: 3 (Geländer sind fest). Heckenwände verhindern das Abkürzen quer durch den Garten, das Wasser sperrt den Rest.
- Tiefes Wasser (Terrain 5): wer länger als 0,22 s darüber ist, fällt hinein, ist 1,4 s weg (Spritzer, Auto wird sauber), wird dann an der letzten sicheren Stelle der Strecke wieder abgesetzt, blinkt und ist 2,4 s durchlässig für andere Autos und Hindernisse. Trittsteine und Brücken sind normale Strecke.
- Kois (`kois`): springen alle paar Sekunden über die drei Brücken und die beiden Stein-Abkürzungen (zeitabhängig, im Zeitfahren immer gleich). Wer unter einem fliegenden Koi steht, wird wie bei der Kuh weggeschleudert. Dazu schwimmen Kois im Teich und im See.
- Optik: Kirschblütenbäume, Bonsais im Topf, Steinlaternen, drei große Pagoden, Lotusblätter, Bambuszaun; Kirschblüten wehen über die Karte, ab und zu schwebt eine Papierlaterne über die Strecke (rein optisch).
- Rev 1 (Zeitfahr-Revision 1): Der Start liegt jetzt auf der rechten, geraden Seite (8° statt 180°), die Waschstelle ist weg (bei so vielen Pfützen braucht es keine Waschstraße), Matsch und Pfütze liegen nicht mehr übereinander. Jeder Koi-Sprung kündigt sich 0,6 s vorher mit Kreisen im Wasser an (groß am Absprung, klein an der Landung). Zweite Abkürzung: Trittsteine vom Teich neben der mittleren Brücke quer über den See zur Straße im Westen (kürzer, aber ein Koi springt darüber und daneben ist tiefes Wasser) ✅ umgesetzt (Garten Rev 1).
- Musik `garden`: Pentatonik in D-Dur, Erhu (Melodie) und Yangqin (Arpeggio), leiser Bass, Holzblock, tiefe Trommel.

Ursprüngliche Vorgabe:
Schlängellinien, Pagoden, Bonsais, über Brücken fahren.

Cup: Silber (Cup 2)
Musik: (Vorschlag) Ruhige Pentatonik in D-Dur. Erhu und Yanguin als Hauptakzente.
Streckenereignis: Springende Kois, die über Brücken springen und als Hindernis wirken. Über Trittsteine hüpfen als Abkürzung (Schwierigkeit).


Optik: Kirschblüten wehen über die Strecke (rein optisch), Große Pagoden stehen im off und Bonsaibäume sowie kirschblütenbäume sind verteilt. Ein Fluss fließt quer unter der Strecke durch. Laternen fliegen über die Strecke.

Legende/Erläuterung zur gezeichneten Strecke: Fahrtrichtung Uhrzeigersinn. Schwarz ist die Straße gemalt. Grün die Ziellinie. Erdweg mit Pfützen und Matsch wie gehabt. Oben ist ein Teich. Man kann die Lange Strecke fahren oder eine Abkürzung über die Steine Hopsen (vielleicht leichtes Gefälle). Neue Mechanik: Ins Wasser Fallen. Fällt man ins Wasser wird man kurz darauf wieder auf der Strecke platziert und blinkt erst und ist durchlässig für kurze Zeit. Der See in der Mitte sollte auch mit dem Fluss verbunden sein, sonst machen die zweiten Steine keinen Sinn. Braun sind die Brücken. Diese haben Geländer, dort kann man nicht runterfallen, aber dort springen die Kois. Die Kois springen auch über die Steine. 
![[Pasted image 20261007174132.png]]
# Cup 3
Stand 2026-10-11, Branch `map_pack` (Prototyping, geht nicht auf `main`). Alle drei Strecken unten sind als **Prototyp umgesetzt** (erster Wurf, Abweichungen stehen jeweils beim Status); der Rest des Textes ist der ausgearbeitete Vorschlag.

**Steigerung im Cup:** Jede Strecke ist schwerer als alles aus Cup 1 und 2 und schwerer als die vorige. Jede bevorzugt eine andere Art von Auto, damit im Cup nicht immer dasselbe Auto gewinnt.

| Nr | Strecke | Thema der Schwierigkeit | Gut für | Neue Mechaniken (klein) | Dreck-Farbe | Waschen |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | Rennstrecke | **Tempo und Präzision**: höchstes Tempo im Spiel, jeder Fehler kostet (Kies, Öl) | schnelle Autos (Flitzer, Batmobil, Polizei) | Asphalt, Kerbs, Kiesbett, Öl, Windschatten, Startampel mit Raketenstart, Brücke über die eigene Strecke, Boxengasse | schwarz (Öl) | Boxenstopp |
| 8 | Wüste | **Risiko**: Sprünge, ein Abgrund, Treibsand, ab Runde 2 Sturm mit Seitenwind | Matsch-Autos (Monster, Traktor) | Sprünge im Rennen, Schlucht mit Absturz, zwei Wege (Sprung oder Hängebrücke), Treibsand mit Sog, Wind, Pyramide als Tunnel | beige (Sand) | Oase |
| 9 | Eis | **Kontrolle**: rutschen, fliegen, einbrechen, ab Runde 2 friert die Strecke zu | wendige Autos (Quad, Krankenwagen) | Glatteis, Skisprungschanze, Bobbahn mit federnder Bande, dünnes Eis mit Rissen, Gefälle, Einschneien und Freirütteln | weiß (Schnee) | heiße Quelle |

**Gemeinsame Bausteine:** Wind (Wüste) und Gefälle (Eis) sind dieselbe Mechanik, eine Zone mit einer Kraft in eine Richtung („Schubzone“). Abgrund (Wüste), Treibsand (Wüste) und Einbrechen (Eis) verwenden das „Ins Wasser fallen“ aus dem Garten (weg, absetzen, blinken). Die Sprünge kommen aus der Matschfahrt (`updateJumps` in `src/run.js`). Alle Ereignisse hängen nur an der Rennzeit, im Zeitfahren sind sie bei jedem Versuch gleich. Neue Schalter in `PREFS.events`: `reifen`, `sandsturm`, `frost`, `pinguine`.

Reihenfolge in Einzelstrecke und Zeitfahren: … Garten, **Rennstrecke, Wüste, Eis**, Regenbogen. Cup 3 (`GOLD` in `src/cups.js`): `['RENNSTRECKE', 'WUESTE', 'EIS']`.

## 7. Rennstrecke
Status: **Prototyp umgesetzt** auf Branch `map_pack` (Streckenname `RENNSTRECKE`, Theme `ring`, Musik `circuit`, Streckenereignis Reifen `reifen`; Code in `src/ringmap.js` und `src/ring.js`). Im Cup GOLD eingetragen (mit Wüste und Eis).

Abweichungen vom Vorschlag: Start-Ziel-Gerade ist die linke Gerade (Start links, es geht nach oben, wie bei den anderen Strecken). Die Boxengasse zweigt am Anfang der unteren Geraden ab (weiße Trennlinie, schraffierte Sperrfläche), läuft hinter einer Boxenmauer neben der Start-Ziel-Geraden und fädelt vor Kurve 1 wieder ein. Rundherum Leitplanken, an den Kiesbetten Reifenstapel. Kulisse: zwei Tribünen mit winkenden Fans, Fahrerlager mit Team-Trucks, Hubschrauberlandeplatz, Großbildleinwand (zeigt deinen Platz), in die Wiese gemähte Zielflagge, Kameratürme.

Idee: Die erste Strecke mit Asphalt. Hier fährt man so schnell wie nirgends sonst im Spiel, dafür wird jeder Fehler bestraft. Sie ist eine **Acht**: Die Strecke kreuzt sich in der Mitte, einmal fährt man oben über die Brücke, einmal unten durch.

Rundenverlauf (Start unten, es geht zuerst nach links):
- 0–12 %: **Start-Ziel-Gerade** unten links (etwa x 330 bis 80, y 390), Startgitter auf dem Asphalt, Tribüne mit winkenden Fans und Fähnchen am unteren Rand. Darunter liegt die Boxengasse.
- 12–20 %: **Kurve 1** unten links, enge Rechtskurve nach oben, außen ein Kiesbett und eine Reifenstapel-Mauer.
- 20–38 %: links hoch, oben die **Schikane** (links, rechts, links) mit rot-weißen Kerbs innen.
- 38–48 %: diagonal nach rechts unten durch die Mitte, **über die Brücke**.
- 48–62 %: unten rechts die schnelle Gerade (etwa x 470 bis 700), dann rechts außen hoch.
- 62–75 %: **Haarnadel** oben rechts, die engste Kurve der Strecke. In der Bremszone liegen Ölflecken, außen Kies.
- 75–90 %: diagonal nach links unten durch die Mitte, diesmal **unter der Brücke durch** (das Auto verschwindet kurz unter der Brücke, wie beim Rohr am Kran).
- 90–100 %: schnelle Rechtskurve auf die Zielgerade.

Oberflächen:
- **Asphalt** (Strecke): grau mit weißen Randlinien. Alle Autos sind hier 8 % schneller als auf Erdwegen (Theme-Wert, z. B. `asphalt: 1.08`).
- **Kerbs** (rot-weiß, innen in den Kurven): gelten als Strecke und bremsen nicht. Sie rattern (Ton, die Kamera wackelt leicht), damit man sie spürt. Wer sie nutzt, darf etwas mehr Kurve schneiden.
- **Kiesbett** (neues Terrain, außen an Kurve 1 und der Haarnadel): bremst stärker als Matsch, Gas hilft dort kaum, macht Staub, aber nicht dreckig. Wer sich verbremst, verliert viel mehr Zeit als auf dem Gras anderer Strecken.
- **Öl** statt Matsch (neues Terrain): schwarze, schillernde Flecken. Öl bremst nicht, aber das Auto hat kaum Grip: es rutscht zur Seite weg, lenkt nur halb so gut und wird **schwarz**. Der Dreck wirkt wie Matsch-Dreck (stottert, lenkt schlechter).
- Keine Pfützen. Waschen geht nur in der Box.

**Boxengasse = Dusche** (✅ umgesetzt, Rev 2: Regel klarer; gewaschen wird nur im Boxenstopp, die Gasse ist ein Stopp über die ganze Breite; in der letzten Runde ist die Box zu, rotes Schild „BOX ZU“, Computerautos meiden sie; Start-Ziel-Gerade 3° gerade, erster Reifenwurf erst nach etwa 20 s):
- Sie läuft unter der Start-Ziel-Geraden entlang, getrennt durch eine weiße Mauer mit Einfahrt (vor Kurve 1 der Vorrunde, also vor der Zielgeraden) und Ausfahrt (hinter Kurve 1).
- In der Gasse gilt ein Tempolimit (Schild, das Auto fährt höchstens 55 %). In der Mitte steht die Box: drei Mechaniker mit Schlauch und Schlagschrauber, das Auto wird beim Durchfahren **sofort ganz sauber** (Funkspruch „BOX BOX“, Schlagschrauber-Ton).
- Die Box kostet etwa 1,5 s gegenüber der Geraden. Damit ist sie eine echte Entscheidung: schwarz und rutschig weiterfahren oder Zeit opfern.
- Die Computerautos fahren hinein, wenn sie stark verschmutzt sind (ab etwa der Hälfte).

Neue kleine Mechaniken:
- **Windschatten:** Wer auf Asphalt dicht hinter einem anderen Auto fährt (bis etwa 40 px, fast gleiche Richtung), wird bis zu 6 % schneller. Weiße Luftstreifen zeigen es an. Das gilt auch für die Computerautos. Dadurch wird auf den Geraden ständig überholt.
- **Startampel mit Raketenstart:** Statt 3-2-1 gehen fünf rote Lampen nacheinander an und dann alle aus. Wer innerhalb von 0,25 s nach dem Ausgehen Gas gibt, bekommt einen kurzen Boost (0,6 s, wie ein Boost-Pad). Wer zu früh Gas gibt, bekommt keine Strafe, nur qualmende Reifen und keinen Boost.
- **Brücke über die eigene Strecke:** Wer unten fährt, wird unter der Brücke gezeichnet und stößt nicht mit Autos zusammen, die gerade oben fahren. Die Ebene ergibt sich aus der Position auf der Runde (`c.idx`).

Streckenereignis **Reifen** (`reifen`):
- An Kurve 1, der Schikane und der Haarnadel stehen bunte **Reifenstapel** als feste Begrenzung. Sie sind weich: Das Auto prallt ab, wird gebremst, schleudert aber nicht.
- Wer hart in einen Stapel fährt, löst 1 bis 2 Reifen, die hüpfend quer über die Fahrbahn rollen und dann liegen bleiben, bis jemand sie wegschubst.
- Dazu rollt zeitgesteuert (alle 15 bis 20 s, an einer von drei Stellen) ein Reifen von der Seite quer über die Strecke. Ein Streckenposten schwenkt 2 s vorher die **gelbe Flagge**. Wer von einem Reifen getroffen wird, dreht sich wie bei der Kuh, nur kürzer.
- **Ab Runde 2 verschmiert das Öl:** Wer durch Öl fährt, zieht etwa 1 s lang eine schwarze Spur hinter sich, die selbst leicht rutschig ist. Die Ölflecken wachsen also im Lauf des Rennens die Ideallinie entlang.
- Die Computerautos weichen rollenden und liegenden Reifen aus und meiden auf höheren Schwierigkeiten das Öl.

Optik: Tribünen, Werbebanden ohne echte Marken (Fantasienamen wie bei der Rally-Lackierung), Kameraturm, Boxengebäude mit Garagen, Zielflagge an der Brücke, Streckenposten an den Kurven, Konfetti beim Zieleinlauf.

Musik `circuit`: **Eurobeat in a-Moll, 160 BPM**, gerade (kein Swing).
- Lead: Supersaw (drei leicht verstimmte Sägezähne) mit Delay, ein schneller Hook in Sechzehnteln.
- Bass: Eurobeat-Oktavbass auf den Achteln (tief, hoch, tief, hoch), leicht verzerrt.
- Drums: Four-on-the-floor-Kick, Clap auf 2 und 4, offene Hi-Hat auf dem Off-Beat, Crash alle 8 Takte.
- Motor-Sweeps: vor jedem neuen Teil ein Vorbeifahrt-Effekt (Sägezahn, der hochzieht und mit Doppler wieder fällt) und ein ansteigendes Rauschen.
- Teil A (Strophe): Am – F – G – Em | Am – F – G – G. Teil B (Refrain): F – G – Em – Am | F – G – E – E.
- **Letzte Runde:** Geht man in die letzte Runde, rückt das Lied einen Ganzton höher (h-Moll) und spielt nur noch den Refrain (die typische Eurobeat-Rückung). Dafür braucht die Musik eine Transposition und einen Haken auf die Runde des Spielers.

Neue Töne: Ampel-Pieptöne (vier tief, einer hoch), Kerbs-Rattern, Reifen-Plopp, Schlagschrauber, Funk-Knacken „BOX BOX“.

Warum schwerer als bisher: das höchste Tempo im Spiel, Kies bestraft Fehler mehr als Gras, Öl liegt genau dort, wo man bremsen muss, und durch den Windschatten bleiben die Gegner immer dicht dran.

Ursprüngliche Vorgabe:
Echte Rennstrecke mit Rennstreifen, Kerbs und Boxengasse.
Cup: Gold (Cup 3)
Musik: (Vorschlag) Treibender Eurobeat/Synth-Rock in a-Moll, schnell. Verzerrter Bass, Arpeggio-Lead, Four-on-the-floor-Drums, Motor-Sweeps.
Streckenereignis: Reifenstapel/Reifen liegen auf der Strecke und rollen gelegentlich quer. Boxenstopp ist die Dusche.
Änderung: Mud ist Öl und schwarz.

## 8. Wüste
Status: **Prototyp umgesetzt** auf Branch `map_pack` (Streckenname `WUESTE`, Theme `wueste`, Musik `desert`, Streckenereignis Sandsturm `sandsturm`; Code in `src/desertmap.js` und `src/desert.js`, gemeinsame Bausteine in `src/trackfx.js`). Im Cup GOLD eingetragen. **Rev 1** (Rework, 2026-10-16): Start auf der langen linken Geraden, S-Kurve rechts, Felsketten durch die Mitte, Oase in der oberen linken Kurve, neue Kakteen und Schlucht, Hitzeflimmern. Alte Rekorde der Wüste bleiben, die Strecke startet mit Rev 1 frisch. **Rev 2** (aus den Meldungen vom 2026-10-17, 2026-10-21): Karte 800×560, die Oase liegt oben an einem eigenen Nebenweg, die Hängebrücke an einem eigenen langen Weg unten, die Pyramide ist anderthalbmal so groß, Treibsand neben der Straße, Felskämme statt Findlingsketten, der Sturm ohne Wind, Böen und Steppenläufer. Neue Rekorde mit Rev 2.

Abweichungen vom Vorschlag (erster Wurf): Die Strecke ist ein Rechteck mit runden Ecken. ✅ umgesetzt (Rev 1: S-Kurve rechts, Felsketten schließen die Mitte, noch kein Wadi mit Kämmen an beiden Rändern). An der Oase gibt es keinen Matsch, nur flaches Wasser, das wäscht. ✅ umgesetzt (Rev 1: Matschufer um die Oase). Kein Hitzeflimmern. ✅ umgesetzt (Rev 1: die Luft flimmert über den langen Geraden oben und unten).

Idee: Die erste Rennstrecke mit **Sprüngen** und mit echtem Risiko: Wer zu langsam auf die Schanze kommt, fällt in die Schlucht. Dazu gibt es zum ersten Mal **zwei Wege**: den gefährlichen Sprung oder die langsame, sichere Hängebrücke.

Rundenverlauf (Uhrzeigersinn, Start links, es geht zuerst nach oben):
- 0–12 %: Start links auf der langen Geraden (die Aufstellung steht komplett gerade). Oben, kurz nach der Kurve, zweigt ein schmaler Weg zur **Oase** ab (ein Schild mit Wassertropfen zeigt ihn an): er führt am oberen Kartenrand durch das flache Wasser des Teichs (wäscht, aber nicht sofort) und wieder zurück auf die Gerade, etwas länger als der direkte Weg. Palmen, Kamele, ein Matschufer neben dem Weg, die tiefe Mitte ist tiefes Wasser. Die Computerautos nehmen den Weg, wenn sie dreckig sind.
- 12–28 %: oben die **Buckelpiste**: drei Dünen hintereinander, jeder Dünenkamm ist ein kleiner Sprung. Schnelle Autos fliegen weiter. Wer schräg abspringt, landet neben der Strecke im Sand.
- 28–45 %: **durch die große Pyramide** oben rechts (240 px breit): Einfahrt an der Westseite, Ausfahrt an der Südseite, drinnen eine lange Gerade, die Kurve und der Anfang der S-Kurve. Wer drinnen ist, sieht das Dach der Pyramide durchsichtig. Innen ist es neben der Straße tief dunkel, über der Straße nur gedämpft, sodass man den Weg immer sieht; wenige Fackeln, das eigene Licht als ein weicher Kegel. Skarabäen krabbeln an den Wänden (nur Optik). In der Pyramide gibt es keinen Sandsturm.
- 45–58 %: rechts herunter, etwa 80 px nach dem Pyramidenausgang, zwei versetzte **Kakteen** auf der Fahrbahn. Danach Anlauf bis zur Rampe.
- 58–68 %: die **Schlucht** (Wadi, sie kommt als schmaler Riss unter einer Felswand mit trockenem Wasserfall und wird breiter, mit ausgefranstem Rand), zwei Wege:
  - **Sprung** (kurzer Weg): Die Rampe aus Felsen ist so breit wie die Straße, dahinter ist ein dunkler Abgrund, dann die Landung. Ab etwa 70 % der Höchstgeschwindigkeit fliegt man hinüber. Wer schief landet, dreht sich und verliert Tempo. Wer zu langsam ist (z. B. nach einem Kaktus), fällt hinein: 1,4 s weg, wird hinter der Schlucht abgesetzt und blinkt (wie beim Wasser im Garten). Das kostet etwa 2 s.
  - **Hängebrücke** (langer, sicherer Weg): vor der Rampe zweigt ein schmaler Weg nach unten ab, führt über eine wackelige Brücke für ein Auto (bremst auf etwa 60 %) und kommt hinter der Schlucht zurück. Sicher, aber deutlich langsamer als ein guter Sprung.
- 68–85 %: unten drei **Treibsand**-Felder, deren Mitte neben der Straße liegt (abwechselnd oben und unten); ihr Rand reicht in die Fahrbahn und zieht das Auto hinaus.
- 85–100 %: zurück nach links zur Oase und ins Ziel.

Oberflächen:
- **Sandpiste** (Strecke): hell ockerfarben, Reifenspuren sind deutlich zu sehen.
- **Dünen** (neben der Strecke): bremsen wie bisher das Gras, aber das Auto wird **sandig beige** (im Gegensatz zum Gras auf anderen Strecken, das sauber lässt).
- **Matsch** gibt es nur am Rand der Oase (braun).
- **Treibsand** (neues Terrain): große, unregelmäßige Mulden neben der Straße, dunkel mit fast schwarzem Rand und einem Wirbel aus hellen und dunklen Armen, der sich dreht. Treibsand bremst stark und **zieht zur Mitte** (Sog, am Rand schwach und zur Mitte stärker). In der Mitte sinkt das Auto ein (es wird kleiner gezeichnet, Sand rieselt) und ist nach 1,2 s verschwunden, dann wird es wie beim Wasser wieder abgesetzt, und zwar beige. Mit Vollgas kommt man am Rand wieder heraus. Matsch-Autos (Monster, Traktor) zieht der Sog weniger stark (Sog-Stärke durch `mud` geteilt).
- **Kakteen**: feste Hindernisse (groß, dunkelgrün, mit Steinkranz und langem Schatten). Wer hart dagegenfährt, dreht sich kurz, es fliegen Stacheln, Text „AUTSCH!“. Langsames Anrempeln schiebt nur zurück. Die kleinen, blassen Kakteen in den Dünen sind nur Deko, man fährt darüber.
- **Felskämme**: lange Rücken aus Sandstein mit Sonnen- und Schattenseite, Schichten und Geröll am Fuß, von links über die kleinen Pyramiden bis zum Kopf der Schlucht und zur großen Pyramide, fest. Man kann nicht durch die Mitte abkürzen.

Streckenereignis **Sandsturm** (`sandsturm`):
- Sobald du in Runde 2 gehst, zieht von rechts eine Sandwand heran (sie wandert in etwa 6 s über die Karte, wie die Flut am Strand) und bleibt bis zum Ende des Rennens.
- **Sicht:** Das Bild wird leicht ockerfarben eingetrübt, um jedes Auto und vor ihm ist es klarer. Die Ziellinie und die Pyramide bleiben frei.
- **Sand:** Um jedes Auto wirbelt Sand hoch, die Autos werden langsam sandig (die Oase wäscht sie wieder).
- ~~Wind und Böen~~: entfernt in Rev 2 (machten keinen Spaß).
- **Verwehungen:** Nacheinander weht an drei Stellen Sand auf die Strecke (wie die Löcher im Wald-Regen). Verwehungen bremsen wie Matsch und machen beige.
- ~~Steppenläufer~~ und Windsäcke: entfernt in Rev 2.
- Der Sturm verweht die Reifenspuren.
- Die Computerautos: Auf leichter Schwierigkeit nehmen sie die Hängebrücke, auf schwerer springen sie. Sie fahren auch dann über die Brücke, wenn sie zu langsam für den Sprung sind, und zur Oase, wenn sie dreckig sind. Treibsand meiden sie immer, auch den Rand.

Optik: drei Pyramiden (eine große als Tunnel, zwei kleine als Kulisse), Sphinx am Kartenrand, Felsen, Tierschädel, Palmen an der Oase, Kamele, leichtes Hitzeflimmern über der Sandpiste, ein Geier zieht seine Kreise (Schatten auf dem Boden).

Musik `desert`: **phrygisch-dominant auf D** (D, Es, Fis, G, A, B, C), **132 BPM**.
- Lead: Schlangenbeschwörer-Flöte (näselnd, mit Vibrato und Gleiten zwischen den Tönen).
- Oud: gezupfte Arpeggios und Tremolo, mit kurzem Anschlag und einem kleinen Bend am Tonanfang.
- Darbuka im Maqsum-Rhythmus (Dum, Tek, Tek, Dum, Tek), dazu Fingerzimbeln auf den Zählzeiten.
- Bass: Bordun auf D mit der Quinte A. Im Teil B eine laufende Basslinie.
- Teil A (Karawane): D – Es – D – D | Gm – Es – D – D. Teil B (Basar, höher, Läufe im Unisono): Cm – B – Es – D | Gm – Cm – Es – D.
- **Bei Sandsturm** kommt eine Rausch-Schicht (Wind) dazu, und die Darbuka spielt doppelt so schnell.

Neue Töne: Sandrieseln (Treibsand), Windheulen und Böen, „AUTSCH“ (Kaktus), Knarren der Hängebrücke, Fallen in die Schlucht (Pfeifen, das tiefer wird, dann ein dumpfer Plopp).

Warum schwerer als die Rennstrecke: Hier kann man richtig abstürzen. Die Entscheidung Sprung oder Brücke muss man in jeder Runde neu treffen. Ab Runde 2 sieht man wenig, und der Wind schiebt einen genau dann, wenn man in der Luft ist.

Ursprüngliche Vorgabe:
Wüstenkurs mit Pyramiden und Kakteen.
Cup: Gold (Cup 3)
Musik: (Vorschlag) Orientalische Tonleiter (phrygisch dominant) in d-Moll. Oud, Darbuka, Zimbeln, Schlangenbeschwörer-Flöte.
Streckenereignis: Sandsturm (nach Runde 1) schränkt die Sicht ein und schiebt Autos seitlich. Treibsand-Flecken bremsen stark.
Änderung: Kakteen als Hindernisse. Pyramiden als Streckenbegrenzung/Tunnel.

## 9. Eis
Status: **Prototyp umgesetzt** auf Branch `map_pack` (Streckenname `EIS`, Theme `eis`, Musik `ice`, Streckenereignisse Frost `frost` und Pinguine `pinguine`; Code in `src/icemap.js` und `src/ice.js`, gemeinsame Bausteine in `src/trackfx.js`). Im Cup GOLD eingetragen.

Abweichungen vom Vorschlag (erster Wurf): Die Bobbahn ist eine Haarnadel oben rechts. Die Lawinen gehören zum Ereignis Frost. Das Polarlicht war im ersten Wurf ein schlichter Farbschleier, die Musikschichten wechselten mit der Runde, nicht mit dem Ereignis (beides behoben, siehe Überarbeitung).

**Überarbeitung 2026-10-16** (`rev` 1, Strecke und Rekorde neu): Die Startlinie liegt jetzt auf der langen linken Geraden (y 135, 200 px Gerade dahinter, 3°). Das Innenfeld ist ein fester **Gletscher** (Klippe mit Schatten, Spalten), daher kein Abkürzen durch die Mitte; sein Fuß hat eine Bucht für die **Pinguinkolonie**, und der **Gletscherbach** entspringt einem Gletschertor am Fuß des Gletschers. Ein Felsgrat schließt die Lücke zwischen den beiden Beinen rechts, ein zweiter bildet die Oberkante des **Lawinenhangs** (schattierter Hang mit Felsbrocken, die Lawine endet auf der Straße). Der Tiefschnee liegt als zwei **Schneewehen** an der Außenseite der U-Kurven und wächst von dort herein, die Ideallinie bleibt frei. Der Wall am Straßenrand ist flach und blass (befahrbar), alles Feste ist dunkel mit Schatten. Die Pinguine watscheln von der Bucht über die U-Strecke zum See. Eine schräge Landung nach der Schanze schneit das Auto ein. Die Breakbeat-Schicht des Liedes kommt nur mit dem Ereignis Frost.

Idee: Die wildeste Strecke von Cup 3. Es geht um **Kontrolle**: rutschen, fliegen, einbrechen. Man springt von einer Skischanze, fährt durch eine Bobbahn, kann über einen zugefrorenen See abkürzen, der immer brüchiger wird, und ab Runde 2 friert die Strecke zu.

Rundenverlauf (Uhrzeigersinn, Start links, es geht zuerst nach oben):
- 0–12 %: Start links am **Bergdorf**: Skihütte mit warmen Fenstern, Schneemann, Rodel am Zaun. Die Strecke ist hier festgefahrener Schnee.
- 12–28 %: oben die **Skisprungschanze**: ein blau markierter Anlauf mit Boost-Pad, dann der Schanzentisch und ein **großer Sprung** (etwa 1 s in der Luft, viel weiter als die Dünen in der Wüste). Die Landung ist ein vereister Hang, man rutscht nach dem Aufsetzen weiter. Ein Absturz ist hier nicht möglich, es geht nur darum, gerade zu landen.
- 28–45 %: oben rechts die **Bobbahn**: eine Eisrinne mit hohen Wänden, eine 180°-Kurve, eng und glatt. Die Bande **federt**: Wer sie streift, gleitet an ihr entlang, ohne Tempo zu verlieren. Wer außen an der Bande fährt, ist hier schnell.
- 45–62 %: rechts hinunter am **Lawinenhang** vorbei zur Frostkurve unten rechts; dann das U nach oben und links, mit zwei **Schneewehen** außen in den Kurven und der **Pinguinkolonie** in der Bucht am Gletscherfuß (die Pinguine queren hier die Strecke zum See).
- 62–80 %: unten der **zugefrorene See**:
  - Die Hauptstrecke führt außen um den See herum.
  - **Abkürzung** quer über das Eis: Es ist Glatteis, und das Eis ist dünn. Bei jedem Auto, das darüberfährt, bekommt die Stelle **Risse** (sichtbar, mit Knacken). Nach etwa acht Überfahrten an einer Stelle bricht dort ein **Loch** auf: Wer hineinfährt, ist 1,4 s weg (Spritzer, Auto sauber) und wird am Ufer abgesetzt. Ein Loch friert nach etwa 20 s wieder zu (zuerst dünn und hellblau). Die Abkürzung lohnt sich also am Anfang des Rennens sehr und wird zum Ende hin immer gefährlicher.
- 80–100 %: über eine Holzbrücke über den Gletscherbach, dann die **vereiste Abfahrt** zum Ziel (Gefälle: Das Auto wird bergab schneller und kann auf dem Eis schlecht bremsen).

Oberflächen:
- **Festgefahrener Schnee** (Strecke): weiß mit blauen Schatten, Reifenspuren grau. Fährt sich normal.
- **Tiefschnee** statt Matsch: bremst wie Matsch und macht das Auto **weiß**. Ein verschneites Auto hat eine Schneehaube auf dem Dach.
- **Glatteis** (neues Terrain, blau-weiß glänzend): volle Geschwindigkeit, aber seitlich kaum Grip (etwa ein Achtel), halbe Lenkung, Gas und Bremse halb so wirksam (die Räder drehen durch). Hier zählt der Wert `turn` mehr als alles andere.
- **Heiße Quelle** statt Pfützen und Waschanlage: ein dampfendes Becken am Rand der Abfahrt reicht in die Strecke. Es wäscht den Schnee ab und friert nie zu.
- **Gefälle** (Schubzone): Auf der Abfahrt und am Landehang der Schanze schiebt eine Kraft bergab (dieselbe Mechanik wie der Wind in der Wüste).
- **Bande der Bobbahn**: fest, federt aber ohne Tempoverlust (neue Art von Wand).

Streckenereignis **Frost** (`frost`):
- Runde 1: leichter Schneefall, die Strecke ist griffig.
- Sobald du in Runde 2 gehst, setzt Frost ein: An drei Kurven wachsen nacheinander **Eisblumen** vom Rand über die Strecke (wie das Umfärben beim Regen und bei der Flut), danach sind diese Kurven Glatteis. Der Schneefall wird dichter.
- **Lawine:** Ab Runde 2 löst sich am Hang rechts etwa alle 20 s eine Lawine. Eine **Schneekugel** rollt den Hang hinunter, wird dabei größer und quert die Strecke. Vorher kündigen sie ein Grollen, ihr Schatten und der Text „LAWINE!“ an. Wer getroffen wird, ist **eingeschneit**: Das Auto steckt als weißer Klumpen fest, bis es sich freigerüttelt hat (etwa 1 s; wer dabei wiederholt Gas gibt, ist schneller frei). Danach ist es weiß. Wo die Kugel zerplatzt, bleibt ein Haufen Tiefschnee auf der Strecke liegen.
- **Letzte Runde:** Über dem See leuchtet ein Polarlicht, das sich im Eis spiegelt (nur Optik, aber der große Moment des Cups). ✅ umgesetzt (Eis überarbeitet: drei Vorhänge mit senkrechten Strahlen über dem Gletscher, gespiegelt und grün leuchtend im Seeeis).

Streckenereignis **Pinguine** (`pinguine`):
- Eine Pinguinkolonie steht an der rechten Seite. Alle paar Sekunden watschelt eine kleine Gruppe über die Strecke, oder ein Pinguin rutscht auf dem Bauch quer über das Eis des Sees (zeitgesteuert).
- Sie sind Hindernisse wie die Kühe: Wer hart dagegenfährt, schleudert und dreht sich, der Pinguin quäkt. Die Computerautos weichen aus.

Computerautos: Auf Glatteis wandern sie weniger auf der Strecke und bremsen früher. Die Abkürzung über den See nehmen sie, solange es dort noch kein Loch gibt (auf höherer Schwierigkeit auch an den Löchern vorbei).

Optik: verschneite Tannen, Skilift mit Gondeln am Kartenrand (nur Kulisse), Skihütte, Schneemänner, Eiszapfen an der Brücke, Fahnen an der Schanze, Dampf über der heißen Quelle, Schneeflocken über der ganzen Karte.

Musik `ice`: **h-Moll**, baut sich mit dem Rennen auf (Musik in Schichten, abhängig von der Runde):
- **Runde 1 (Winterwunderland), 84 BPM gefühlt:** Celesta-Melodie, Glockenspiel als Echo, weiche Streicherflächen, Schlittenglöckchen auf den Achteln, kaum Bass. Das ist die ursprüngliche Vorgabe.
- **Ab dem Frost (Runde 2), 168 BPM:** Ein schneller Breakbeat setzt ein (Drum and Bass), dazu ein tiefer Sub-Bass. Aus der Celesta-Melodie werden schnelle Arpeggios („Eiskristall“).
- **Letzte Runde:** Chorfläche („Aah“), Streicher-Ostinato in Sechzehnteln, Pauke.
- Teil A: Hm – G – D – A | Em – G – Fis7 – Hm. Teil B: G – A – Fism – Hm | Em – Fis7 – Hm – Hm.
- Vor jeder Lawine liegt ein tiefer Paukenwirbel unter der Musik.

Neue Töne: Knacken (Risse), Einbrechen (Platschen), Lawinengrollen, Pinguin-Quäken, Federn der Bande (dumpfes „Bonk“), Freirütteln (Schnee knirscht).

Warum am schwersten: Fast überall droht man die Kontrolle zu verlieren. Die Strecke wird ab Runde 2 von Runde zu Runde glatter, die Abkürzung zum Ende hin immer gefährlicher, und die Lawine kann einen ganz stoppen. Gleichzeitig ist sie die spektakulärste Strecke (Schanze, Bobbahn, Polarlicht).

Ursprüngliche Vorgabe:
Eisflächen und Schnee.
Cup: Gold (Cup 3)
Musik: (Vorschlag) Funkelnde Winterstimmung in h-Moll. Celesta, Glockenspiel, Streicher-Pads, weiche Sleigh-Bells, wenig Bass.
Streckenereignis: (Vorschlag) Ab Runde 2 friert ein Teil der Strecke zu, Eisflächen lassen Autos rutschen. Schneefall nimmt zu.
Änderung: Schnee bremst (wie Mud), Eis rutscht (wenig Grip).


# Cup 4
Stand 2026-10-13, Branch `map_pack`. Vulkan, Dschungel und Weltall sind als **Prototyp umgesetzt** (Abweichungen beim Status).

**Steigerung im Cup:** In Cup 3 waren die Strecken schwer zu fahren. In Cup 4 wird **die Strecke selbst zum Gegner**: Sie verändert sich während des Rennens, Wege gehen auf und zu, und man muss vorausschauen statt nur gut zu lenken. Jede Strecke bevorzugt wieder eine andere Art von Auto.

| Nr | Strecke | Thema der Schwierigkeit | Gut für | Neue Mechaniken (klein) | Dreck-Farbe | Waschen |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | Vulkan | **Zeitdruck**: Lava öffnet und sperrt Wege, ab Runde 2 Ausbruch mit Lavabomben | robuste Autos (Feuerwehr, Monster, Batmobil) | Lava, Krustenbrücke, Geysir-Schanze, Lavaröhre, Hitze-Anzeige, Lavabomben mit Vorwarnung, gesperrte Wege | grau-schwarz (Asche) | Wasserfall |
| 11 | Dschungel | **Übersicht**: Laub verdeckt die Strecke, viele Abzweigungen, Fallen im Tempel | wendige Matsch-Autos (Quad, Foodtruck, Feuerwehr) | Laubdach, Lianenschwung, Strömung im Fluss, Krokodile, rollende Steinkugel, umstürzende Bäume als Schanzen | grün (Sumpf) | Wasserfall im Tempel |
| 12 | Weltall | **Schwung**: wenig Grip, Schwerkraft zieht, Abkürzungen durch Wurmlöcher | Autos mit viel Beschleunigung (Quad, Rally Car, Flitzer) | Schwerelosigkeit, Schwerkraft eines Planeten mit Swing-by, Wurmloch (Teleport), Traktorstrahl statt Absturz, schwarzes Loch | silbergrau (Mondstaub) | Luftschleuse |

**Gemeinsame Bausteine:** Fast alles baut auf Cup 3 auf. Die Schubzone (Wind, Gefälle) wird zur Strömung im Fluss und zur Schwerkraft eines Planeten (dort zeigt die Kraft zur Mitte, wie der Sog im Treibsand, nur ohne Einsinken). Das „Ins Wasser fallen“ aus dem Garten ist hier Lava, Fluss und Weltall (weg, absetzen, blinken). Die Sprünge kommen aus der Matschfahrt. Das Sichtfeld aus dem Wald (Scheinwerfer) gibt es in der Lavaröhre und im Tempel. **Neu für den ganzen Cup:** Strecken, die sich zeitgesteuert öffnen und schließen („Weg zu“), immer mit Vorwarnung (Blinken, Text, Ton), damit es fair bleibt. Alle Ereignisse hängen nur an der Rennzeit, im Zeitfahren sind sie bei jedem Versuch gleich. Neue Schalter in `PREFS.events`: `ausbruch`, `baeume`, `kroko`, `asteroiden`, `schwarzesloch`.

Reihenfolge in Einzelstrecke und Zeitfahren: … Eis, **Vulkan, Dschungel, Weltall**, Süßigkeitenland, Spielzimmer, Regenbogen. Cup 4 (`PLATIN` in `src/cups.js`): `['VULKAN', 'DSCHUNGEL', 'WELTALL']` ✅ umgesetzt (Weltall-Prototyp).

## 10. Vulkan
Status: **Prototyp umgesetzt** auf Branch `map_pack` (Streckenname `VULKAN`, Theme `vulkan`, Musik `volcano`, Streckenereignis Ausbruch `ausbruch`; Code in `src/volcanomap.js` und `src/volcano.js`). Im Cup PLATIN eingetragen.

Abweichungen vom Vorschlag (erster Wurf): Die Serpentine hat zwei Kehren und eine Kurve. Zwischen den beiden Brücken der Furt steht ein fester Steinsteg (sonst fuhren zu viele in die Lavalücke). Der Lavastrom des Ausbruchs überspült nur eine Hälfte der Straße an der mittleren oder oberen Kehre (keine eigene Geröllspur). In der letzten Runde steigt der Lavasee nicht. Die Computerautos nehmen die Geysir-Abkürzung nie. Kein Hitzeflimmern.

Idee: Man fährt einmal um einen aktiven Vulkan herum und dabei hinauf bis an den Kraterrand. Die Lava ist kein Matsch, in den man fahren darf, sondern **sperrt Wege**: Manche Abkürzungen sind nur offen, solange die Lava gerade ruht. Wer vorausschaut, nimmt den offenen Weg, wer blind fährt, landet im Umweg oder in der Lava.

Rundenverlauf (Uhrzeigersinn, Start links, es geht zuerst nach oben):
- 0–10 %: Start links an der **Forschungsstation** (Container mit Antennen, Messgeräte, ein Forscher mit Helm winkt). Die Strecke ist erkaltete Lava: dunkelgrauer, rissiger Fels.
- 10–25 %: links die Flanke hinauf, eine **Serpentine** mit drei Kehren. Die Steigung ist eine Schubzone gegen die Fahrtrichtung (bergauf langsamer, Autos mit viel `acc` leiden weniger).
- 25–40 %: oben der **Kraterrand**: ein schmaler Ring um den glühenden Lavasee in der Mitte der Karte. Außen Geröll, innen ein flacher Rand aus Lava (siehe Lava unten). Hier gibt es die erste Wahl:
  - **Krustenbrücke** (Abkürzung): Ein Lavastrom fließt aus dem Krater nach außen. Über ihm liegt eine dunkle Kruste, über die man fahren kann. Alle etwa 12 s bricht der Strom durch: Die Kruste glüht 2 s lang immer heller auf (Knistern, Text „HEISS!“), dann ist sie 4 s lang Lava, dann kühlt sie wieder ab (von rot über orange zu grau).
  - **Außenweg**: um den Strom herum über eine Steinbrücke, sicher, etwa 1,5 s länger.
- 40–55 %: rechts hinunter die **Geysir-Schanze**: Unter der Strecke liegt ein Dampfgeysir vor einem Lavagraben. Er pustet alle 6 s für 2 s (Dampfsäule, Zischen, vorher blubbert es). Wer fährt, während er pustet, wird über den Graben geschleudert (großer Sprung, Abkürzung). Wer ihn verpasst, nimmt den Bogen um den Graben. Wer langsam auf den Graben zufährt, ohne dass der Geysir pustet, bremst automatisch an einer Felskante (kein Absturz, nur Zeitverlust).
- 55–70 %: unten rechts in die **Lavaröhre**: ein Tunnel aus erstarrter Lava. Innen ist es dunkel (Scheinwerfer wie im Wald), durch Risse in den Wänden glüht es orange. Die Röhre macht eine S-Kurve. Fledermäuse flattern aus dem Licht weg (nur Optik).
- 70–88 %: unten die **Lavafurt**: Ein breiter Lavastrom fließt von rechts nach links unter der Strecke durch. Zwei Steinbrücken führen hinüber (wie die Weiche beim Zug). Immer eine davon wird von der Lava überspült: Die Lava steigt dort langsam über den Rand, die Brücke ist dann gesperrt (glühend, man kann nicht drauf, eine feste Lavawelle). Ein Steinsymbol mit grünem und rotem Licht am Ufer zeigt 3 s vorher, welche Brücke als Nächstes offen ist.
- 88–100 %: zurück nach links zur Station, am **Wasserfall** vorbei ins Ziel.

Oberflächen:
- **Erkaltete Lava** (Strecke): dunkelgrau mit feinen Rissen, durch die es an manchen Stellen schwach rot glimmt. Reifenspuren sind hellgrau.
- **Asche** statt Matsch: hellgraue, staubige Felder. Bremst wie Matsch und macht das Auto **grau-schwarz** (rußig). Beim Durchfahren steigt Staub auf.
- **Lava** (neues Terrain, leuchtend orange mit dunkler, langsam fließender Kruste): Wer darauf kommt, „hüpft wie auf der heißen Herdplatte“: Das Auto springt hoch, qualmt, Text „AUA, HEISS!“, ist 1,4 s weg und wird an der letzten sicheren Stelle wieder abgesetzt (wie das Wasser im Garten). Danach ist es rußig schwarz. Es wird nichts kaputt, es ist nur peinlich und kostet Zeit.
- **Wasserfall**: Am Rand der Zielgeraden stürzt ein Bach vom Berg, sein Becken reicht in die Strecke (wie eine Stranddusche, nur breiter). Er wäscht die Asche ab und kühlt das Auto (siehe Hitze).

Neue kleine Mechanik **Hitze**:
- Jedes Auto hat eine Hitze-Anzeige (kleines Thermometer im HUD, beim Spieler gut sichtbar, bei den Gegnern als Rauchfahne). Nah an Lava (bis etwa 30 px) wird es heiß, sonst kühlt es langsam ab.
- Ist das Auto ganz heiß, qualmt der Motor, es fährt bis zum Abkühlen nur 85 %. Wasser (Wasserfall, Geysir-Dampf zählt nicht) kühlt sofort.
- **Feuerwehr-Bonus:** Die Feuerwehr hat einen Wassertank und wird nur halb so schnell heiß. Bei voller Hitze spritzt sie sich selbst ab (kleine Wasserfontäne), statt zu qualmen. Damit hat die Feuerwehr endlich ihre Strecke.

Streckenereignis **Ausbruch** (`ausbruch`):
- Runde 1: Der Vulkan raucht nur, ab und zu grollt es, und die Kamera wackelt leicht.
- Sobald du in Runde 2 gehst, bricht er aus: großer Knall, eine Rauchsäule steigt aus dem Krater, der Himmel wird dunkelrot, und es regnet feine Asche (wie der Regen im Wald, nur grau und langsam).
- **Lavabomben:** Alle 3 bis 5 s fliegt eine glühende Kugel aus dem Krater. Wo sie landen wird, erscheint 1,5 s vorher ein roter Zielkreis auf dem Boden, der kleiner wird (gut lesbar für Kinder). Beim Einschlag: Wer im Kreis steht, wird wie bei der Kuh weggeschleudert und ist rußig. Dort bleibt 5 s lang ein kleiner Lavafleck liegen, der dann zu Asche erkaltet (die Strecke wird also im Lauf des Rennens immer aschiger).
- **Lavastrom an der Serpentine:** Ab Runde 2 läuft ein schmaler Strom die Flanke hinunter und überspült abwechselnd die mittlere oder die obere Kehre. Dann gibt es dort eine kurze Ausweichspur über Geröll (bremst wie Gras). Auch hier glüht es vorher auf.
- Die Krustenbrücke bricht in Runde 2 doppelt so oft durch.
- **Letzte Runde:** Der Lavasee im Krater steigt, der Kraterrand wird schmaler (innen wird ein Streifen zu Lava). Funkenregen über der ganzen Karte.
- Die Computerautos sehen die Vorwarnungen wie du: Sie nehmen die Krustenbrücke nur, wenn sie sicher hinüberkommen, und weichen Zielkreisen aus (auf leichter Schwierigkeit nicht immer).

Optik: Lavasee mit Blasen, die platzen, Hitzeflimmern über aller Lava, verkohlte Baumstümpfe, Basaltsäulen am Kartenrand, Dampfwolken aus Spalten, die Forschungsstation mit Seismograph (die Nadel schlägt bei jedem Grollen aus), ein Hubschrauber kreist in Runde 2 über dem Krater.

Musik `volcano`: **c-Moll, 150 BPM**, Metal-Orchester.
- Taiko-Trommeln (tiefe Toms mit langem Hall) tragen den Rhythmus, dazu Brass-Stabs (kurze, laute Blechbläser-Akkorde auf der 1 und der 3+).
- Verzerrte Gitarre: Sägezahn durch einen Waveshaper, Palm-Mute-Achtel auf dem Grundton, im Refrain Powerchords.
- Bass: folgt der Gitarre eine Oktave tiefer.
- Teil A: Cm – As – B – G | Cm – As – Fm – G. Teil B: As – B – Cm – Cm | Fm – G – As – G.
- **Ab dem Ausbruch (Runde 2):** Doublebass-Drums (Kick in Sechzehnteln) setzen ein, ein Chor („Ah“, tief) liegt unter den Stabs.
- **Letzte Runde:** Das Tempo steigt auf 160 BPM, die Brass-Stabs spielen die Melodie mit.
- Vor jeder Lavabombe ein kurzer, abfallender Pfeifton (wie die Schlucht in der Wüste, nur höher).

Neue Töne: Grollen, Knall des Ausbruchs, Zischen (Geysir, Lava auf Wasser), Blubbern, Einschlag der Lavabombe, „AUA, HEISS!“, Knistern der Kruste, Motor qualmt (stotterndes Husten).

Warum schwerer als die Eis-Strecke: Die Strecke ist jede Runde eine andere. Man muss die Vorwarnungen lesen und vorausplanen (Kruste, Geysir, Furt), und ab Runde 2 kommt von oben noch etwas dazu.

Ursprüngliche Vorgabe:
Strecke über erkaltete Lava, Lavaströme und Felsen.
Cup: Platin (Cup 4)
Musik: (Vorschlag) Bedrohlicher Metal/Orchester-Mix in c-Moll. Tiefe Taiko-Trommeln, Brass-Stabs, verzerrte Gitarre, Doublebass-Drums.
Streckenereignis: (Vorschlag) Ausbruch ab Runde 2: Lavabomben schlagen auf der Strecke ein, Lavaströme sperren zeitweise Teile der Strecke.
Änderung: Mud ist Lava (hohe Verlangsamung), Hitzeflimmern. **Angepasst:** Matsch ist Asche (bremst), Lava ist ein Absturz wie das Wasser im Garten, weil „Lava, die nur bremst“ sich falsch anfühlt.

## 11. Dschungel
Status: **Prototyp umgesetzt** auf Branch `map_pack` (Streckenname `DSCHUNGEL`, Theme `dschungel`, Musik `jungle`, Streckenereignisse Bäume `baeume` und Krokodile `kroko`; Code in `src/junglemap.js` und `src/jungle.js`). Im Cup PLATIN eingetragen.

Abweichungen vom Vorschlag (erster Wurf): Die Strecke ist ein Rechteck mit runden Ecken. Die Tempelhalle hat keine zwei Ausgänge, die Steinkugel rollt am Ende nicht in den Fluss, sondern verschwindet. Wer von der Baumstammbrücke fällt, wird nicht vom Fluss mitgetragen, sondern vor der Schlucht abgesetzt. Keine Affen, keine Nebelschwaden, keine Glühwürmchen unter dem Laubdach. Die Computerautos fliehen nicht extra vor der Steinkugel.

Idee: Eine Expedition zu einer Tempelruine. Der Dschungel ist dicht: **Das Laubdach verdeckt Teile der Strecke**, es gibt Abzweigungen, und man sieht Gegner und Hindernisse erst spät. Die Strecke belohnt, wer sie kennt. Dafür ist sie die abwechslungsreichste in Cup 4 (Liane, Fluss, Tempel).

Rundenverlauf (Uhrzeigersinn, Start links, es geht zuerst nach oben):
- 0–12 %: Start links im **Expeditionslager** (Zelte, Jeep, Kisten, Lagerfeuer). Die Strecke ist ein Erdweg wie in Cup 1, mit Sumpfstellen.
- 12–28 %: oben unter dem **Laubdach**: Riesige Bäume schließen sich über der Strecke. Man sieht dort nur Blätter (dunkelgrün, bewegt), keine Strecke. Fährt ein Auto darunter, wird das Laub über ihm durchsichtig, wie das Dach der Pyramide in der Wüste. Man sieht also nur seine eigene Umgebung (Radius etwa 60 px), alles andere bleibt verdeckt. Unter dem Dach gibt es eine **Gabelung**: links ein schneller, aber sumpfiger Weg, rechts ein trockener Umweg.
- 28–40 %: oben rechts die **Lianenschlucht**: Eine Schlucht quert die Strecke. Darüber schwingt eine dicke Liane hin und her (Pendel, etwa 3 s pro Schwung). Steht sie auf deiner Seite, wenn du an der Kante ankommst, greift dein Auto sie automatisch (Tarzan-Schrei) und schwingt hinüber, das ist schnell. Ist sie gerade auf der anderen Seite, nimmst du die **Baumstammbrücke** daneben: schmal, ein Auto breit, wer sie verfehlt, fällt in den Fluss (wie im Garten, nur wird man hier vom Fluss etwas mitgetragen).
- 40–55 %: rechts in die **Tempelruine**: ein Gang aus großen Steinblöcken mit Statuen, dunkel (Scheinwerfer), Fackeln an den Wänden. In der Mitte eine Halle mit Schatztruhe (Optik) und zwei Ausgängen. Die Wände sind mit Moos und Wurzeln bewachsen.
- 55–70 %: unten rechts die **Furt**: Man fährt quer durch einen flachen Fluss. Die **Strömung** schiebt alle Autos nach unten (Schubzone). Wer zu weit abtreibt, kommt ins tiefe Wasser (Absturz wie im Garten). Mitten in der Furt liegen Steine (fest) und Baumstämme.
- 70–88 %: unten der **Sumpf** mit Mangroven: viele Sumpfstellen, dazwischen ein Bohlenweg (schmal, schnell, ohne Sumpf).
- 88–100 %: zurück zum Lager und ins Ziel.

Oberflächen:
- **Erdweg** (Strecke): wie in Cup 1, dunkler und feuchter.
- **Sumpf** statt Matsch: grünbraunes Wasser mit Entengrütze. Bremst wie Matsch und macht das Auto **grün**. Im Sumpf hängen danach ein paar Blätter am Auto (Optik).
- **Tiefer Sumpf** (wenige Stellen, dunkel, blubbert): verhält sich wie der Treibsand der Wüste (Sog, Einsinken), aber schwächer.
- **Fluss**: flach = Strömung (Schubzone, wäscht dabei ein wenig), tief = Absturz.
- **Wasserfall im Tempel**: In der Tempelhalle fällt Wasser durch ein Loch in der Decke (Lichtstrahl, Gischt). Wer durchfährt, ist sauber.

Streckenereignis **Bäume** (`baeume`):
- An vier Stellen stehen morsche Bäume an der Strecke. Zeitgesteuert (alle 15 bis 20 s, versetzt) knarrt einer, Blätter rieseln, sein Schatten wandert über die Strecke, dann fällt er quer über die Fahrbahn (Rumms, Staub, die Kamera wackelt).
- Wer getroffen wird, wird wie bei der Kuh weggeschleudert.
- Der liegende Stamm bleibt bis zum Ende des Rennens liegen und ist ab dann eine **kleine Sprungschanze** (Sprünge aus der Matschfahrt): Wer schnell genug ist, hüpft drüber, wer langsam ist, holpert und wird stark gebremst. So wird die Strecke von Runde zu Runde „hüpfiger“.
- Ab Runde 2: In der Tempelhalle löst sich die **Steinkugel**. Wer als Erster in Runde 2 den Tempel betritt, hört ein Klicken, dann rollt eine große Steinkugel durch den Gang hinter ihm her (in Fahrtrichtung, etwa 90 % der Höchstgeschwindigkeit eines mittleren Autos). Wer langsamer ist, wird von ihr überrollt (plattgedrückt gezeichnet, kurz weg, dann wieder rund mit „PLOPP“). Am Ausgang rollt sie in den Fluss. Sie kommt danach immer, wenn jemand die Halle betritt und sie wieder oben ist (alle 15 s). Für kleine Kinder lustig, für Profis eine Jagd.

Streckenereignis **Krokodile** (`kroko`):
- In der Furt und im Sumpf liegen Krokodile, die wie Baumstämme aussehen (nur die Augen schauen heraus). Zeitgesteuert tauchen sie auf und **schnappen** (Maul auf, Zähne, „SCHNAPP!“). Wer in diesem Moment davor steht, hüpft erschrocken zurück (wie das Zurückschieben bei der Kuh) und verliert Tempo.
- Ab und zu schwimmt ein Krokodil quer durch die Furt (wie die Kois im Garten, nur flach).
- Papageien fliegen auf, wenn ein Auto dicht vorbeifährt (Optik, Kreischen).

Computerautos: Unter dem Laubdach sehen sie natürlich alles. Damit es fair bleibt, fahren sie dort auf leichter Schwierigkeit langsamer. Die Liane nehmen sie, wenn sie gerade passt, sonst die Brücke. Vor der Steinkugel fliehen sie mit Vollgas.

Optik: Riesenfarne, Würgefeigen, Blüten in kräftigen Farben, Affen in den Bäumen (werfen nichts, winken nur), Schmetterlinge, Lichtstrahlen durch das Laub (wie die Sonnenstrahlen im Wald), Nebelschwaden über dem Sumpf, Steinköpfe der Ruine am Kartenrand, Glühwürmchen unter dem Laubdach.

Musik `jungle`: **e-Moll, 126 BPM**, Tribal.
- Bongos und Congas im Wechsel, Shaker auf den Sechzehnteln, Holzblock.
- Holzflöte (Panflöte, mit Luftrauschen) spielt die Melodie, Marimba spielt Arpeggios.
- „Dschungel als Rhythmus“: Froschquaken als Rimshot, Vogelpfiffe als Antwort auf die Flöte, Grillenzirpen im Hintergrund.
- Bass: weiche, runde Sinus-Töne.
- Teil A: Em – C – D – Em | Em – C – D – H7. Teil B: Am – Em – C – D | Am – Em – H7 – Em.
- **In der Tempelruine** wird die Musik gedämpft (Filter zu, mehr Hall), wie in einem Gang aus Stein.
- **Letzte Runde:** tiefe Tempeltrommeln (Taiko) und ein Gong auf jeder Eins.

Neue Töne: Tarzan-Schrei (Liane), Knarren und Rumms (Baum), Klicken und Rollen (Steinkugel), „SCHNAPP“ (Krokodil), Papageien-Kreischen, Blubbern im Sumpf.

Warum schwerer als der Vulkan: Man sieht nicht alles. Es gibt die meisten Entscheidungen im ganzen Spiel (Gabelung, Liane oder Brücke, Strömung), die Strecke füllt sich mit Baumstämmen, und die Steinkugel jagt einen.

Ursprüngliche Vorgabe:
Dschungel mit Tempelruinen, Lianen und Flussüberquerungen. (Vorher "???", Ideen: Dschungel/Tempel.)
Cup: Platin (Cup 4)
Musik: (Vorschlag) Treibende Tribal-Percussion in e-Moll. Bongos, Holzflöte, Marimba, Dschungelgeräusche als Rhythmus.
Streckenereignis: (Vorschlag) Umstürzende Baumstämme und schwingende Lianen; Flussabschnitte mit Krokodilen, die zuschnappen.
Änderung: Mud ist Sumpf, dichtes Laub verdeckt Teile der Strecke.

## 12. Weltall
Status: **Prototyp umgesetzt** auf Branch `map_pack` (Streckenname `WELTALL`, Theme `weltall`, Musik `space`, Streckenereignisse Asteroiden `asteroiden` und Schwarzes Loch `schwarzesloch`; Code in `src/spacemap.js` und `src/space.js`). Im Cup PLATIN eingetragen. Größere Karte (1360×765), eine Runde dauert etwa 25 bis 30 s.

Abweichungen vom Vorschlag (erster Wurf):
- Das **Wurmloch** pendelt nicht auf der Straße, sondern sitzt auf einer kleinen runden Plattform neben ihr (gelb-schwarzer Rand): Man muss bewusst hinfahren, zufällig trifft man es nicht. Es überspringt eine Kehre im Asteroidengürtel, um einen großen Asteroiden herum; der türkise Ausgang liegt kurz vor dem Mond.
- An den **engen Kehren** stehen Kraftfeld-Banden (leuchtende Linie zwischen kleinen Pfosten), die wie die Bande der Bobbahn abfedern. Die weiten Kurven (Satellit, Planet) sind offen.
- Nach der Glasröhre eine **schmale Gitterbrücke** (gelb-schwarzer Rand), danach eine Senke der Straße unter einem großen **Satelliten** hindurch.
- **Ring des Planeten:** Zwei breite Abzweige (gelb-schwarzer Rand) führen auf den Ring und zurück. Wer den Ring sauber fährt, bekommt am Ende den Swing-by-Schub. Die Anziehung ist auf dem Ring am stärksten; auf dem Ring braucht man etwa Höchsttempo, sonst zieht der Planet einen nach innen.
- **Boost-Felder** liegen in der Glasröhre und vor dem Mond (nicht direkt vor dem Planeten, dort hätte niemand die Abzweigung geschafft).
- Der **Mond** hat einen Weg mit Fahrspuren über den Rand eines großen Kraters; Mondstaub liegt in den Kratern und neben den Asteroiden auf den Plattformen. Lämpchen am Wegrand, eine karierte Rennflagge und eine Landefähre. Der Mondboden neben dem Weg bremst wie Gras.
- Die **Luftschleuse** ist ein Tor über der Straße am Übergang vom Mond in die Station; Düsen im Boden blasen den Staub ab (weißer Nebel, Zischen).
- Die **Asteroiden** fliegen nur über die offenen Plattformen und den Mond, nicht in die Glasröhre oder die Station. Mittlere zerbrechen bei einem Treffer in zwei kleine.
- Ab dem **schwarzen Loch** wird die Musik einen Ganzton tiefer (mit einem Absturz-Effekt beim Öffnen); in der letzten Runde läuft das Arpeggio doppelt so schnell, der Vocoder singt auch im Refrain.
- Noch nicht: Stationsmodule und Staubflecken sind schlicht, das Lied ist noch nicht angehört. Das alte Regenbogen-Lied (Space-Disco) steckt jetzt allein im Weltall-Lied `space` (`SPACE_DISCO` in `src/music.js`); seit dem Regenbogen-Rework (2026-10-14) hat der Regenbogen sein eigenes neues Lied `rainbow`. ✅ umgesetzt

Idee: Die bisherige Weltall-Optik der Regenbogen-Strecke (Sterne, Asteroidengürtel, `decor: 'space'`) zieht hierher, und das bisherige Lied `rainbow` (Space-Disco) wird zum Lied dieser Strecke. Die Strecke ist eine Bahn aus Metallplattformen und Röhren zwischen Raumstation, Mond und einem Ringplaneten. Es geht um **Schwung**: Im All hat man wenig Grip, aber die Schwerkraft eines Planeten kann einen schleudern.

Rundenverlauf (Uhrzeigersinn, Start links, es geht zuerst nach oben):
- 0–12 %: Start links in der **Raumstation**: ein Hangar mit Startrampe, Lichter an den Wänden, Roboterarm. Hier ist künstliche Schwerkraft, das Auto fährt normal.
- 12–25 %: oben eine **Glasröhre** (man sieht durch das Glas auf die Sterne), dann hinaus auf freie Plattformen. Ab hier ist **Schwerelosigkeit**: weniger Grip (etwa wie Glatteis, aber nicht ganz so schlimm), dafür Steuerdüsen: Das Auto lenkt mit kleinen Düsenstößen (Optik), Gas wirkt voll. Hier zählt Beschleunigung mehr als Höchsttempo.
- 25–45 %: oben rechts der **Ringplanet**: Die Strecke führt in einem großen Bogen um den Planeten herum. Seine **Schwerkraft** zieht alle Autos zur Mitte (Schubzone zum Planeten hin). Innen auf der Ringbahn (dem Planetenring, glitzernd) ist der Weg kurz, aber man wird stark angezogen und muss gegenlenken. **Swing-by:** Wer die Kurve auf der inneren Linie sauber durchfährt, bekommt am Ende einen Schub (wie ein Boost-Pad, Text „SWING-BY!“).
- 45–55 %: rechts ein **Wurmloch**: zwei wirbelnde Portale (lila und türkis). Wer in das erste fährt, kommt mit gleichem Tempo und gleicher Richtung aus dem zweiten heraus, ein gutes Stück weiter unten (Abkürzung um den Asteroidengürtel). Das Portal ist schmal, wer es verfehlt, nimmt den langen Weg.
- 55–75 %: unten der **Asteroidengürtel**: Die Strecke schlängelt sich zwischen großen Asteroiden durch (fest). Hier liegt Mondstaub.
- 75–90 %: links unten über den **Mond**: eine graue Kraterlandschaft, die Strecke führt über den Rand eines Kraters. Mondstaub neben der Strecke.
- 90–100 %: zurück in den Hangar durch die **Luftschleuse** (Waschen) und ins Ziel.

Oberflächen:
- **Metallplattform** (Strecke): dunkelblau-grau mit Leuchtstreifen am Rand und Nieten. Reifenspuren leuchten kurz nach (Cyan) und verblassen.
- **Mondstaub** statt Matsch: hellgrauer, feiner Staub, bremst wie Matsch und macht das Auto **silbergrau**. Hüpft in kleinen Wölkchen hoch und fällt langsam (geringe Schwerkraft).
- **Weltall** neben den Plattformen (neben der Strecke ist nichts): Wer von der Plattform fährt, treibt langsam ins All und dreht sich. Ein **Traktorstrahl** der Station (blauer Lichtkegel) holt ihn nach 1,2 s zurück auf die letzte sichere Stelle (Mechanik vom Wasser im Garten, nur andere Optik und ohne Waschen).
- **Boost-Pads** von der alten Regenbogen-Strecke bleiben hier als gelbe Beschleunigungsstreifen auf den Plattformen.
- **Luftschleuse**: Vor der Ziellinie fährt man durch eine Schleuse, Düsen blasen den Staub ab (weißer Nebel, Zischen). Das Auto ist danach sauber.

Streckenereignis **Asteroiden** (`asteroiden`):
- Zeitgesteuert ziehen kleine und mittlere Asteroiden quer über die Karte, auch über die Strecke. Vorher zeigt ein **Radar** am Rand des Bildes einen roten Pfeil (wo kommt er her), und auf der Strecke erscheint eine gestrichelte Linie (wo fliegt er lang).
- Wer getroffen wird, schleudert wie bei der Kuh. Mittlere Asteroiden zerbrechen dabei in zwei kleine, die weiterfliegen.
- Ab Runde 2 kommen sie öfter und bilden Schwärme von drei.

Streckenereignis **Schwarzes Loch** (`schwarzesloch`):
- Sobald du in Runde 2 gehst, öffnet sich in der Mitte der Karte (im Infield) ein **schwarzes Loch**: ein dunkler Wirbel mit leuchtendem Rand, Sterne in der Nähe werden zu Streifen verzogen.
- Es zieht alle Autos auf der ganzen Karte leicht zu sich (Schubzone mit Kraft zur Mitte, je näher, desto stärker). Auf den Plattformen nah am Infield muss man deutlich gegenlenken.
- Es schluckt Asteroiden, die ihm zu nah kommen (schöner Effekt) und lenkt deren Bahnen leicht ab.
- **Letzte Runde:** Das Loch wächst etwas, und die Plattformen am Innenrand flackern rot (Warnung). Ein Auto, das in den Wirbel gerät, wird wie beim Weltall zurückgeholt, aber mit Spiralflug in den Traktorstrahl.
- Die Computerautos lenken gegen die Kräfte (Planet, Loch) und nehmen das Wurmloch, wenn sie es gut treffen (auf leichter Schwierigkeit seltener).

Optik: Sterne in drei Ebenen (Parallaxe), Nebel in Lila und Blau, die Raumstation mit drehendem Ring, Satelliten, ein Astronaut, der winkend vorbeischwebt, Sternschnuppen, die Erde am Kartenrand, Ufo, das ab und zu kurz über die Karte huscht (nur Optik).

Musik `space`: das bisherige Lied `rainbow` (Space-Disco, 150 BPM, Four-on-the-floor, Oktavbass, glitzernde Arpeggios) zieht hierher um und wird erweitert:
- Dazu ein **Vocoder**-Motiv (ein Sägezahn mit Formantfilter, singt „Space Race“ als Silben) und Sci-Fi-Blips als Fills.
- Ein Sidechain-Effekt auf den Flächen (sie pumpen mit der Kick).
- **Ab dem schwarzen Loch (Runde 2):** Die Musik wird tiefer gestimmt (ein Ganzton), ein Pitch-Bend zieht alles kurz nach unten, als ob es in den Wirbel gesogen wird. Die Flächen werden dunkler.
- **Letzte Runde:** Doppeltes Arpeggio-Tempo, Vocoder im Refrain.

Neue Töne: Düsenstöße, Traktorstrahl (aufsteigendes Summen), Wurmloch (Wusch mit Hall), „SWING-BY!“, Asteroiden-Warnung (Radar-Piepen), Brummen des schwarzen Lochs, Luftschleuse (Zischen).

Warum schwerer als der Dschungel: Wenig Grip auf der ganzen Strecke und gleichzeitig Kräfte, die einen ziehen (Planet, schwarzes Loch), dazu fliegen die Hindernisse aus allen Richtungen. Wer die Kräfte nutzt (Swing-by, Wurmloch), ist aber sehr schnell. Das ist die Schlussprüfung des Platin-Cups.

Ursprüngliche Vorgabe:
Komplett neue Strecke: Rennen im echten Weltall zwischen Planeten, Asteroiden und Raumstationen. (Die bisherige Weltall-Optik der Regenbogen-Strecke wandert hierher, der Regenbogen bekommt einen Rework, siehe 15.)
Cup: Platin (Cup 4)
Musik: (Vorschlag) Schwebender Synthwave in e-Moll. Pad-Flächen, Sidechain-Bass, Sci-Fi-Blips, Arpeggios, Vocoder. **Angepasst:** Statt eines neuen Liedes zieht das vorhandene `rainbow` hierher und bekommt Vocoder, Blips und Sidechain dazu.
Streckenereignis: (Vorschlag) Schwerkraftwechsel/Asteroiden, die über die Strecke ziehen.
Änderung: (Vorschlag) Kein Mud, stattdessen Schwerelosigkeits-Zonen mit reduzierter Lenkung. Sterne, Planeten und Raumstationen als Kulisse. **Angepasst:** Mondstaub als Matsch, damit das Waschen auch hier Sinn ergibt (Mudracer bleibt Mudracer).

# Cup 5
Stand 2026-10-14, Branch `map_pack`. Die drei Strecken unten waren **ausgearbeitete Vorschläge**; alle drei gibt es jetzt als Prototyp (Süßigkeitenland 13, Spielzimmer 14, Regenbogen-Rework 15).

**Steigerung im Cup:** Cup 5 (Fantasy) ist erst nach dem Supercup freigeschaltet, wer hier fährt, kennt also alle Mechaniken. Die Fantasy-Strecken **verdrehen bekannte Regeln** auf lustige Art (Matsch, der klebt, Möbel als Berge, ein Regenbogen, der erst im Gewitter entsteht) und sind dabei die buntesten und verrücktesten Strecken im Spiel. Sie sollen sich wie eine Belohnung anfühlen, nicht wie eine Strafe. Schwer sind sie durch die Menge: Auf jeder passiert viel gleichzeitig.

| Nr | Strecke | Thema der Schwierigkeit | Gut für | Neue Mechaniken (klein) | Dreck-Farbe | Waschen |
| --- | --- | --- | --- | --- | --- | --- |
| 13 | Süßigkeitenland | **Kleben**: Karamell hält fest, Schokolade flutet ab Runde 2 die Strecke | Matsch-Autos (Traktor, Monster) | Karamell (klebt, Fäden), Gummibärchen-Trampolin, Brause-Boost, Zuckerwatte (weiche Bande, Sicht), Kaugummiblasen, Schokofluss | braun (Schoko), goldgelb (Karamell) | Limonaden-Brunnen |
| 14 | Spielzimmer | **Höhe**: hinauf aufs Bett und den Schreibtisch, runterfallen kostet viel, ab Runde 2 fährt der Saugroboter | wendige Autos (Quad, Krankenwagen, Polizei) | Rampen auf Möbel (Ebenen), Murmelbahn-Spirale, Spielzeugeisenbahn, Dominosteine, Saugroboter mit Sog, Licht aus | bunt (Knete) | Spielzeug-Waschstraße |
| 15 | Regenbogen | **Alles zusammen**: das große Finale mit Farbbahnen, dem größten Sprung im Spiel und einem Gewitter, aus dem der Regenbogen erst entsteht | schnelle Autos (Flitzer, Batmobil) | Farbbahnen mit eigener Wirkung, Regenbogen-Bogen (größter Sprung), Wolkenlöcher, Einhörner mit Boost-Spur, Blitze, doppelter Regenbogen in der letzten Runde | grau (Gewitter) | Regenschauer |

**Gemeinsame Bausteine:** Die Fantasy-Strecken verwenden fast nur vorhandene Mechaniken, neu gemischt: Kleben ist Matsch mit Nachwirkung, das Trampolin ist ein Sprung, die Zuckerwatte ist die federnde Bande aus der Bobbahn, der Saugroboter ist der Treibsand-Sog auf Rädern, Licht aus ist der Wald. Der **Regenbogen** baut auf allem auf und sollte darum als Letztes umgesetzt werden. Neue Schalter in `PREFS.events`: `schoko`, `zuckerwatte`, `saugroboter`, `spielzeug`, `einhorn`, `gewitter`.

Reihenfolge in Einzelstrecke und Zeitfahren: … Weltall, **Süßigkeitenland, Spielzimmer, Regenbogen**. Cup 5 (`FANTASY` in `src/cups.js`): geplant `['SUESS', 'SPIELZIMMER', 'REGENBOGEN']`, ✅ umgesetzt, heute `['SUESS', 'SPIELZIMMER', 'REGENBOGEN']` (alle drei als Prototyp; damit ist Cup 5 spielbar und das Batmobil erreichbar). In Einzelstrecke und Zeitfahren stehen Süßigkeitenland und Spielzimmer ✅ zwischen Weltall und Regenbogen. Der Regenbogen ist damit auch das letzte Rennen des Superdupercups. Im Code hat Cup 5 noch keine Freischaltbedingung (geplant: 1. Sieg im Supercup).

## 13. Süßigkeitenland
Status: **Prototyp** (Streckenname `SUESS`, Theme `suess`, Musik `candy`, Streckenereignisse Schokolade `schoko` und Zuckerwatte `zuckerwatte`; Code in `src/suessmap.js`, `src/suess.js`, `src/suessmusic.js`)

**Umgesetzt (Prototyp, 2026-10-14):** Karte 1200×675 (größer als Standard), Runde ca. 21 s, Rennen ca. 60 s. Verlauf im Uhrzeigersinn: Start links am Lebkuchenhaus (Zuckergussdach, Gumdrops, Schokotür), oben der Lollipop-Wald mit zwei Gummibärchen-Trampolinen, hinter jedem fließt ein Karamellbach über die Straße (springen oder durch), Zuckerstangen als feste Begrenzung. Oben rechts das Karamellmoor mit einem Keksweg (Kekse statt Lakritze, Karamell läuft an den Rändern drüber, eine geschwungene Spur bleibt frei; das Moor drumherum ist Karamell mit Nusskrokant-Inseln). Rechts eine S-Kurve durch Zuckerwatte (weiche Bande wie die Bobbahn, ein Wattefetzen bleibt kurz am Auto). Unten rechts ein U über die **Waffelbrücke** (Geländer aus Waffelröllchen) über den Schokofluss; geradeaus als Abkürzung ein schmaler Lakritzweg über drei Marshmallow-Trittsteine (wer danebenfährt, plumpst in die Schokolade). Unten das Brausefeld (zwei Brause-Pads, zwei Kaugummiflecken mit Blasen, Brausepulver neben der Straße) und der Limonaden-Brunnen, dessen Becken in die Straße reicht (wäscht, danach glitzert das Auto). Im Infield der Schokoladensee mit dreistufigem Schokobrunnen; sein Fluss läuft am unteren Kartenrand hinaus. Dazu Bonbon-Regenbogen im Infield, Lollis überall, Donut-Stapel an den Außenecken, Eistüten-Laternen, hüpfende Gummibärchen, winkende Lebkuchenmänner, Zuckerwattemaschine am rechten Rand.
- Oberflächen: Lakritze (Straße) ✅, Karamell mit Nachkleben (1 s / `mud`, goldene Fäden, die sich dehnen und reißen, Auto wird goldgelb) ✅, tiefe Schokolade (Auto taucht ein, kommt schokobraun mit Sahne und Kirsche wieder raus) ✅, flache Schokolade (Pfützen am Ufer bei den Trittsteinen, Ströme ab Runde 2) ✅, Streusel auf Zuckerguss neben der Strecke ✅, Limonaden-Brunnen ✅.
- Mechaniken: Gummibärchen-Trampolin (Höhe unabhängig vom Tempo, Weite abhängig; das Bärchen wabbelt, eigenes Quietschen) ✅, Kaugummiblasen (wachsen 3 s, fest, weicher Abprall, PLOPP, daneben 0,5 s kleben) ✅, Brause-Pads ✅, Zuckerwatte-Bande ✅.
- Ereignis `schoko` ✅: ab Runde 2 laufen nacheinander drei Schokoladenströme aus dem See über die Strecke (unten, oben im Moor, rechts in der S-Kurve) und bleiben liegen; Text „SCHOKOLADE!“. Letzte Runde: Streuselregen, die Streusel bleiben auf der Schokolade liegen.
- Ereignis `zuckerwatte` ✅: rosa Wolken treiben über die Karte und verdecken alles darunter (rosa Schleier, wenn man selbst drunter ist); ab Runde 2 pustet die Maschine neue (bis 8). Computerautos sehen durch, auf LEICHT fahren sie darunter langsamer.
- Musik `candy` ✅ wie unten beschrieben (Kazoo, Celesta, Pizzicato, Sprudel-Percussion, hüpfender Bass, ab Runde 2 schmelzender Bass, letzte Runde G-Dur und Chor). Neue Töne: Trampolin, Karamellfäden, Brause, Platschen in Schokolade, Schokoüberlauf, Watte-Puff, Streuselregen ✅.

**Fehlt noch:** Lebkuchenmänner winken nur (keine eigene Animation am Streckenrand entlang); Marshmallows federn nicht; Wattefetzen fliegen nicht weg; Schokoladenströme haben keine sichtbare Front (sie wachsen nur); die KI nimmt die Trittstein-Abkürzung nie und kennt die Trampoline nicht gezielt; keine Ankündigung der Ströme vor dem Überlaufen außer dem Text; das Brausefeld-Pulver und die Minz-Flecken sind noch grob; Feinschliff an Längen und Schwierigkeit nach dem Spielen.

Idee: Eine Welt aus Süßigkeiten. Hier ist der Matsch endlich **lecker**, aber er **klebt**. Die Strecke ist die fröhlichste im Spiel, mit Trampolinen aus Gummibärchen und Brause, die einen anschiebt. Ab Runde 2 läuft der Schokobrunnen über.

Rundenverlauf (Uhrzeigersinn, Start links, es geht zuerst nach oben):
- 0–12 %: Start links vor dem **Lebkuchenhaus** (Zuckerguss-Dach, Fenster aus Gummidrops, Zuckerstangen am Zaun). Die Strecke ist eine **Lakritzstraße** (schwarz glänzend) mit weißen Mittelstreifen aus Zuckerguss.
- 12–25 %: oben durch den **Lollipop-Wald**: Lollis als Bäume, dazwischen Zuckerstangen als Begrenzung. Zwei **Gummibärchen-Trampoline** liegen auf der Strecke: Wer darüberfährt, hüpft (großer, weicher Sprung, das Trampolin wabbelt und quietscht). Man kann damit über ein Karamellfeld springen.
- 25–40 %: oben rechts das **Karamellmoor**: viele Karamellflecken, dazwischen ein Weg aus Keksen.
- 40–55 %: rechts hinunter durch die **Zuckerwatte-Wolken**: rosa und hellblaue Watte begrenzt die Strecke. Sie ist eine **weiche Bande** wie in der Bobbahn: Man prallt sanft ab, ohne Tempo zu verlieren (Plopp-Geräusch, ein Fetzen Watte bleibt kurz am Auto).
- 55–70 %: unten rechts über die **Schokobrücke**: eine Brücke aus Waffeln über den Schokofluss. Daneben eine Abkürzung über Marshmallow-Trittsteine (wie die Steine im Garten, sie federn leicht, wer abrutscht, plumpst in den Schokofluss).
- 70–88 %: unten das **Brausefeld**: Brause-Pads (wie Boost-Pads, sprudelnd, in Pastellfarben). Dazwischen platzen **Kaugummiblasen** (siehe unten).
- 88–100 %: zurück nach links, durch den **Limonaden-Brunnen** und ins Ziel.

Oberflächen:
- **Lakritze** (Strecke): schwarz glänzend, normale Haftung.
- **Karamell** statt Matsch (neues Verhalten): goldgelbe, glänzende Flecken. Bremst wie Matsch und macht das Auto **goldgelb**. Neu: Karamell **klebt nach**: Nach dem Herausfahren bleibt das Auto noch 1 s langsamer und zieht goldene Fäden hinter sich her, die sich dehnen und reißen (Optik). Matsch-Autos (Traktor, Monster) reißen sich schneller los (Dauer durch `mud` geteilt).
- **Schokolade**: Der Schokofluss ist tief (Absturz wie im Garten: das Auto taucht ein und kommt **schokobraun** wieder heraus, mit einem Klecks Sahne obendrauf). Flache Schokolade (ab Runde 2, siehe Ereignis) bremst wie Matsch und macht braun.
- **Streusel** neben der Strecke: bunte Zuckerstreusel auf rosa Zuckerguss, bremsen wie Gras.
- **Limonaden-Brunnen**: ein großer Sprudelbrunnen am Rand der Zielgeraden, das Becken reicht in die Strecke. Wäscht alles ab, das Auto glitzert danach kurz (Zuckerkristalle).

Neue kleine Mechaniken:
- **Gummibärchen-Trampolin:** ein Sprung (Matschfahrt), aber weich: Die Höhe hängt nicht vom Tempo ab, auch langsame Autos fliegen gleich hoch. Die Weite hängt vom Tempo ab.
- **Kaugummiblasen:** Aus Kaugummiflecken wachsen langsam Blasen (rosa, glänzend). Sie sind fest und wachsen 3 s lang, dann platzen sie mit „PLOPP“. Wer in eine wachsende Blase fährt, prallt weich ab. Wer im Moment des Platzens danebensteht, bekommt rosa Kaugummifetzen ab und klebt 0,5 s fest.

Streckenereignis **Schokolade** (`schoko`):
- Am Schokobrunnen (ein großer Schokoladenspringbrunnen im Infield) läuft Schokolade, das ist schon in Runde 1 zu sehen.
- Sobald du in Runde 2 gehst, läuft er über: Drei Schokoladenströme fließen nacheinander aus dem Infield über die Strecke (wie die Flut am Strand, nur als Bahnen). Sie bleiben bis zum Ende als flache Schokolade liegen (bremst, macht braun).
- **Letzte Runde:** Es regnet bunte Streusel über die ganze Karte, und auf die Schokolade fallen sie und bleiben dort liegen (Optik).

Streckenereignis **Zuckerwatte** (`zuckerwatte`):
- Rosa Zuckerwatte-Wolken treiben langsam über die Karte. Fährt man darunter, sieht man durch die Wolke nichts (nur rosa), sie ist aber durchfahrbar. Die anderen Autos und die Hindernisse darunter sind verdeckt.
- Ab Runde 2 sind es mehr Wolken, und eine Zuckerwattemaschine am Rand pustet neue.
- Die Computerautos sehen durch die Wolken (auf leichter Schwierigkeit fahren sie darunter langsamer).

Optik: Lollibäume, Zuckerstangen, Lebkuchenmänner, die am Rand winken, ein Schokoladenspringbrunnen, Gummibärchen in allen Farben (manche hüpfen auf der Stelle), Eistüten als Laternen, Donut-Reifenstapel, ein Bonbon-Regenbogen am Himmel (Andeutung auf Strecke 15).

Musik `candy`: **F-Dur, 128 BPM**, Bubblegum-Pop.
- Lead: **Kazoo** (Sägezahn mit Formantfilter und leichtem Summen), spielt eine hüpfende Melodie.
- Spieluhr-Celesta als Gegenmelodie, Pizzicato-Streicher auf den Achteln.
- Drums: weicher Four-on-the-floor, Handclaps auf 2 und 4, „Sprudel“-Percussion (schnelle, hohe Blubber-Töne, zufällig) statt Hi-Hats.
- Bass: hüpfender Synth-Bass (Grundton, Oktave, Quinte).
- Teil A: F – Dm – B – C | F – Dm – Gm – C. Teil B: B – C – Am – Dm | Gm – C – F – F.
- **Ab Runde 2 (Schokolade):** Ein tiefer, „schmelzender“ Bass (Glissando abwärts am Ende jedes Taktes) kommt dazu.
- **Letzte Runde:** Rückung nach G-Dur und ein Chor (hohe „Ooh“-Stimmen).

Neue Töne: Trampolin-Quietschen und Wabbeln, Karamell-Fäden (gedehntes Knarzen), Plopp (Kaugummiblase, Zuckerwatte), Sprudeln (Brause, Limonade), Platschen in Schokolade.

Warum schwerer als das Weltall: Es sieht harmlos aus, aber das Kleben bestraft jeden Fehler länger als Matsch, die Schokolade bedeckt ab Runde 2 große Teile der Ideallinie, und die Wolken verdecken, was kommt. Gleichzeitig kann man mit Trampolinen und Brause viel herausholen.

Ursprüngliche Vorgabe:
Zuckerwelt mit Lakritzstraßen, Gummibärchen-Wäldern und Lollipop-Bäumen.
Cup: Fantasy (Cup 5)
Musik: (Vorschlag) Verspielter Bubblegum-Pop in F-Dur. Spieluhr-Celesta, Pizzicato, Kazoo-Lead, Sprudel-Percussion.
Streckenereignis: (Vorschlag) Schokoladenfluss ergießt sich ab Runde 2 über Teile der Strecke; Zuckerwatte-Wolken verdecken die Sicht.
Änderung: Mud ist Schokolade oder Karamell (klebrig, bremst stark), Waschanlage als Zuckerwasser-Dusche.

## 14. Spielzimmer
Status: **Prototyp umgesetzt** auf Branch `map_pack` (Streckenname `SPIELZIMMER`, Theme `spielzimmer`, Musik `toys`, Streckenereignisse Spielzeug `spielzeug` und Saugroboter `saugroboter`; Code in `src/toymap.js` und `src/toys.js`). Im Cup FANTASY eingetragen. Größere Karte (1280×720), eine Runde dauert etwa 26 bis 28 s, ein Rennen etwa 85 s.

Umgesetzt im Prototyp (erster Wurf):
- **Ebenen** ✅ umgesetzt: Boden, Bett, Schreibtisch; die Ebene folgt `c.idx` (Höhe je Streckenpunkt). Oben werden die Autos größer gezeichnet, der Schatten liegt weiter weg. Zusammenstöße nur auf derselben Ebene (`c.lvl`: 2 Boden, 1 Bett, 3 Schreibtisch, 4 in der Murmelbahn); die Möbelkanten sind nur für Autos auf dem Boden fest. Wer oben die Fläche verlässt, fällt mit Pfeifen auf den Boden und wird wieder auf die Straße gesetzt.
- **Spielteppich** ✅ umgesetzt: grüner Filz mit aufgedruckter Straße (grau, weiße Ränder, gestrichelte Mitte, Zebrastreifen) und blassen aufgedruckten Nebenstraßen, Häusern, Bäumen und Teich; daneben bremst der Flor wie Gras. Fransen an den Enden.
- **Parkett** ✅ umgesetzt (neues Terrain 30): halb so glatt wie Glatteis. Die Straße darauf ist mit Malerkrepp markiert. Die Ecke oben links und die Gerade mit der Eisenbahn liegen auf Parkett.
- **Spielzeugeisenbahn** ✅ umgesetzt: Holzschiene als Oval, die Straße kreuzt sie zweimal; rot-weiße Holzschranken schließen, wenn der Zug kommt, und klappen weg, wenn man durchfährt; der Zug (Lok und zwei Wagen) wirft Autos herum; einmal pro Runde hält er an seinem Bahnhof oben. Ohne Ereignis steht der Zug am Bahnhof.
- **Bücherrampe aufs Bett** ✅ umgesetzt (gestapelte Bücher, an jeder Stufe die Seiten), **Bettdecke** ✅ (Patchwork mit Falten; der Weg darüber ist ein weiches Band, Terrain 31, etwas langsamer und holprig), **Kuscheltier** ✅ (Teddy mit Fliege, fest).
- **Sprung vom Kissen** ✅ umgesetzt: Ab etwa 60 % des Tempos landet man auf dem Schreibtisch, darunter fällt man in die Lücke und beginnt wieder am Anfang der Kissen-Geraden (etwa 2 s Verlust). Die Computerautos geben dort immer Vollgas (sie kennen das Kissen).
- **Schreibtisch** ✅ umgesetzt: Die Straße ist ein Streifen liniertes Papier mit Bleistiftrand auf Ahornholz; Buntstifte begrenzen die Straße, ein Radiergummi liegt am Rand auf der Straße, Hefte, Klebezettel, Stiftebecher und Schreibtischlampe. **Lineal** als schmale Brücke ✅, angepasst: über die Lücke zwischen zwei Tischen statt zwischen zwei Heften.
- **Malkasten** ✅ umgesetzt: offen zwischen der Straße und einem zweiten, sauberen Weg (eine Ausbuchtung zur Wahl); davor Wasserfarbe auf der Straße (Terrain 32, bremst nicht, färbt).
- **Murmelbahn** ✅ umgesetzt: ein Holzturm mit bunter Spirale; das Auto fährt oben am Schreibtisch hinein, dreht sich zweimal im Kreis, wird dabei kleiner und kommt unten auf dem Boden mit Schub heraus.
- **Bauklotz-Viertel** ✅ umgesetzt: eine Schikane um eine Burg aus Bauklötzen und Klemmbausteinen; eine Mauer aus Bauklötzen quer durchs Zimmer verhindert die Abkürzung durch die Mitte. Puppenhaus und Spielzeugkiste stehen im Innenfeld.
- **Knete** ✅ umgesetzt: vier Fladen (rot, blau, gelb, grün), jeweils neben einer offenen Knetedose. Angepasst: das Auto wird bunt gesprenkelt (ein Sprite-Satz in den vier Farben), nicht in der Farbe der zuletzt befahrenen Knete.
- **Spielzeug-Waschstraße** ✅ umgesetzt: Plastikboden, gelbe Pfosten, roter Balken, drehende Bürsten, Rubbel-Geräusch.
- **Ereignis Spielzeug** ✅ umgesetzt: Holzeisenbahn, **Aufziehauto** (fährt geradeaus über den Teppich, prallt ab, wird mit Ratschen wieder aufgezogen), **Murmeln** (rollen nach einem Klackern in der Murmelbahn quer über die Straße unten, man dreht sich kurz), **Dominoturm** (fällt bei Berührung als Kette quer über die Straße, man holpert darüber, nach 20 s steht er wieder).
- **Ereignis Saugroboter** ✅ umgesetzt: ab Runde 2 Piepen und „SAUGROBOTER!“, er fährt in geraden Bahnen über den Boden der unteren Zimmerhälfte, zieht Autos an und saugt sie bei Berührung ein („SCHLUERF!“), spuckt sie hinter sich staubgrau wieder aus (1,2 s); er frisst Murmeln und liegende Dominosteine. Nicht auf Bett und Schreibtisch. Die Computerautos weichen aus. **Letzte Runde Licht aus** ✅: „SCHLAFENSZEIT!“, Lichtschalter-Klick, dunkel mit Scheinwerfern, der Sternenprojektor auf dem Nachttisch wirft drehende Sterne und einen Mond, das Nachtlicht leuchtet, der Roboter hat blaue Lichter.
- **Musik `toys`** ✅ umgesetzt: G-Dur, 112 BPM, Toy-Piano, Xylophon, Glockenspiel und Spieluhr, Holzklötze, Klicks, Quietscheente, Ratsche, Tuba-Bass; mit dem Saugroboter 124 BPM und Drone, in der letzten Runde Spieluhr-Schlaflied mit leisen Holzklicks. Noch nicht angehört.
- **Neue Töne** ✅ umgesetzt: Holzpfeife des Zuges, Schranke und Dominosteine (Klack), Ratschen, Murmeln, Saugroboter (Piepen, Summen, Schlürfen, Rattern, Ausspucken), Bürsten, Lichtschalter, Kissen-Boing, Murmelbahn.
- **Optik** ✅ teilweise: Bett, Schreibtisch, Bücherregal, Fenster mit Gardinen und Lichtstrahlen mit Staub, Nachttisch, Puppenhaus, Bauklötze, Puzzleteile, Socken, Quietscheente, Ball, Kinderzeichnung. Beim Countdown haben alle Autos einen Aufziehschlüssel.

Fehlt noch (für später):
- Unter dem Bett (dunkel, Staubflusen, Socken) und die **lange Rampe zurück** nach einem Sturz vom Kissen; heute wird man an den Anfang der Kissen-Geraden zurückgesetzt.
- Der Saugroboter saugt die **Knete** nicht weg; die Strecke wird dadurch nicht sauberer.
- Knete mit der Farbe des zuletzt befahrenen Fladens (bräuchte vier Sprite-Sätze je Auto).
- Bettfalten als echte kleine Hügel (heute nur holprig), Staubkörner nur im Licht des Fensters, Kreidezeichnungen, Gardine am Fenster bewegt sich nicht.
- Feinschliff: Abstimmung des Sprungs und der Kanten, Klang des Liedes.

Idee: Die Autos sind **Spielzeugautos** im Kinderzimmer. Die Strecke beginnt auf dem **Straßen-Spielteppich** (den kennt jedes Kind) und klettert über Rampen aus Büchern und Bauklötzen aufs Bett und auf den Schreibtisch. Zum ersten Mal gibt es **Ebenen**: Wer oben von der Kante fällt, landet unten und hat einen Umweg. Ab Runde 2 fährt der Saugroboter los, und in der letzten Runde geht das Licht aus.

Rundenverlauf (Uhrzeigersinn, Start links, es geht zuerst nach oben):
- 0–15 %: Start links auf dem **Spielteppich**: Die Strecke ist die aufgedruckte Straße des Teppichs (grau mit gestrichelter Mittellinie, gedruckte Häuser, Bäume und Zebrastreifen daneben). Daneben ist der Teppichflor (bremst wie Gras).
- 15–30 %: oben über die **Spielzeugeisenbahn**: Eine Holzeisenbahn fährt im Kreis, die Strecke kreuzt die Schienen an zwei Stellen (kleine Holzschranken, die zugehen). Das ist eine Erinnerung an die Zug-Strecke, nur kleiner und netter.
- 30–45 %: oben rechts die **Rampe aufs Bett**: ein Bücherstapel als Rampe, oben fährt man über die Bettdecke (weich, wellig, bremst etwas, hat Falten, die wie kleine Hügel wirken) und um ein riesiges Kuscheltier herum. Am Ende des Betts: **Sprung vom Kissen** auf den Schreibtisch (Sprung über die Lücke). Wer zu langsam ist, fällt auf den Boden und landet im Teppichflor unter dem Bett (dunkel, Staubflusen, Socken), muss eine lange Rampe zurück (etwa 2 s Verlust).
- 45–60 %: rechts der **Schreibtisch**: Man fährt zwischen Buntstiften (Begrenzung), Radiergummi (feste Hindernisse), einem offenen Malkasten (Knete und Farbe, siehe unten) und einem Lineal als schmaler Brücke über eine Lücke zwischen zwei Heften. Am Rand die Tischkante: Wer runterfährt, fällt (wie die Schlucht, Absturz: Das Auto fällt mit Pfeifen auf den Boden und wird an der letzten sicheren Stelle abgesetzt).
- 60–75 %: unten rechts die **Murmelbahn**: Man fährt in die Murmelbahn ein und in einer **Spirale** nach unten (das Auto wird in der Spirale kleiner, es dreht sich zweimal im Kreis, schnell). Unten kommt man auf dem Boden wieder heraus.
- 75–90 %: unten das **Bauklotz-Viertel**: Bauklötze und Klemmbausteine bilden Wände und Häuser, die Strecke ist eng und kurvig. Ein **Dominostein-Turm** steht am Rand (siehe Ereignis).
- 90–100 %: durch die **Spielzeug-Waschstraße** (aus Plastik, mit drehenden Bürsten, die echt funktionieren) und ins Ziel.

Oberflächen:
- **Teppichstraße** (Strecke): bedruckter Teppich, normale Haftung.
- **Teppichflor** neben der Straße: bremst wie Gras.
- **Parkett** am Rand des Zimmers: glatt (wie Glatteis, aber nur halb so schlimm, „wie mit Socken“).
- **Knete** statt Matsch: bunte Knetefladen (rot, blau, gelb, grün). Bremst wie Matsch, und das Auto bekommt die **Farbe der Knete**, durch die es zuletzt gefahren ist (wie der Zement auf der Baustelle). Mehrere Farben nacheinander machen das Auto bunt gesprenkelt.
- **Wasserfarbe** aus dem Malkasten auf dem Schreibtisch: kleine Farbpfützen, bremsen nicht, färben aber auch.
- **Spielzeug-Waschstraße**: wäscht wie die Waschanlage, die Bürsten drehen sich (Rubbel-Geräusch).

Neue kleine Mechanik **Ebenen**: Boden, Bett und Schreibtisch sind drei Höhen. Das Auto wird oben etwas größer gezeichnet und wirft einen weiten Schatten. Kollisionen gibt es nur zwischen Autos auf derselben Ebene (die Brücke an der Rennstrecke macht das schon so, hier wird es auf drei Ebenen erweitert). Die Ebene ergibt sich aus der Position auf der Runde (`c.idx`), ein Auto, das abstürzt, ist auf dem Boden.

Streckenereignis **Spielzeug** (`spielzeug`):
- Die **Holzeisenbahn** fährt im Kreis, die Schranken gehen zu (wie beim Zug, aber man kann sie mit Schwung umfahren, weil die Schranken nur aus Holz sind und umklappen). Wer vom Zug getroffen wird, schleudert wie beim echten Zug, die Waggons wackeln.
- Ein **Aufziehauto** (mit großem Schlüssel auf dem Dach) fährt auf dem Teppich geradeaus, stößt gegen Hindernisse, dreht und fährt weiter, bis es abgelaufen ist. Dann zieht es eine unsichtbare Hand wieder auf (der Schlüssel dreht sich, Ratschen).
- **Murmeln** rollen zeitgesteuert aus der Murmelbahn und kullern quer über die Strecke unten. Wer getroffen wird, dreht sich kurz.
- **Dominosteine:** Wer in den Dominoturm fährt, stößt ihn um. Die Steine fallen einer nach dem anderen in einer langen Kette quer über die Strecke (Klack-Klack-Klack). Die Kette ist dann eine Reihe flacher Steine, über die man holpern muss (wie die Baumstämme im Dschungel). Nach 20 s stellt der Turm sich von selbst wieder auf (Spielzeugmagie).

Streckenereignis **Saugroboter** (`saugroboter`):
- Sobald du in Runde 2 gehst, piept es, und ein **Saugroboter** fährt aus seiner Ladestation. Er fährt auf dem Boden in geraden Bahnen über die Karte, dreht an Hindernissen und saugt alles an, was nah ist: Autos in seiner Nähe werden zu ihm gezogen (Sog wie beim Treibsand).
- Wer ganz an ihn herankommt, wird **eingesaugt**: Das Auto verschwindet mit einem „SCHLÜRF“, der Roboter rattert kurz, dann spuckt er das Auto hinten wieder aus (staubig grau, 1,2 s Verlust). Knete, Murmeln und liegende Dominosteine saugt er weg (die Strecke wird dadurch auch wieder etwas sauberer).
- Auf Bett und Schreibtisch kommt er nicht hin, dort ist man sicher.
- **Letzte Runde: Licht aus!** Eine Stimme ruft (nur als Text) „SCHLAFENSZEIT!“, das Licht geht aus. Das Zimmer ist dunkel wie der Wald (Scheinwerfer), ein **Sternenprojektor** auf dem Nachttisch wirft drehende Sterne und einen Mond auf Boden und Wände, ein Nachtlicht leuchtet warm. Der Saugroboter fährt im Dunkeln mit seinen kleinen blauen Lichtern weiter.
- Die Computerautos weichen dem Saugroboter aus und klettern lieber aufs Bett.

Optik: Riesige Möbel (Bett, Schreibtisch, Regal mit Büchern am Kartenrand), Kuscheltiere, ein Puppenhaus, Bauklotzturm, Kreidezeichnungen, ein Fenster mit Gardine, durch das Licht fällt, Staubkörner in den Lichtstrahlen, verstreute Puzzleteile, eine Quietscheente. Die Autos haben einen kleinen Aufziehschlüssel nur als Startanimation (beim Countdown drehen sie sich).

Musik `toys`: **G-Dur, 112 BPM**, Spielzeugorchester.
- Lead: **Toy-Piano** (kurzer, leicht verstimmter, glockiger Ton), dazu Xylophon als Antwort.
- Glockenspiel und Spieluhr für die Melodie im Teil B.
- Percussion aus Spielzeuggeräuschen: Holzklötze (Kick), Klicken (Hi-Hat), Quietscheente auf der 4 jedes zweiten Taktes, Ratsche.
- Bass: weiche Tuba-artige Töne (Sinus mit etwas Obertönen).
- Teil A: G – Em – C – D | G – Em – Am – D. Teil B: C – D – H – Em | C – D – G – G.
- **Ab dem Saugroboter (Runde 2):** Ein brummender Bass-Drone liegt darunter, und das Tempo zieht auf 124 BPM an.
- **Letzte Runde (Licht aus):** Die Musik wird zu einem **Spieluhr-Schlaflied** (nur Spieluhr und weiche Flächen, die gleiche Melodie, langsamer gefühlt, aber die Drums bleiben als leise Holzklicks, damit das Rennen weiterläuft).

Neue Töne: Holzschranke, Ratschen des Aufziehautos, Murmeln (Klackern), Dominokette, Saugroboter (Summen, Piepen, „SCHLÜRF“), Bürsten der Waschstraße, Lichtschalter-Klick, Spieluhr.

Warum schwerer als das Süßigkeitenland: Zum ersten Mal kann man richtig tief fallen (Bett und Schreibtisch), der Saugroboter jagt einen auf dem Boden, und in der letzten Runde ist es dunkel. Die Strecke ist eng (Bauklötze) und hat den kniffligsten Sprung von Cup 5 (Kissen).

Ursprüngliche Vorgabe:
Strecke im Kinderzimmer: Teppich, Bauklötze, Spielzeugeisenbahn, Murmelbahn und Bettkante.
Cup: Fantasy (Cup 5)
Musik: (Vorschlag) Klimperndes Toy-Piano und Spieluhr-Motive in G-Dur. Xylophon, Quietschenten, Glockenspiel, Spielzeug-Klicks als Percussion.
Streckenereignis: (Vorschlag) Ein Aufziehauto oder die Spielzeugeisenbahn kreuzt die Strecke; rollende Murmeln als bewegliche Hindernisse.
Änderung: Mud ist Knete oder Farbe. Bauklötze und LEGO-Steine als Streckenbegrenzung. **Angepasst:** „Klemmbausteine“ statt LEGO (keine echte Marke, wie bei der Rally-Lackierung).

## 15. Regenbogen
![[Pasted image 20261006220134.png]]
Status: **Prototyp umgesetzt** (Rework, 2026-10-14, Branch vom `map_pack`): Streckenname `REGENBOGEN` (letzte Strecke in `TRACK_DEFS`), Theme `regenbogen`, Musik `rainbow` (neu, mit `rainbowStorm` und `rainbowFinal`), Streckenereignisse Einhörner `einhorn` und Gewitter `gewitter`; Code in `src/rainbowmap.js` (Karte) und `src/rainbow.js` (Rennen). Im Cup FANTASY eingetragen. Größere Karte (1440×810), eine Runde dauert etwa 26 s. Die alte Strecke (Plattformen im All mit Boost-Pads, siehe Bild) ist weg, ihre Optik (`decor: 'space'`, lila Glibber) ist entfernt, ihr Lied lebt nur noch im Weltall-Lied `space`. Die Zeitfahr-Rekorde starten neu (`rev: 1`) ✅ umgesetzt.

Umgesetzt (Prototyp, Abweichungen vom Vorschlag in Klammern):
- Rundenverlauf wie unten ✅ umgesetzt, nur anders verteilt: Bronze etwa 12–17 %, Bogen 18–29 %, Silber 31–37 %, Gold 41–48 %, Platin 51–56 %, Spirale 58–83 % (eine kleine Rechtskurve, dann die große Linkskurve durch die Mitte und die Rechtskurve hinunter), Regenschauer bei 87 %, dann über die Fantasy-Münze ins Ziel. Startaufstellung komplett auf der Geraden auf der Fantasy-Münze (Grundsatz 5).
- Münzinseln mit Metallrand, Dicke und Schatten auf den Wolken, Cup-Symbol groß als Einlage (Straße, Bonsai, Stern, Blitz, Einhorn) ✅. Der Rand jeder Münze ist fest (Bande), nur die Straße führt darüber.
- Fantasy-Münze: Wolkentor mit Regenbogenbanner und Fähnchen über der Startlinie, Siegerpodest ✅ (Podest dreht sich nicht).
- Bronze: Wiese, Erdweg, braune Matschpfütze (eigener brauner Sprite-Satz, `goo2`), zwei langsamere Kühe auf der Straße (Schalter `kuehe`), drei Tannen, Strandkorb, blasser Deko-Zaun ✅.
- Regenbogen-Bogen über einer Wolkenschlucht mit Lücke (Sprung mit 1,3 s Luft), bergauf etwas langsamer, bergab Schub, Autos werden nach oben hin größer, Schatten weit weg; weiche Wolken-Banden an beiden Seiten des Bogens; zu kurz gesprungen → Einhorn setzt hinter der Lücke ab ✅.
- Silber: Garten, Wolkenteich mit roter Brücke (Geländer fest), Kois schwimmen und springen über die Brücke (Schalter `kois`), Kirschbäume, Steinlaterne ✅ (Bahnübergang mit Wolkenzug fehlt noch).
- Gold: Asphalt-Schikane mit Kerbs (Rütteln), Kiesbetten außen, Kakteen, Eis-Schanze über eine kleine Wolkenspalte zurück auf den Regenbogen ✅.
- Platin: Basaltweg mit glühendem Rand, kleiner Vulkan (fest), Lavarinne neben der Straße (nur Kulisse, Felsrand), Wurmloch auf einer Plattform innen in der Kurve, Ausgang auf der Straße hinter der nächsten Kurve ✅.
- Spirale mit zwei Boost-Pfeilen ✅; Regenschauer mit kleiner Wolke und Sonne, wäscht, Glitzerspur für etwa eine Runde, wenn man sauber herauskommt ✅.
- Farbbahnen mit Wirkung ✅ (Rot +8 %, Grün mehr Grip, Blau glatt, Violett −6 %; im Gewitter grau, Rot und Blau behalten etwas; in der Sonne doppelt). Wolken neben der Straße bremsen wie Gras, Wolkenlöcher (Terrain 48) mit Einhorn-Rettung ✅. Die Mitte der Karte ist eine tiefe Wolkenschlucht (man kann nicht abkürzen).
- Gewitterwolken statt Matsch (grau) ✅; Ereignis Einhörner mit Boost-Spur und „WIEHER!“ ✅; Ereignis Gewitter mit Sonnenaufgang, Wolkenfront von rechts, Regen (wäscht langsam), fünf zusätzlichen Gewitterwolken, Blitzen mit gelbem Zielkreis (nie auf den Münzen), „BZZZT!“, und in der letzten Runde Sonne, Glitzer statt Gewitterwolken, doppelter Regenbogen (ohne Bande), Feuerwerk ✅.
- Computerautos: rote Seite, Vollgas den Bogen hinauf (ein paar nicht), weichen Blitzkreisen aus, nehmen manchmal das Wurmloch und ab MITTEL den doppelten Regenbogen ✅.
- Musik `rainbow` (C-Dur, 128 BPM, Synth-Bells, Supersaw im Refrain, Arpeggios, Chor, pumpender Bass), im Gewitter a-Moll mit Pauke, letzte Runde D-Dur nur Refrain ✅; neue Töne Wiehern, Glitzer, Blitz, Summen, Sonnendurchbruch, Feuerwerk ✅.

Noch nicht: Leitmotive der Cups auf den Inseln, Bahnübergang mit Wolkenzug (Silber), sich drehendes Siegerpodest, Konfetti-Regen ab dem Zieleinlauf (nur das normale Konfetti), mehrere Wolkenebenen (nur eine Parallaxe-Ebene in den Löchern), „elektrische“ Antenne; das Lied ist noch nicht angehört, die Werte der Farbbahnen und der Sprung sind noch nicht im Spiel mit Kindern geprüft.

Idee: Die **letzte Strecke des Spiels** und das letzte Rennen des Superdupercups. Sie soll sich wie ein Finale anfühlen: eine **Ehrenrunde durch alle Welten** über den Wolken und gleichzeitig die schwerste Prüfung. Die Strecke erzählt eine kleine Geschichte über drei Runden: Sonnenaufgang, dann ein Gewitter, und erst danach, wenn die Sonne durch den Regen bricht, steht der **Regenbogen in voller Pracht** da (genau so entsteht ein echter Regenbogen: Sonne und Regen zugleich).

Die Straße ist ein **Regenbogen**: sechs Farbstreifen nebeneinander über die ganze Fahrbahnbreite (Rot, Orange, Gelb, Grün, Blau, Violett). Rot liegt immer links in Fahrtrichtung, Violett rechts. Sie führt über ein Wolkenmeer und verbindet vier schwebende **Münzinseln**: riesige Münzen der vier Cups, die wie Inseln in den Wolken liegen (Bronze mit Straße, Silber mit Bonsai, Gold mit Stern, Platin mit Blitz). Auf jeder Insel steht ein kleines Stück der Welt dieses Cups. Die Ziellinie liegt auf der **Fantasy-Münze** mit dem Einhorn.

Rundenverlauf (Uhrzeigersinn, Start links, es geht zuerst nach oben):
- 0–8 %: Start links auf der **Fantasy-Münze** (Regenbogenmünze mit Einhorn). Ein Torbogen aus Wolken mit Fähnchen in allen Farben, ein Siegerpodest am Rand.
- 8–20 %: Die Regenbogenstraße schwingt nach oben zur **Bronze-Insel** (Cup 1): eine kleine Wiese mit Zaun, zwei Kühe grasen auf der Strecke (die Kühe aus Strecke 1, nur zwei, langsamer), dahinter Tannen und ein Strandkorb. Auf der Insel ist die Strecke ein Erdweg mit einer Matschpfütze, wie ganz am Anfang des Spiels.
- 20–35 %: der **Regenbogen-Bogen**: Die Straße steigt in einem großen Bogen über eine Wolkenschlucht (das Auto wird beim Hochfahren immer größer gezeichnet, der Schatten wandert weit weg, wie bei einem Sprung). Oben, am höchsten Punkt, hat der Regenbogen eine **Lücke**: der **größte Sprung im Spiel** (etwa 1,3 s in der Luft). Ab etwa 75 % der Höchstgeschwindigkeit kommt man hinüber. Wer zu langsam ist, fällt durch die Wolken (siehe Wolkenloch). Bergab auf der anderen Seite wird man schneller (Gefälle).
- 35–48 %: die **Silber-Insel** (Cup 2): ein japanischer Garten mit einem Wolkenteich. Über die Strecke führt eine rote Brücke, an der die **Kois** aus dem Teich springen (wie in Strecke 6). Dazu ein Bahnübergang mit einem kleinen Zug aus Wolken, der quer fährt (nur einmal pro Runde, mit Schranke).
- 48–60 %: die **Gold-Insel** (Cup 3): eine kurze Rennstrecke aus Asphalt mit Kerbs und einem Kiesbett, dann eine **Schanze** aus Eis (wie auf der Eis-Strecke, kurz) auf die Regenbogenstraße zurück. Kakteen stehen am Rand als Kulisse.
- 60–75 %: die **Platin-Insel** (Cup 4): ein kleiner Vulkan mit einer Lavarinne neben der Strecke (nur Kulisse) und einem **Wurmloch** (aus dem Weltall) als Abkürzung: Es führt direkt auf die Regenbogenstraße hinter der nächsten Kurve.
- 75–92 %: die lange **Regenbogen-Spirale**: Die Straße schwingt in zwei großen Kurven (erst links, dann rechts) durch das Wolkenmeer zurück. Hier zählen die Farbbahnen am meisten (siehe unten). Boost-Pads aus der alten Strecke liegen hier als leuchtende Pfeile.
- 92–100 %: durch den **Regenschauer** (Waschen) und über die Fantasy-Münze ins Ziel.

Oberflächen:
- **Farbbahnen** (die Regenbogenstraße, neue Mechanik): Jede Farbe hat eine eigene Wirkung, schwach, aber spürbar:
  - **Rot**: Schub, 8 % schneller (wie Asphalt).
  - **Orange**, **Gelb**, **Grün**: normal (Grün mit etwas mehr Grip).
  - **Blau**: glatt (wie Glatteis, aber nur halb so schlimm).
  - **Violett**: weich wie Zuckerwatte, bremst leicht.
  Weil Rot immer links liegt, ist Rot in Linkskurven innen (kurz und schnell, ideal) und in Rechtskurven außen (schnell, aber weit). In Rechtskurven muss man sich also entscheiden: außen auf Rot oder innen auf Violett. Durch die Spirale (links, dann rechts) wechselt man die Bahnen ständig. Für Kinder reicht: „Auf Rot ist man schnell“, für Profis gibt es eine echte Ideallinie.
- **Wolken** neben der Strecke: weiß und weich, bremsen wie Gras. Sie lassen das Auto sauber.
- **Wolkenloch** (neues Terrain, dunkle Lücken im Wolkenmeer, auch unter dem Regenbogen-Bogen): Wer hineinfällt, fällt durch die Wolken. Ein **Einhorn** fängt das Auto auf (Wiehern, Glitzer) und setzt es an der letzten sicheren Stelle wieder ab (Mechanik vom Wasser im Garten, nur mit Einhorn). Auch hier: nichts geht kaputt, es ist nur eine kleine Rettung.
- **Gewitterwolken** statt Matsch: dunkelgraue, grollende Wolkenfetzen, die auf der Strecke liegen. Bremsen wie Matsch und machen das Auto **grau** (wie ein Regentag). In Runde 2 werden es mehr (siehe Gewitter).
- **Regenschauer** statt Waschanlage: ein Stück Strecke, auf das es dauernd regnet, mit Sonne darüber. Er wäscht das Auto. Wer ganz sauber herausfährt, bekommt eine **Glitzerspur** in Regenbogenfarben (Optik, eine Runde lang).
- **Inseln**: Auf den Münzinseln gilt der Boden der jeweiligen Welt (Erdweg, Asphalt, Eis-Schanze), ohne neue Regeln.

Streckenereignis **Einhörner** (`einhorn`):
- Einhörner galoppieren zeitgesteuert durch die Luft quer über die Strecke (wie die Kühe auf der Wiese, nur fliegend und schneller). Sie hinterlassen eine **Regenbogenspur**, die 3 s lang quer über der Strecke liegt und wie ein Boost-Pad wirkt.
- Wer ein Einhorn direkt rammt, schleudert wie bei der Kuh (Text „WIEHER!“). Ein Einhorn ist also gleichzeitig Hindernis und Chance: knapp dahinter durch ist schnell, mitten hinein ist teuer.
- Dieselben Einhörner fangen die Autos auf, die durch ein Wolkenloch fallen.

Streckenereignis **Gewitter** (`gewitter`), die Dramaturgie über drei Runden:
- **Runde 1 (Sonnenaufgang):** goldenes Licht, ruhige Wolken, die Farbbahnen leuchten blass, wie ein früher Regenbogen. Die Einhörner fliegen.
- **Runde 2 (Gewitter):** Sobald du in Runde 2 gehst, ziehen dunkle Wolken auf (wie die Sandwand in der Wüste, von rechts über die Karte). Es wird dunkel, es regnet über der ganzen Karte (Regen aus dem Wald). Der Regen **wäscht** langsam (etwa so stark wie ein Drittel einer Pfütze), aber die Gewitterwolken auf der Strecke werden mehr (wie die Löcher im Wald: an fünf Stellen nacheinander). Die Farbbahnen werden **grau** und verlieren ihre Wirkung, nur Rot und Blau bleiben schwach erkennbar.
  - **Blitze:** Alle 4 bis 6 s schlägt ein Blitz ein. Vorher erscheint 1,5 s lang ein gelber, flackernder Zielkreis (wie die Lavabomben im Vulkan, damit es für alle Kinder lesbar ist). Wer getroffen wird, ist kurz „elektrisch“ (Zickzack-Funken, die Antenne steht ab), dreht sich und ist grau. Auf den Münzinseln schlägt kein Blitz ein (sichere Zonen).
- **Letzte Runde (der Regenbogen):** Sobald der Führende in die letzte Runde geht, bricht die Sonne durch. Der Regen hört auf, die Gewitterwolken auf der Strecke lösen sich in Glitzer auf (die Strecke ist plötzlich wieder frei), und der Regenbogen leuchtet in **voller Pracht** (kräftige Farben, die Farbbahnen wirken doppelt so stark). Zusätzlich erscheint ein **doppelter Regenbogen**: eine zweite, schmalere Regenbogenstraße spannt sich über das Wolkenmeer und kürzt die Spirale ab (nur in der letzten Runde offen). Sie hat keine Leitplanke, wer sie verlässt, fällt (Einhorn). Am Himmel steigt Feuerwerk, ab dem Zieleinlauf regnet es Konfetti und Glitzer.
- Im Zeitfahren läuft die gleiche Geschichte nach der Runde des Spielers.

Computerautos: Sie fahren auf Rot, wo es sich lohnt, und bleiben in Rechtskurven lieber außen. Den Regenbogen-Sprung nehmen sie nur mit genug Tempo (sonst bremsen sie vor der Lücke nicht, sondern fallen, damit auch die Computerautos Fehler machen). Den doppelten Regenbogen nehmen sie ab mittlerer Schwierigkeit. Vor Blitz-Zielkreisen weichen sie aus.

Optik: Wolkenmeer in mehreren Ebenen, die langsam ziehen (Parallaxe), Heißluftballons in Regenbogenfarben, Vogelschwärme, Sonnenstrahlen in Runde 1, Blitze und Regen in Runde 2, Feuerwerk in der letzten Runde. Die Münzinseln drehen sich nicht, aber ihr Rand glänzt in der Metallfarbe ihres Cups. Die Cup-Symbole sind auf den Inseln groß zu sehen (Straße, Bonsai, Stern, Blitz). Am Ende eines Grand Prix oder des Superdupercups steht das Siegerpodest auf der Fantasy-Münze, die sich langsam dreht.

Musik `rainbow` (neu): **C-Dur, 128 BPM**, strahlender Euro-Dance-Pop.
- Lead: Synth-Bells (glockig, mit Delay) und eine Supersaw im Refrain.
- Glitzernde Arpeggios in Sechzehnteln, Chor-Flächen („Aah“), Four-on-the-floor mit offener Hi-Hat auf dem Off-Beat, Clap auf 2 und 4.
- Bass: pumpender Achtel-Bass mit Sidechain.
- Teil A: C – G – Am – F | C – G – F – G. Teil B (Refrain): F – G – Em – Am | F – G – C – C.
- **Leitmotive (Kür):** Auf jeder Münzinsel spielt über dem Beat für 2 Takte der Erkennungs-Hook des passenden Cups (Bronze: das Quadratwellen-Motiv der Wiese, Silber: Erhu-Phrase des Gartens, Gold: der Supersaw-Hook der Rennstrecke, Platin: Brass-Stab des Vulkans), in C-Dur übertragen. Das macht das Finale zur Erinnerung an das ganze Spiel. Kann auch später kommen, die Strecke funktioniert ohne.
- **Runde 2 (Gewitter):** Das Lied wechselt nach **a-Moll** (dieselbe Melodie in Moll), ein Filter schließt sich, die Chorflächen werden dunkel, Donner liegt als tiefe Pauke auf der Eins jedes vierten Taktes.
- **Letzte Runde (Regenbogen):** zurück nach Dur und einen Ganzton höher (**D-Dur**), nur noch der Refrain, voller Chor, Glocken und ein Crash zu Beginn jeder Phrase. Das ist der Höhepunkt der Musik im ganzen Spiel.

Neue Töne: Wiehern (Einhorn, Auffangen), Glitzer (helle, aufsteigende Glöckchen), Donner, Blitzeinschlag (Knistern und Knall), Durchbruch der Sonne (aufsteigender Chor-Akkord), Feuerwerk.

Warum die schwerste und letzte Strecke: Sie verlangt alles, was man im Spiel gelernt hat (Matsch und Waschen, Sprünge, Glatteis, Kühe, Kois, Wurmloch, Vorwarnungen lesen) auf einer Runde, dazu die Farbbahnen als eigene Ideallinie und den größten Sprung im Spiel. Das Gewitter macht Runde 2 zur härtesten Runde, und die letzte Runde belohnt mit dem schönsten Bild und dem doppelten Regenbogen als letzter Entscheidung kurz vor dem Ziel.

Was von der alten Strecke bleibt: der Name, die Boost-Pads (als leuchtende Pfeile auf der Spirale) und die Idee „Regenbogen“. Was geht: der Sternenhimmel, die Asteroiden-Wand und das Lied (alles ans Weltall), die lila Matschflecken und das Wasser.

Ursprüngliche Vorgabe:
Bestehende Strecke (schon im Spiel, bisher Plattformen im All mit Boost-Pads). Bleibt Regenbogen, **braucht aber einen Rework**, damit sie ein echter Regenbogen wird.
Cup: Fantasy (Cup 5)
Musik: bisher Schwebender Synthwave in e-Moll (passt eher zum neuen Weltall). (Vorschlag) für den Rework: strahlender Euro-Dance-Pop in C-Dur mit glitzernden Arpeggios, Synth-Bells, Chor-Pads und treibenden Four-on-the-floor-Drums.
Streckenereignis: bisher Boost-Pads als Abkürzungen. (Vorschlag) Farbwechsel-Abschnitte: Jede Farbbahn des Regenbogens hat einen anderen Effekt (Boost, Eis, Matsch). Einhörner galoppieren über die Strecke.
Änderung (Rework): Regenbogenstraße über Wolken statt Plattformen im All, Himmel und Farbspektrum statt Sternen. Boost-Pads bleiben als Abkürzungen. Kein Mud, stattdessen z. B. Wolken- oder Zuckerwatteflächen. **Angepasst:** Gewitterwolken als Matsch (damit Waschen auch im Finale zählt), der Regenschauer als Dusche.

---

Cup-Übersicht
- Cup 1 Bronze: Wiese, Wald, Strand (Bronzemünze mit Straße drauf als Cupsymbol)
- Cup 2 Silber: Zug, Baustelle, Japanischer Garten (Silbermünze mit Bonsai als Cupsymbol)
- Cup 3 Gold: Rennstrecke, Sand, Eis (Goldmünze mit Stern als Cupsymbol)
- Cup 4 Platin: Vulkan, Dschungel, Weltall (Plantinmünze mit Blitz als Cupsymbol)
- Cup5 Fantasy: Süßigkeitenland, Spielzimmer, Regenbogen (Freigeschaltet durch 1. Sieg im Supercup) (Regenbogenmünze mit Einhorn als Cupsymbol)

Supercup:
 - Alle 12 Strecken am Stück

Superdupercup
- Alle 15 Strecken am Stück (Freigeschaltet durch 1. Sieg in Cup5)
   
Custom
- Auswahl wie viele Gegner (1-9)
- Auswahl wie viele und welche Strecken.

Stand im Spiel (2026-10-14, `src/cups.js`): Cup 1 bis 4 haben Strecken (Cup 4 mit Weltall), Cup 5 hat Süßigkeitenland, Spielzimmer und Regenbogen (Prototypen). Supercup = alle Strecken der Cups 1 bis 4 (heute 12), offen nach den ersten Siegen in Cup 1 bis 4. Superdupercup = alle Strecken der Cups 1 bis 5, offen nach dem ersten Sieg in Cup 5. Custom Cup: bis 12 Strecken in beliebiger Folge (auch doppelt), 2 bis 7 Gegner; er wird nicht gespeichert, sondern bei jeder Wahl neu zusammengestellt (beginnt leer).
