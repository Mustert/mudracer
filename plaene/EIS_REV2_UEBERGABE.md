# EIS Rev 2 – Übergabe (Stand nach E2)

Zum Weiterarbeiten in einer neuen Session: erst `plaene/EIS_REV2.md` (Plan, Arbeitspakete mit Status), `CLAUDE.md`, Skills `strecke` und `mechanik` lesen, dann diese Datei. Branch `map_pack`, jedes Paket ein Commit mit Push, vorher `npm run lint`, `npm test`, `npm run typecheck`, `mudracer.check('EIS')` (Dev-Server, Preview stumm: `localStorage.setItem('mudracer-music','0')`).

## Stand

- **E1 erledigt** (Commit `9037b30`): Karte 1000 × 1500, Bauzeit ~1 s, Runde ~56 s (ohne Lift), 10/10 im Ziel (LEICHT und SCHWER), Start gerade.
- **E2 erledigt** (Sessellift).
- **E3 erledigt** (Bobbahn: `def.slopes = [[150, 70, 700, 355, 40]]`, Eis läuft 40 Indizes (80 px) über die Bande hinaus).
- **E4 erledigt** (Schanze und Wald): Bäume entstehen in `iceTerrain` (`RT.trees`, Poisson-Scheiben, `ground: true` für y < 800), Tiefschnee-Senken `def.deep` plus Wehen im Lee einiger Bäume (`deepM`), „8“ `def.eight`; `iceUpdate` legt nahe Bäume in `T.ev.obst`; Hook `airTop` (neu, allgemein) zeichnet Autos über den Kronen. Funnel-Wandenden so gekürzt, dass sie nicht in die Straße am U-Bogen ragen.
- **E5 erledigt** (Fön, Bergauf, Serpentinen): `def.bay` = { lane, half, wash, wall, wall2, sign } an der Bergauf-Straße (x = 520, y 965–1052); `iceTerrain` stempelt die Spur (`stampLine`, `RT.bay = { P, i0, lane }`, `alt`), `paintFoen` malt Boden, Mauern, Hütte, Schild; `foenTarget` (Hook `target`) und `iceThrottle` (Hook `throttle`, auch Gas vor den Kehren) in `ice.js`; `T.ice.serp` = Indexbereich der Serpentinen. Die Grate um die Fön-Tasche liegen jetzt bei [585,510→925], [585,925→660,975], [660,975→852,975], [715,975→1235].
- **E6 erledigt** (Schneeball, `def.events = ['schneeball']`): `initBalls`, `ballsUpdate`, `iceCollisions` in `ice.js`, Zustand in `T.ev.iceBalls` (`iceBallOn`, `iceBallCd`, `iceBallK`). Ein einziger Lauf (LEICHT, mit Ereignis) endete 9/10 mit 39 Reversen eines Autos, ließ sich in 25 weiteren Läufen nicht wiederholen: bei E8 viele Läufe prüfen (`for`-Schleife über `mudracer.check('EIS', {diff: 0})`, bei Fehlschlag `checkPic`).
- **E7 erledigt** (Eissee und Eisbruch, `def.events = ['schneeball', 'eisbruch']`): Zellen und Bruch in `ice.js` (`initBreak`, `lakeGround`, `breakUpdate`, `safeCells`, `wayAcross`, `lakeRespawn`, `lakeRoute`, `lakeTarget`), Rand über `T.ice.lakeD` (Abstand zum Ufer, `RIM` = 28 in `icemap.js`). Lehre beim Testen: Die KI-Wegfindung muss über Zellen gehen (Dijkstra), nicht über feste Spuren, und beim Absetzen muss das Auto zur Route zeigen, sonst fällt es in einer Endlosschleife immer wieder an derselben Stelle ein (Eis lenkt langsam). `check` hat jetzt die Option `cars` (Feldgröße).
- **E8 erledigt** (Abschluss: Lied, Töne, Messung, Doku in `ROADMAP.md`, `Strecken.md`, Skills). **Das Paket ist damit fertig;** es fehlen nur die Abnahme durch den Nutzer (ROADMAP 1S9-5) und die Messung auf Mobilgröße (1S9-8). Nicht publisht (Phase 1 ist laut ROADMAP noch nicht komplett).
- (Alte Zeile zu E8:) (Reihenfolge laut Plan). Nichts publisht, `ROADMAP.md` und Obsidian-Doku erst in E8 (Plan Abschnitt „Arbeitspakete“).

## Was E1 festgelegt hat (nicht im Plan)

- Dateien: `src/icemap.js` (Gelände `iceTerrain`, Bild `paintIce`), `src/ice.js` (Laufzeit, nur Boden, Einschneien, Hook `progress`, Polarlicht), `TRACK_DEFS`-Eintrag EIS in `src/tracks.js`.
- Mittellinie (`poly`), Fahrtrichtung: Ziellinie (72, 1130) → Lift/Straße nach Norden bis (72, 70) → Bobbahn Schenkel y = 70 (nach Osten), 165 (West), 260 (Ost), 355 (West) mit Kehren bei x = 880 und 440 → Schneestrecke nach Westen bis (300, 355) → nach Süden: Anlauf, Schanze Lippe (300, 520), Wald-Feld bis y ≈ 1000, Trichter, Straße (300, 1120) → Ost (520, 1120) → Bergauf nach Norden bis (520, 470) → Serpentinen (5 Schenkel y = 470 / 580 / 690 / 800 / 910, Kehren bei x = 930 und 680) → Abfahrt x = 930 nach Süden bis (930, 1400) → See und Rückweg nach Westen y = 1400 → (72, 1400) → Startgerade.
- Straßenbreite `HALF` = 30; Aufstellung braucht **200 px** hinter der Linie (Indizes, 2 px je Index), darum liegt die Linie bei y = 1130 und die Kurve unten bei y = 1400.
- **Lift (E2):** `def.lift = [72, 1105, 180]` (x, y Talstation, y Absetzen), `def.chess = [134, 700]`. Code 70 auf der Straße von y 1105 bis ~200. Hook `ground` (`ice.js`) hängt jedes Auto ein, das Code 70 am unteren Ende erreicht (`c.y > 1045`, fährt nach Norden, nicht `finished`): `c.iceLift = { s, y0, x0, off, ph }` (NICHT `c.lift`, das nutzt `draw.js` für die Regenbogen-Rampe). Hook `stuck` ruft `liftStep`: fest 190 px/s, kein Physik-Schritt, `c.ghost` hält Auto-Kollisionen aus, `c.idx` wird aus y gerechnet, oben mit -105 px/s abgesetzt. `drawCar` zeichnet Sessel und Schatten, `drawAbove` die Seile (x = 72 ± 18) mit leeren Sesseln, `drawGround` die Schachspieler. Masten, Stationsdächer (Top-Bild), Stumpf mit Brett und Rentier in `paintLift` (`icemap.js`). `noRespawn` verbietet Code 70.
- Kein Abkürzen (Grundsatz 4), alles als feste Hindernis-Kreise in `paintIce`: `fence` (Zaun x = 172, y 105–1235), `blocks` (Massiv links oben, Streifen oben, rechts oben, rechts unten), `ridges` (Grate: Felswand y = 415, Waldrand x = 480, Trichterwände, Wand mit Tieren y = 1235, Bergauf-Ostgrat x = 585, Serpentinen-Unterkante y = 965, Tasche x = 715), `klippen` (vier Ketten r = 20 zwischen den Serpentinen-Schenkeln, an einem Ende am Grat/Block, am anderen in der Kehre). `check` meldet keine Abkürzung.
- Wald = `field` (Polygon), Code 71 Pulverschnee (Hook `surf`: `[.9, 6, .9]`), `T.ice.fieldM`/`alt` gesetzt (kein Zurück-Pfeil). **Noch ohne Bäume** (E4), Tiefschnee fehlt (E4).
- Bob = Eis (12) mit federnder Bande (`bob: 1`) von (150, 70) bis (700, 355); **noch kein Gefälle** (`def.slopes` fehlt; E3 Bob, E5 Bergauf negativ und Serpentinen positiv).
- See: Ellipse `lake: [600, 1390, 270, 105]`, Straße darüber ist Eis; Eisbruch (E7) fehlt noch, Polarlicht in der letzten Runde über dem See ist übernommen.
- Hook `progress` (`iceProgress`): sucht ±200 Indizes um `c.idx` (Wald neben Bergauf, Serpentinen-Schenkel).
- Entfernt: Gletscher, Bach mit Brücke, Quelle, Boost-Pad, Frost, Pinguin-Ereignis, Lawine, Schneefall (`drawSky`), Seilbahn am Rand. `PREFS.events` und `FX_NAMES` haben schon `schneeball` und `eisbruch` (ohne Wirkung, `def.events` ist noch `[]`; in E6/E7 eintragen). `music.js` fragt noch `ev.iceFrostOn` (wird nie gesetzt: Lied bleibt in allen Runden leise; E8 neu binden).
- Menü-Vorschau: `previewBox` in `tracks.js` zeichnet hochkante Karten mit Rand.

## Hinweise

- Shell: Backticks und `'` in `node -e "…"` zerlegen die Bash-Zeile; Dateien mit dem Edit-Werkzeug ändern.
- Zeilenenden: `src/ice.js`, `src/icemap.js` neu geschrieben (LF), Git normalisiert.
