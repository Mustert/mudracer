---
name: mechanik
description: Nachschlagewerk, wie die Mechaniken von Mudracer funktionieren und wo sie im Code stehen (Spielschleife, Boden-Codes, Physik, tiefes und flaches Wasser, Brücken, Schmutz und Waschen, Fallen und Zurücksetzen, Sprünge, KI, Runden, Ereignisse, Zeichnen, Zustand). Laden, bevor an einer Mechanik, einer Strecke oder einem Fehler im Rennen gearbeitet wird, statt den Code neu zu lesen.
---

# Mechaniken von Mudracer: wie es läuft und wo es steht

Kurzabriss, damit nicht jede Aufgabe mit Code-Lesen beginnt. Fundstellen sind Funktionsnamen (Zeilennummern veralten): `grep -n "function sinkCar" src/update.js`. Für den Bau einer Strecke (Einhängepunkte, Hooks, Prüfskript) gilt zusätzlich der Skill `strecke`.

**Pflege:** Ändert sich eine Mechanik, die hier beschrieben ist (Ablauf, Werte, Boden-Codes, Felder), wird dieser Skill im selben Commit angepasst (Block `1T` in `ROADMAP.md`).

## 1. Spielschleife und Ablauf eines Schritts

- `main.js`: `requestAnimationFrame` → `clock.js` `makeClock` (feste Schritte `STEP = 1/60`, höchstens 8 je Frame) → `update(dt)` (`update.js`), dazwischen gezeichnet mit `drawRace` (`draw.js`) bzw. `drawState` (`ui.js`, Menüs).
- `update(dt)`: Countdown (3 s, dann `setState('race')`), Zeitfahren-Geist, `updateRace(dt)`, Partikel, Motorgeräusch, Musik.
- **`updateRace(dt)` in dieser Reihenfolge:**
  1. `updateTrain`, `updateEvents` (Ereignisse, Hook `update`), `ringUpdate`, `pushCars` (Schübe, wenn `T.jumps` existiert)
  2. je Auto: `fall`-Zähler (versunken → `respawn`), Hook `stuck`, `stun` (dreht sich), sonst Eingabe (Spieler) oder `aiTarget` + Gas (KI) → `physics(c, dt, thr, tgt)` → `airborne` (Sprünge) bzw. `updateJumps` (Matschfahrt) → `guardCar` (NaN-Schutz)
  3. Kollisionen: Hindernisse aus `T.grid` (`nearObstacles`, Radius `o.r + 9`), Kartenrand (10 px), `eventCollisions` (Kois, Kipper, Reifen, Hook `collisions`, Kühe), Auto gegen Auto (Abstand 18, nicht bei `ghost`/`fall`/anderem `lvl`; Hindernisse mit `down` nur für `lvl` 2, mit `up` nur für `lvl` 1)
  4. Boden je Auto (nur am Boden, `z == 0`, nicht `fall`): `c.surf = T.ter[j]`, Waschen, **tiefes Wasser**, Matsch/Zement, flaches Wasser, Boost, Öl → `groundFx` (Cup 3) → Hook `ground` → Reifenspuren auf `tctx` → `updateProgress` und `c.safe`
  5. `moveCamera`
- Zustände (`G.state`) und Wechsel: `state.js` `setState`; Liste in `g.js`. Pause hält alles an.

## 2. Die Strecke im Speicher (`G.T`)

Gebaut von `buildTrack` (`tracks.js`, Generator in Häppchen über `idle.js`; `ensureTrack(T)` baut sofort). Wichtige Felder:

| Feld | Bedeutung |
|---|---|
| `W`, `H` | Kartengröße (Standard 800×450, `def.W/H`); Sicht `VW×VH` = 480×270 (`core.js`) |
| `path`, `tan`, `nrm`, `N` | Mittellinie (Punkte, Richtung, Normale), aus `def.pts` über `centreLine`; Index `i` = Fortschritt |
| `dist`, `near` | je Pixel: Abstand zur Mittellinie und nächster Index. Straße = `dist < HALF` (`HALF = 30`) |
| `ter` | Boden-Code je Pixel (`Uint8Array`, Index `y * W + x`), siehe Abschnitt 3 |
| `washMask`, `washC`, `showers`, `hoses` | Waschanlage (Maske, Mitte), Duschen, Schlauch (Baustelle) |
| `grid`, `trees` | feste Hindernisse (Bäume, Wände, Zaunpfosten, Hecken, Geländer) als Kreise `{x, y, r}`; Raster aus `grid.js` |
| `base`, `top` | Bodenbild und obere Ebene (Baumkronen, Geländer); `tctx` (`TiledLayer`, `layer.js`) = Reifenspuren und Schlammtropfen |
| `mudPix`, `watPix`, `starPix`, `cemPix` | Pixel für Blubbern, Glitzern, Sterne |
| `stone`, `bridges`, `alt` | Trittsteine (Maske), Brücken (Indexbereiche), Zweitweg-Maske (kein Zurück-Pfeil) |
| `jumps`, `pushes` | Sprünge und Schübe (`trackfx.js`), `tight` (Engstellen, KI fährt mittig) |
| `ev` | Laufzustand der Ereignisse, nur im Rennen (`setupEvents`) |
| `<flag>` | Zustand einer Sonderstrecke (`T.desert`, `T.toys` …), was `paint` der Karte zurückgibt |

Reihenfolge in `buildTrack`: Abstandsfeld → Straße (1) → Meer (`th.sea`) → **tiefes Wasser** aus `def.rivers` → Brücken → Trittsteine → `mud`/`water`/`ponds`/`mudAt`/`waterAt`/`cement`/Duschen/Boost → `terrain` der Sonderstrecke → Bahn → Ufer (`shore`) → Bodenbild → Waschanlage → Wände/Zäune → Deko je `th.decor` (Garten: Brückengeländer, Hecken) → Bäume → Rückgabe.

`def`-Felder (Eintrag in `TRACK_DEFS`): `pts`, `rev`, `seed`, `W/H`, `theme`, `song`, `events`, `mud/water` (`[t, Versatz, halbe Länge, halbe Breite]` entlang der Mittellinie), `mudAt/waterAt/cement` (`[x, y, …]`), `ponds`, `rivers`, `stones`, `squareBridges`, `wash`/`washAt`, `showers`, `boost`/`boostAt`, `grow`, `wall`/`wallStyle`, `hedges`, `rail`, `tunnels`, `jumps`, Sonderschalter (`desert: true` …).

## 3. Boden-Codes (`T.ter`)

Werte `[Tempo, Seitenhaftung, Lenkung, Gas]` aus `surfOf` (`physics.js`), Wirkung in `updateRace`. `m` = `def.mud`, `MUD_A + MUD_B·m` = 0,16 + 0,30·m.

| Code | Boden | Fahrwerte | Wirkung |
|---|---|---|---|
| 0 | neben der Straße (Gras) | wie Matsch | bleibt sauber, Ruckeln |
| 1 | Straße | `th.asphalt` oder 1, Haftung 10 | Staub ab 80 px/s |
| 2 | Matsch | `MUD_A + MUD_B·m`, 2,4·m | `dirt += .55/s`, Spuren |
| 3 | flaches Wasser | .72, 1,6, .65 | `dirt −= .7/s`, beim Hineinfahren −.15 und Spritzer |
| 4 | Boost | wie Straße | `c.boost = 1.3 s` (×1,5 Höchsttempo) |
| 5 | **tiefes Wasser** | (Straße-Werte, egal) | nach 0,22 s versinkt das Auto (Abschnitt 4) |
| 6 | Zement | Matsch/3,8 | grauer Schmutz (`c.cem`) |
| 7 | Kies | .3 | Ring |
| 8 | Öl | keine Bremse, Haftung .55 | schwarz, Zucken |
| 9 | verschmiertes Öl | Haftung 3,2 | Ring |
| 10 | Treibsand / tiefer Sumpf | .3 | zieht (`sinkInSand`), versinkt |
| 11 | Schlucht, Grabschacht (Wüste) | – | Fall (`fallCar 'abyss'`) |
| 12 | Blankeis | 1, wenig Haftung, Gas ½ | KI nimmt Gas weg |
| 13 | Mondboden | wie Gras | Weltall |
| 14 | Hängebrücke | .6 | Knarzen |
| 15 | Lava | – | Fall (`'lava'`), Rauch; der Dreck bleibt, wie er war |
| 16 | frei (früher Kruste von Vulkan Rev 1) | – | – |
| 17 | Plattform Schwerelosigkeit | wenig Haftung | Weltall |
| 30–32, 41–48, 50–52 | Spielzimmer (30 Parkett, 31 Weg über die Bettdecke, 32 Wasserfarbe), Regenbogen, Strand-Volleyball | Hook `surf` | eigene Blöcke |
| 60–61 | Wüste Rev 3: Rallysand, Treibsand-Vorstufe | Hook `surf` | siehe Abschnitt 14 |
| 70–71 | Eis Rev 2: 70 Lifttrasse (Straße unter den Seilen), 71 Pulverschnee im Wald | Hook `surf`: 71 `[.9, 6, .9]`, 70 wie Straße | 70: das Auto wird eingehängt (`c.iceLift`), 71: offenes Feld, macht nicht weiß; siehe Abschnitt 15 |
| 80 | Vulkan Rev 5/6: Felsufer der Rinnen und der eingeschlossene Hang dazwischen | Hook `surf`: wie Code 0 | fest an allen Kanten (Kreise 6 px innen), Hook `noRespawn` |
| 81 | frei | – | – |
| 90–92 | Dschungel Rev 2: 90 Waldboden des Unterholzes, 91 Furtwasser, 92 Bohlen | Hook `surf`: 90 `[.86, 8, .95]`, 91 wie flaches Wasser `[.72, 1.6, .65]`, 92 wie Straße | 90: offenes Feld (`alt`, sauber); 91: Strömung nach Süden (`pushes` Rechteck), wäscht nicht, macht leicht grün; 92: klappert; siehe Abschnitt 17 |
| 100 | Weltall Rev 2: Ringstaub (offenes Feld im Ring des Planeten) | Hook `surf`: `[.94, 2.4·turn², .8, 1]` (etwas langsamer und glatter als Code 17) | offenes Feld (`alt`); der Planet zieht, beim Verlassen zum Ende hin der Swing-by; siehe Abschnitt 18 |
| 110–114 | Süß Rev 2: 110 Zuckerguss (Wald-Feld), 111 Karamell, 112 Kaugummi, 113 Fließband, 114 Marshmallow | Hook `surf`: 110 `[.86, 8, .95]`, 111 `[.38 + .16·mud (.45–.72), 3,5·mud, .75, .8]`, 112 `[.32, 7, .6, .7]`, 113/114 wie Straße | 110 offenes Feld (`alt`, sauber); 111 macht golden (`c.cem` = zweiter Satz), danach Nachkleben über `surf`; 112 hält; 113 Schub aus `pushes` (Rechtecke); 114 federt (Sprünge `soft`); 111, 112, 114 sind kein Rückkehrplatz (`noRespawn`); siehe Abschnitt 19 |
| 120–123 | Spielzimmer Rev 2: 120 Staub unter dem Bett, 121 Noppenplatte der Stadt, 122 gefegter Boden unter dem Bett, 123 Bauklotz-Treppe | Hook `surf`: 120 `[.5, 3, .7]`, 121 `[.93, 9, .95]`, 122 `[.84, 9, .95]`, 123 `[.48, 10, .9]` | 120 macht grau (`c.cem`, Hook `ground`); 121 offenes Feld (`alt`), ruckelt; oben auf dem Bett liest das Auto statt `T.ter` das Bild der Bettdecke (`bedT`); siehe Abschnitt 20 |
| 130–131 | Regenbogen Rev 2: 130 Wolkenpfad (Gabelung über die Schlucht), 131 Station des Sessellifts | Hook `surf`: 130 `[.84, 6, .9]`, 131 wie Asphalt `[1.03, 10, 1]` | 130 Nebenweg (`alt`, Löcher am Rand); 131 hängt das Auto ein (`c.rbLift`), kein Rückkehrplatz; dazu 41–46 Farbbahnen, 47 Gold-Asphalt, 48 Wolkenloch; siehe Abschnitt 21 |

Die Physik liest den Code am Auto-Mittelpunkt (ein Pixel), gesetzt im Boden-Teil von `updateRace` (`c.surf`), also einen Schritt verzögert.

## 4. Wasser, Brücken, Trittsteine (Garten, Süß, Eis; der Dschungel hat seit Rev 2 seinen eigenen Fluss, Abschnitt 17)

- **Entstehung** (`buildTrack`): `def.rivers` = Ketten von Kreisen `[x, y, r]`, zwischen je zwei wird eine Kapsel mit verrauschtem Rand in die Maske `deep` gestempelt. Nur wo `ter == 0` (neben der Straße) wird daraus Code 5; **Straße über `deep` bleibt Code 1 = Brücke**.
- **Brücken**: Abschnitte der Mittellinie, die über `deep` laufen, ±8 Punkte verlängert (`bridges`, `isBridge[i]`), `bridgeMask` = Straßenpixel darauf (Holzplanken im Bild). Mit `def.squareBridges` (Garten) endet jede Brücke in einem geraden Schnitt quer zu ihrer Mitte, 10 px vom Wasser, die Bohlen liegen quer (`deckAt`/`onDeck` in `buildTrack`, auch für die Geländer). Geländer: Garten, Süß und Eis setzen alle 3 Punkte Hindernisse `r: 3` bei `±HALF` (Garten: rote Lackgeländer in der `garten`-Deko, `suessmap.js`, `icemap.js`); andere Strecken haben auf Brücken kein festes Geländer.
- **Trittsteine** `def.stones` `[x, y, r]` oder `[x, y, r, Streckung, Winkel]` (ovaler großer Stein, `stoneD` in `tracks.js`): Code 1 + `stoneMask` (`T.stone`). Kein Zurück-Pfeil auf Steinen. Zwischen den Steinen bleibt Code 5.
- **Zaun am Wasser (Garten)**: in der Zaun-Schleife wird der Zaun bei Wasser nach außen versetzt (5–11 px); liegt tiefes Wasser direkt dahinter, wird er eine feste Bambus-Palisade, außer im Umkreis von 60 px um Trittsteine (dort fährt man absichtlich hinein). Die Palisaden-Punkte einer Straßenseite werden in `palisade` (`tracks.js`) zu einer durchgehenden Linie verbunden (Lücken bis 10 Punkte und 16 px), 5 px breit mit Pfosten alle 9 px und Schatten. Die Hindernisse (`r: 2.5`) liegen alle 4 px auf genau dieser Linie, also stimmen Bild und Kollision überein (1S6-11).
- **Ufer** `shore`: 3 px Rand um Wasser (eigene Farbe `th.shore`); keine Bäume und keine normalen Zäune dort.
- **Versinken** (`updateRace`): `c.wet += dt` solange `c.surf === 5`, sonst 0; ab `c.wet > .22` → `sinkCar(c)`: `fall = 1.4 s`, sauber (`dirt = 0`), Stillstand, Spritzer. Fliegende Autos (`z > 0`) versinken nicht; landen sie in 3/5, gibt es nur einen Spritzer (`land`), versinken dann im nächsten Schritt über den Zähler.
- **Zurücksetzen** `respawn(c)`: ab `c.respawnI` oder `c.safe − 5` rückwärts bis 90 Punkte, seitlich 0/±16/±22, bis kein Code 15/11/5 und kein Hook `noRespawn`; Blickrichtung der Straße, `ghost = 2.4 s` (durchsichtig, keine Auto-Kollision). `c.safe` = letzter Index, an dem das Auto nicht auf 5 und höchstens `HALF + 1` von der Mitte war oder auf `T.alt` stand (Strecken ohne Straße, Wüste).
- **KI**: meidet Code 5 nur über die `sticky`-Prüfung in `aiTarget` (gilt für Autos mit `mud < 1.15` oder `avoidAll`, je nach `DIFFS.avoid`); sonst folgt sie der Mittellinie und deren Versatz `lane`. Abkürzungen über Steine fährt sie nur mit Hook `target`/`lane`.
- **Kois** (Ereignis `kois`, `events.js`): feste Sprünge `KOIS` `[x, y, Richtung, halbe Länge, Periode, Versatz]`, nur von der Rennzeit abhängig (Zeitfahren wiederholbar); 0,6 s vorher Ringe auf dem Wasser (`drawKoiWarning`); Treffer wie Kuh (`stun 1.1`). `checkSpots` meldet im Dev-Server Sprungenden, die nicht im Wasser liegen.
- **Meer/Flut** (Strand): `th.sea` → Code 3 unter `shoreY`, Flut ab Runde 2 färbt Zeilen um (`updateFlood`), Steg `PIER`.

## 5. Schmutz und Waschen

- `c.dirt` 0..1. Steigt in Matsch/Zement (.55/s, langsam unter 8 px/s), Öl (1,36/s), Treibsand (.5/s), am Vulkan neben der Straße (Code 0, Hook `ground`, `EARTH` .27/s: erdig, Satz `ash` in Erdbraun); Fallen in Sand setzt 1, Fallen in Lava lässt den Dreck (1S10-28), Versinken im Wasser 0.
- Wirkung über `def.soil` (`cars.js`, aus `mud` berechnet, 0,04 bis 0,21): Höchsttempo × `(1 − soil·dirt)`, Lenkung schwächer, Stottern beim Gas, Schlingern ab `dirt > .15`. Geländewagen (hohes `mud`) leiden kaum.
- Sauber werden: flaches Wasser (−.7/s), Waschanlage `washMask` (−.35 beim Einfahren, dann −3/s), Duschen `T.showers` (−.12, dann −1,8/s), Schlauch, Sonderstrecken über Hook `ground`. Grundsatz 13: genau eine Art je Strecke.
- Box (Rennstrecke, `ring.js` `ringGround`): wer in der Gasse die Mitte der Box erreicht, steht 1 s (`c.boxT`) und wird dabei sauber; immer nur ein Auto zugleich. Boxenmauer (`def.pit.wall`) und Leitplanke vor den Garagen fassen die Gasse ein, es gibt keinen Weg an der Box vorbei. In der letzten Runde eines Autos (`boxShut`) ist die Einfahrt mit einer Schranke zu (`pit.gate`, Hook `collisions`, nur für dieses Auto fest; gezeichnet, wenn dein Auto in der letzten Runde ist). Computerautos fahren nur dreckig (`dirt ≥ .5`), einzeln und mit Gas ≤ .55 hinein (Hooks `target`, `throttle`).
- Aussehen: je Auto 6 Schmutzstufen (`newSet`, `cars.js`), Farbe aus `th.goo` (Matsch, Sand, Schnee, Asche …), zweiter Satz `Fc` für Zement/`goo2`; `c.cem` sagt, welcher gezeigt wird.

## 6. Physik eines Autos (`physics.js` `physics`)

- Autowerte `CAR_DEFS` (`cars.js`): `speed`, `mud`, `acc`, `turn`, `engine`, `honk`; abgeleitet `soil`. Konstanten `core.js`: `MAXS = 135` px/s, `ACC = 230`, `MUD_A/B`, `LAPS = 3`.
- Höchsttempo `MAXS · speed · Boden · (1 − soil·dirt) · Boost 1,5 · Windschatten · Gefälle (c.slope) · Brand .85 (c.vFire, Vulkan)`.
- Lenkung zum Zielwinkel `tgt`, max. `4.6 · turn · Bodenlenkung · …` rad/s, bei Stillstand schwächer. Seitliche Geschwindigkeit zerfällt mit `exp(−Haftung·dt)` (wenig Haftung = Rutschen).
- Rollwiderstand `exp(−.25·dt)` mit Gas, `exp(−3·dt)` ohne; Bremse `exp(−6·dt)`; rückwärts höchstens 35 px/s.
- Fliegend (`c.z > 0`): nur geradeaus weiter, keine Lenkung, kein Boden.
- Steuerung: `PREFS.CTRL` `'std'` (oben = Gas, links/rechts lenken) oder `'alt'` (Richtung auf dem Bildschirm), in `updateRace`.

## 7. Fallen, Sprünge, Schübe (`trackfx.js`)

- `c.fall > 0`: Auto ist weg (zählt herunter, dann `respawn`). Arten über `fallCar(c, kind, at)`: `'abyss'` (Schlucht), `'sand'`, `'lava'`, `'space'`, `'cloud'`; Wasser über `sinkCar` (ohne `fallKind`). Gezeichnet über Hook `drawFall`.
- Sprung `{x, y, tx, ty, lo, hi, vz, push, off, land, g, soft}`: abheben beim Überqueren der Kante vorwärts (≥ 30 px/s), Schwerkraft 380 oder die eigene `g` des Sprungs (`c.jg`, Mondsprung 150); `land` prüft den Boden (11/15/48 → Fall, 3/5 → Spritzer), schiefe große Landung (über 0,7 s in der Luft) → `stun`, außer der Sprung hat `soft` (`c.jSoft`).
- Schub `{i0, i1, f}` entlang der Straße (Gefälle) oder `{rect, fx, fy}` (Strömung).
- `T.jumps` ist immer ein Feld (sonst `[]`, Schanzen aus `def.jumps` oder von der Sonderstrecke), daher laufen `pushCars` und `groundFx` auf jeder Strecke; `airborne` nur bei Sprüngen oder in der Luft.

## 8. KI (`physics.js` `aiTarget`, `update.js`, `diff.js`)

- Ziel: Punkt `18 + Tempo/8` Indizes voraus auf der Mittellinie, seitlich versetzt um `lane = sin(Zeit·.4 + seed) · wander` (`DIFFS.wander` 14/11/8 px, Hook `wander`, 1,5 auf dem Steg, 1 an Engstellen).
- Ausweichen vor Matsch/Zement/Gras/tiefem Wasser/Kies/Öl (`sticky`): nur Autos mit `mud < 1.15` (oder Hook `avoidAll`), Anteil `DIFFS.avoid` (0 / .5 / 1). Danach Hook `lane`, dann `steerAround` (Kühe, Reifen, `T.ev.obst`, 75 px voraus; nur was im Weg liegt, seitlich höchstens `r + 24` px, und alles zusammen höchstens 55 px Versatz). `steerAround` gilt auch für das Ziel aus dem Hook `target`, darum keine Hindernisse in `T.ev.obst` legen, die in schmalen Wegen liegen (Wüste: Skarabäen nicht, 1S8-10).
- Hook `target` ersetzt das Ziel ganz (Boxengasse, Eissee, Doppelregenbogen).
- Gas = `c.skill` (`aiSkill`, je Stufe `DIFFS.skill`), Gummiband (`ahead`/`slow`, `behind`/`catchUp`), Blankeis/Plattform weniger in Kurven, Hook `throttle`.
- Festgefahren: tatsächliche Bewegung im letzten Schritt (`c.lx`/`c.ly`) oder Tempo unter 12 px/s länger als 1,2 s → 0,9 s rückwärts (nicht während eines Boxenstopps, `c.boxT`). Die Bewegung zählt, weil ein Auto, das gegen eine Leitplanke drückt, etwas Tempo behält.
- Boxengasse (Rennstrecke, `ringPitTarget`): dreckige Computerautos (ab 0,5) entscheiden 8 bis 70 Indizes vor der Einfahrt, bis zu sechs zugleich; über 80 px/s rollen sie erst aus (`ringThrottle`), Wartende in der Gasse zählen nicht als festgefahren, mit Wartenden hält ein Computerauto 0,6 s. Das Ziel der Gasse endet hinter ihrem letzten freien Punkt (`pit.k1`), danach übernimmt die Mittellinie (sonst fuhr ein abgedrängtes Auto zurück zum Ende der Gasse, 1S7-5).

## 9. Fortschritt, Runden, Platzierung

- `updateProgress` (`physics.js`): nächster Mittellinien-Index im Fenster ±40 (bei > 70 px Abstand alles; dann kann der Hook `progress(c, best)` den Index korrigieren, wenn Teile der Mittellinie nah beieinander liegen: Wüste, Feld gegen Pyramide), `c.off` = Abstand. 4 Checkpoints je Viertel; Runde zählt, wenn Checkpoint 0 nach den anderen erreicht wird. Ziel nach `LAPS = 3`, `finishRace` (`race.js`).
- Platz: `rank.js` `score = (lap − 1)·N + idx`. Startaufstellung: `startRace`, Reihen 22 px Abstand, ±13 seitlich, ab 12 Indizes vor der Linie.
- Gelber Pfeil zurück zur Straße, wenn `off > HALF + 20` (nicht auf Steinen, Zweitweg, Boxengasse, im Flug).

## 10. Ereignisse (`events.js`, `undo.js`)

- An/aus: `eventOn(key) = G.fx && PREFS.events[key] !== false` (`undo.js`). `G.fx` je Rennen: Grand Prix ab MITTEL, sonst Schalter `PREFS.selFx`, Kindermodus nie (`diff.js` `fxActive`).
- Start: `setupEvents(T)` legt `T.ev = { t, cows, holes, rain, flood, pier, kois, kipper }` an, ruft Hook `init` und je Name in `def.events` `INIT[name]` (eigene Ereignisse der Sonderstrecken über `TRACK_EVENTS`).
- Lauf: `updateEvents` → `T.ev.t += dt`, Hook `update`, Kühe, Regen, Kois, Kipper, Reifen, Flut. Zeitlich nur von `T.ev.t` abhängig halten (Zeitfahren, Geist).
- Karte ändern im Rennen: Bild und `ter` werden mit Sicherung in `T.undo` übermalt (`undo.js`); `resetTrackEvents` stellt beim Wechsel ins Menü alles zurück.
- Dev-Server: `checkSpots` meldet Ereignisorte, die nach einer Kursänderung nicht mehr passen.

## 11. Zeichnen (`draw.js` `drawRace`)

Reihenfolge: `base` → Reifenspuren `tctx` → Wasserglitzern → Strand → Tiere → `drawEventsGround` → Hook `drawGround` → Geist → Autos am Boden (nach `y` sortiert; Ring-Brücke oder Hook `deck` (Bett des Spielzimmers) zwischen den Autos unten und denen mit `lvl` 1) → Zug → Autos in der Luft (`z > 0`, über dem Zug, 1S4-9; ein Hook `airTop(c)` kann sie hinter `top` verschieben, EIS: über die Baumkronen) → Partikel, Rauch → `top` (Baumkronen, Geländer) → Bahnübergänge (je ein Warnlicht, `cr.lx/ly` aus `buildTrack`) → Windmühle, Vögel → Zurück-Pfeil → `drawEventsAbove` → Hook `drawAbove` → Nacht → Regen → Hook `drawSky` → Stimmung (ohne Sonnenstrahlen, solange der Hook `noBeams` true gibt) → 1P-Schild → HUD → Countdown/Ziel. Auto: `drawCar` (Hook `drawCar`, `drawFall`), Schmutzstufe `round(dirt·5)`.

## 12. Zustand, Menüs, Speichern, Ton

- `g.js`: `G` (Rennen), `UI` (Menüs), `PREFS` (Auswahl). Speichern nur über `save.js` (`getItem`/`setItem`, Präfix `mudracer-`); Rekorde `timetrial.js`, Cups und Pokale `cups.js`, Lackierung `cars.js`.
- Menüs: `menus.js` (Tasten, Klicks, Optionen, Pause), `screens.js`, `carselect.js`, `cupselect.js`, `raceopts.js` (`FX_NAMES`), `custom.js`, `shop.js`. Grand Prix: `race.js` `startGP`, Punkte `rank.js` `POINTS`.
- Ton: `audio.js` (`SFX`, Hupen, Motor), Musik `music.js` (`SONGS`, `swap` wechselt das Lied z. B. in der letzten Runde).
- Matschfahrt: eigene Welt `run.js` (`G.T.run`, nach oben, Ziel `finishY`).

## 13. Schnell finden

```bash
grep -n "name: 'GARTEN'" -A20 src/tracks.js          # Streckeneintrag
grep -n "case 5\|=== 5" src/*.js                      # wer tiefes Wasser behandelt
grep -n "decor === 'garten'" src/tracks.js            # Deko einer Strecke
grep -n "<feld>" src/_template.js src/hooks.js        # Hook-Signaturen
grep -rn "c\.<feld>\b" src | head                     # wer ein Autofeld setzt/liest
```

Im Dev-Server: `mudracer.G.T` (aktuelle Strecke), `mudracer.G.cars`, `mudracer.tracks.TRACKS`, `mudracer.frameAt(now)`, `mudracer.check('NAME')`.

## 14. Wüste Rev 3 in Kürze (Beispiel für eine Strecke ohne durchgehende Straße)

- **Feld ohne Straße:** Die Mittellinie läuft durch das Feld (Fortschritt, KI), aber ihr Straßenstreifen wird zu Rallysand 60 (desertTerrain, iA/iB = Indexbereich des Feldes). Das ganze Feld ist T.alt (kein Zurück-Pfeil, c.safe zählt). KI: Hook lane fährt dort dreimal so breit, meidet Weichsand (Code 0, nur Autos mit mud < 1,15 je nach Stufe) und für alle Treibsand (10, 61); Hook 	arget schickt dreckige Autos zu Oasen und in die Waschbucht.
- **Pyramide:** Fußabdruck def.pyramid ist fest (walls entlang jeder Straßenkante innen, Dach als eigenes Bild), die Straße ist hineingeschnitten. Gabelungen: das Stück der Mittellinie zwischen rom und 	o wird Wand, die zwei Zweige sind Nebenwege (stampLine, lt); die KI wählt den Zweig im Hook 	arget und folgt dessen Punkten. Säulen (`pillars`) im sicheren Zweig: der Zweig weitet sich weich, die Säule ist Nicht-Straße (Wand) und steht in `T.ev.obst`. Schacht = Code 11 über die Zweigbreite, Sprung { land } mit dem Rückkehrindex hinter der Gabelung; im Hook ground fällt das Auto mit allCar 'abyss'. Der Hook progress hält Autos im Feld vom Pyramiden-Index fern.
- **Dunkelheit:** drawDark setzt je Frame eine Lichtkarte in Bildschirmgröße zusammen (Dunkel über der Pyramide, das Glimmen des Bodens und der stockdunkle Zweig aus zwei vorgerechneten Karten in Pyramidengröße, Fackeln und Autolampen als einmal erzeugte Sprites). Nur wenn der Spieler innen ist (T.desert.inside), sonst wird das Dach gezeichnet.
- **Ereignis sandsturm:** T.ev.dsStorm (ab dem ersten Auto, das in Runde 1 aus der Pyramide kommt: `T.ev.dsIn`, `T.ev.dsOut`; der Treibsand öffnet 6 bis 9,6 s danach), T.ev.dsQuick (Treibsand-Felder: 0 fest, 1 Warnung = Code 61 und dunkles Bild, 2 offen = Code 10 mit sinkInSand); Bild und 	er werden vorher mit snap gesichert (nur über das Feld). Der Sturm ist rein optisch (Nebelkarte, Licht an allen Autos). Schalter sandsturm schaltet beides ab. Die Treibsand-Felder liegen auf der Linie (`def.quick`, Versatz nahe 0).
- **Sprünge im Feld:** Dünen sind nur `DUNE` = 55 px zu jeder Seite der Linie breit (man kann vorbei), jede Landung im Feld gibt 0,4 s Schub, es gibt keinen Dreher nach der Landung (1S8-12). Weichsand liegt nie direkt hinter einem Dünenkamm. Palmen stehen nur auf der Rückseite der Oasen.
- Dateien: desertmap.js (Gelände und Bild), desert.js (Laufzeit und Hooks).

## 15. Eis Rev 2 in Kürze (hochkante Karte 1000 × 1500, Lift, Wald, See)

- **Dateien:** `icemap.js` (`iceTerrain`: See, Wald-Feld mit Pinienverteilung und Tiefschnee, Lift, Fön-Spur, Bobbahn, Sprung, Schübe; `paintMountains`: das Gebirge; `paintIce`: Boden, Zaun, Lift-Masten und Stationen, Fön, Pinien, Dorf, Berghütte, Gipfelkreuz), `ice.js` (Laufzeit: Lift, Schach, Schneeball, Eisbruch, Tiere, Skifahrer, Yeti, Schneeballschlacht, Lichterkette, Polarlicht, KI-Hooks). `def`-Felder: `lift`, `chess`, `bob`, `jump`, `slopes`, `field` (Polygon), `deep`, `eight`, `bay`, `fence`, `blocks` (`[x0, y0, x1, y1, Rundung]`), `ridges` (sechster Wert 1 = Klippe: langer Schatten), `klippen`, `balls` (`x0`, `x1`, `y0`, `y1`, `hops`), `lake` (`[x, y, rx, ry, r nach Norden, y-Grenze oben]`), `animals`, `village`, `summit`, `pines`, `hut` (`[x, y, x, y der Tanne]`), `skiers`, `yeti`, `snowfight`.
- **Gebirge (`paintMountains`):** jede Form (Massiv, Grat, Klippe) hat einen Abstand mit Vorzeichen; alle werden mit einem glatten Minimum (k = 12) zu einem Feld verschmolzen, dazu Rauschen (an dünnen Graten höchstens 40 % der halben Breite). Fels ist, wo das Feld < 0 ist, nie auf Straße und Randwall (`dist ≥ HALF + 2`, an der Bobbahn `HALF + 8`), nie auf See oder Lift. Die Farbe kommt aus der Hangrichtung (Gradient, Licht von Nordwesten) und der Tiefe (Felsband am Rand, nach Süden breiter; Schnee oben). Die festen Kreise (r = 4, ≥ 4,5 px Abstand) liegen 2 bis 5 px innen am gezeichneten Umriss. Kostet etwa 0,3 s Bauzeit.
- **Abkürzungen zu:** Zaun x = 172, Massive an Rand und Bobbahn, Grate (Felswand y = 415, Waldrand, Felskuppe in der Kehre am Waldende (statt Trichter), Wand vor dem See, Bergauf-Ostgrat), Klippen zwischen den Serpentinen (r = 20, an einem Ende am Grat). Weil das Rauschen den Umriss verschiebt, nach jeder Änderung `check('EIS')` (Abkürzungen) laufen lassen.
- **Lift:** Hook `ground` hängt das Auto ein (`c.iceLift`, nicht `c.lift` – das ist die Höhe auf dem Regenbogen-Bogen fürs Zeichnen in `draw.js`; der Sessellift des Regenbogens heißt `c.rbLift`), Hook `stuck` fährt es mit 190 px/s (kein Physik-Schritt, `c.ghost` hält Auto-Kollisionen aus, `c.idx` aus y), `drawCar` zeichnet Sessel und Schatten, `noRespawn` sperrt Code 70.
- **Wald:** Bäume in `T.ice.trees` (Kreise mit `ground: true` bis y 800: wer in der Luft ist, ignoriert sie, `update.js`), Kronen im `top`-Bild, `airTop` zeichnet Autos mit z > 22 darüber. `T.ev.obst` enthält nur Bäume nahe KI-Autos und rollende Schneebälle.
- **Fön:** wie die Wüsten-Waschbucht: Spur (`stampLine`, `alt`), Waschboden `washMask`, Hook `target` (`foenTarget`) nur dreckig, Hook `throttle` .6.
- **Schneeball:** `T.ev.iceBalls`, Zähler läuft nur mit einem Auto im Index-Bereich `T.ice.serp`; x zufällig (aus `hash`, also wiederholbar) zwischen `balls.x0` und `x1`; die Pause wird mit der Runde des Führenden kürzer und es kommen mehr zugleich (`BALL.lapK`, `BALL.lapMax`); Ankündigung: Rieseln, Grollen, Warndreieck (`warnSign`) am oberen Bildrand über der Stelle, kein Text; Treffer `c.snowT`, `iceStuck` (Hook `stuck`).
- **Eisbruch:** `T.ev.iceLake` = Zellen (16 px, `T.ice.lakeD` = Abstand zum Ufer, Rand `RIM` = 28 bricht nie), `breakN()` Überfahrten je Autozahl, `safeCells`/`wayAcross` halten einen sicheren Weg quer offen, `lakeRespawn` (Hook `respawn`) setzt hinter dem Loch ab und dreht das Auto zur Route, `lakeRoute`/`lakeTarget` (Hook `target`) lassen die KI über die Zellen fahren (Dijkstra, Wegpunkt nur, wenn die Gerade frei von Löchern ist). Nicht über feste Spuren planen: Eis lenkt langsam, ein Auto, das zum falschen Punkt zeigt, fällt endlos in dasselbe Loch.
- **Hook `progress`:** sucht ±200 Indizes um `c.idx` (Wald neben Bergauf, Serpentinen-Schenkel).
- **Prüfung:** `mudracer.check('EIS', { diff, fx, cars })`; für Bilder im Rennen die Rennschleife anhalten (`window.requestAnimationFrame = () => 0`), Auto versetzen, `update` laufen lassen und `drawRace(1)` rufen (vorher `ctx.setTransform(1, 0, 0, 1, 0, 0)`, sonst summiert sich die Verschiebung und das Bild bleibt leer).

## 16. Vulkan Rev 6 in Kürze (Karte 1700 × 1100, Südseite des Bergs: Gerade, Serpentinen, Stahlbrücke, Rinnen-Labyrinth)

**Rev 6 (plaene/VULKAN_REV6.md) ändert gegenüber dem Text darunter:**
- **Ströme:** nur noch der Kraterabfluss und der Hauptstrom (`flows`, `pools` leer).
- **Labyrinth ohne Fläche `area`:** Die Rinnen laufen den Hang hinunter, vier Stränge, wenige Querverbindungen, unten Sammelrinne Y–Z.
  - Jede Rinne bekommt Felsufer (Code 80, 12–18 px, Abstandsfeld in `volcanoTerrain`).
  - Der eingeschlossene Hang zwischen den Ufern ist ebenfalls Code 80 (`islandM`, Flutfüllung vom Rand der Box), wird aber als Hang gemalt.
  - Die Mittellinie im Labyrinth wird nur dort Straße, wo eine Rinne ist.
- **Tore `gates` `[x, y, Knoten, von?]`:**
  - mit `von` der Überlauf des Fächers am Westende der Brücke (Rinne aus Fels `conM` vom Fächer zum Tor);
  - ohne `von` eine Spalte im Hang, gezeichnet als glühender Riss, die vor ihrer Zunge dampft.
- **Ampeln:** über jeder Rinnenmündung unter A hängt eine Ampel (`drawLamps`, Stellen `lampSpots` 85 px unter A): grün, wenn von dort ein Weg ohne gesperrte Knoten (`blockedNodes`) zu Z führt, rot blinkend sonst; neu berechnet bei jedem Wechsel der Zungen (`ev.vlMzVer`). Nur mit Ereignis `lavastrom`.
- **KI:** `routeHere` plant von der Rinne, in der das Auto steht (nächste Kante, besseres Ende), nie quer durch den Fels zum nur scheinbar nächsten Knoten. Außerhalb des Labyrinths und weiter als 40 px von A übernimmt die Mittellinie.
- **Fortschritt:** nach `rowIdx` nur oberhalb der Sammelrinne (`Y` − 18).
- **Gefälle:** In den Rinnen `DOWNHILL` 34 px/s² längs des Autos, je nachdem, wie weit es hangabwärts zeigt (weg vom Kegel), nie seitlich. Die Serpentinen behalten den Schub −30.
- **Am Hang erdig:** Code 0 (`EARTH`); Lava lässt den Dreck.
- **Oben:**
  - leichter Dunst und Asche im Wind je nach Höhe des Spielers (`drawSky`, `V.cone`);
  - eine hohe Rauchfahne über dem Krater;
  - längere Schatten unter den Stützmauern.
- **Brückenlöcher:** eine Reihe offener Platten als ein Loch; am Rand ist der Träger aufgerissen (`drawHoleGaps`).

- **Dateien:** `volcanomap.js` (`volcanoTerrain`: Kratersee `lakeM`, Lava unter der Brücke `fan` (`fanM`; Straße darüber = `bridgeM`), Ströme aus Kreisketten `flows` (`stampChain`; `bridge: true` = kurze Stahlbrücke auf der Geraden), Lavatümpel `pools`; Labyrinth `maze`: Fläche `area` (Polygon mit verrauschtem Rand außer im Osten und bei Z) wird Fels 80, Rinnen (`mazeGraph`: Knoten, Kanten mit leichtem Bogen, `gw` halbe Breite, Knoten `nr`) werden Straße und `alt`, die Hauptstraße vor und hinter dem Labyrinth bleibt Straße (`inMaze` über die Indizes A bis Z); Lavarinnen `conM` von den Toren `gates` zu den Knoten; Zungen `tongues` (Pixel der Rinnen nach Punkt der Kette sortiert: `J`, `K`, `U`, `old`); `rowIdx` = Index der Mittellinie je Zeile (Fortschritt im Labyrinth nach der Höhe); Brücken: `spans` über `bridgeM`, `decks` (Spannen ± 14 bzw. 8 Punkte, `deckM`), `deckBig`, Löcher `holes` (Platte 20 × 20 px, Spalte −1/0/1, Pixel `J`, Ecken `P`, Mitte `c`); Waschbucht `bay`; `paintVolcano`: Abstand zur Lava `ld` (Glutsaum), Tiefe in der Lava `lin` (Kruste am Ufer), Tiefe im Fels `rd` (Kanten, feste Kreise 6 px innen), Höhe und Licht `hillShade` (Farbe nach Höhe: Wiese, trockenes Gras, Schotter, Asche), alte Lavaströme `old`, Kratersee aus Zellen, Fächer als Kruste mit glühenden Fugen außer längs der Achse Krater–Hauptstrom, Asphalt der Geraden (`straight`), Stahldeck, Stützmauern `dryWall` ('d') und Felsrippen `rockRidge` ('r') aus `walls`, Hanganschnitt der Serpentinen, Leitplanke, Fachwerkträger, Warnschilder, Hornitos `spatter`, Bilder der Zungen (`lava`, `crust`), Feuerwehr, Basecamp `camp`, Kulisse), `volcano.js` (Laufzeit). Theme `goo2: 'foam'` (weißer Löschschaum, `cars.js` `FOAM`).
- **Abkürzungen zu:** Kraterrand fest, Lava (Fächer bis an den Kraterrand, Ströme, Tümpel), Leitplanke an der Nordseite der Geraden, Stützmauern zwischen allen Serpentinen-Schenkeln bis zum Kartenrand, Felsrippen westlich der Kehren bis an den Fächer, Fels des Labyrinths (fest an jeder Kante, auch zur Straße hin), Fachwerkträger der Brücken.
- **KI:** Hook `target` = `volcanoTarget`: dreckig in die Feuerwehrbucht, sonst im Labyrinth `mazeTarget` (`c.vMz`: Dijkstra `mazeRoute` von `at` nach Z über freie Knoten, Kantenlänge je Auto um bis zu 45 % verzerrt, damit sie sich verteilen; neu planen an jedem Knoten und wenn sich die Lava ändert (`T.ev.vlMzVer`); ohne freien Weg am Knoten warten). `lane`: auf der Brücke die heile Spalte der nächsten Lochreihe (×22 px; jedes Loch wird zu 86 / 93 / 98 % gesehen, nach jedem Sturz neu gewürfelt, `c.vHoleN`), auf den Serpentinen weg von Schatten und Feuern (35 / 55 / 75 %). `throttle`: Bucht .6, Labyrinth .8, Brücke mit Löchern .62 / .72 / .82, vor Kehren weniger. `progress`: im Labyrinth (Boden 80 oder Rinne) nach `rowIdx`, sonst ±200 Indizes.
- **Ereignis `lavastrom` (Lavazungen):** `T.ev.vlTongues[q]`: beim Rundenwechsel (deine Runde, `lapNow`) laufen die Zungen aus `maze.laps[Runde − 1]` an (`pre` `LAVA.pre` 1,5 s: Tor spuckt und glüht, `T.ev.vlAlarm` für den Paukenwirbel → `flow` mit `LAVA.v` 105 px/s, jedes Pixel bis zur Front Code 15 → `full`), die übrigen kühlen ab (`cool`: alter Boden zurück, Kruste blendet in 3 s aus). Gesperrt für die KI sind die Knoten der Zungen ab `pre` (`blockedNodes`). Jede Kombination in `laps` muss einen Weg von A nach Z lassen: `mazeOpen(T, blockiert)` (exportiert, zum Prüfen). Zurücksetzen nach einem Sturz im Labyrinth: Hook `respawn` setzt auf den nächsten freien Knoten oberhalb der Sturzstelle, Blick zum Weg nach unten.
- **Ereignis `brueckenloch`:** `T.ev.vlHoles[q]`: ab deiner Runde `lap` des Lochs `warn` (nacheinander alle `HOLE.stagger` 0,6 s; 1,3 s rot, Funken, Knarzen, Warnschilder blinken; die Platte hält, solange ein Auto auf ihr steht) → `open` (Code 15 auf `J`, `snap` vorher). Sturz: der Kern macht einen Lavasturz, `updateRescue` macht daraus `fallKind 'bridge'` (3,4 s; Rauch weg, `drawFall`: Purzeln 0,85 s, Spritzer, ab 1,3 s Hubschrauber mit dem Auto am Seil), Rückkehr 24 Punkte vor der Lochreihe in der heilen Spalte (`c.vHeliI`, `c.vHeliO`), danach fliegt der Hubschrauber davon (`c.vHeliOut`).
- **Ereignis `ausbruch`:** Feuerbälle `T.ev.vlBalls` ab 9 s, Abstand `BALL.per` je Runde des Spielers, nur auf den Serpentinen (`okIdx` = `serp`); Ziel: wo ein Auto (45 % deins) nach 1,6 s auf der Mittellinie ist, ±17 px. Schatten wächst (Hook `drawGround`), Ball fällt aus Richtung Krater (`drawAbove`). Einschlag: 90 px/s weg, `ignite`; Feuer `T.ev.vlFires` 3 s. Brand `c.vFire` (Physik .85), ab 1,4 s `c.vExt` (Fahrer mit Feuerlöscher), nach 2,5 s Schaum: Dreck mindestens `FIRE.foam` .42, +.15, höchstens `FIRE.most` .62 (dreckigere bleiben), `c.cem = true` (zweiter Satz = Schaum; Lava und sauber setzen ihn zurück). Ab Runde 2 des Spielers (`T.ev.vlLate`) roter Himmel, Aschenregen, Rauchsäule, Hubschrauber.
- **Lied `volcano`:** Schichten über `raceLap()` (ab Runde 2 Doublebass und Chor, letzte Runde Blech mit der Melodie), keine Tempoänderung; Paukenwirbel, solange `T.ev.vlAlarm` (eine Zunge in deiner Nähe kündigt sich an oder eine Brückenplatte wackelt).
- **Prüfen:** `mudracer.check('VULKAN', { diff, fx, cars })`; die Lochreihen der Brücke brauchen gut 60 Punkte Abstand, sonst schafft die KI den Seitenwechsel nicht.

## 17. Dschungel Rev 2 in Kürze (Karte 1700 × 1150, Flusstal; Plan `plaene/DSCHUNGEL_REV2.md`)

- **Dateien:** `junglemap.js` (`jungleTerrain`: Fluss `river` Zeile für Zeile aus der Kette `def.river` (Mitte und halbe Breite je y), Schlucht (Code 11 auf und neben der Straße bis `gorge.y + 130`, Baumstamm `logM`), Furt (Code 91, Rand `fordE` verrauscht, die Straße selbst immer Furt, Kiesbänke Code 1), Tafelberg (`cliff`), Sumpf-Senken `swamp`, tiefer Sumpf `quick` (Code 10), Bohlenweg `boards` (Code 92), Trampelpfad `trail` (Code 1, `alt`), Unterholz `field` (Code 90, `alt`: Abstand zur Mittellinie zwischen `from` und `to`, Wand = glattes Minimum aus Außenrand, Würgefeigen-Inseln (Poisson) und Wurzelwänden `ridges` in jeder Kehre, feste Kreise mit `edgeCircles`), Tempel (`temple.rect`: Boden = Straße, Grotte, Halle; alles andere Wand mit `edgeCircles`; Säulenreihe zwischen Kugelgang und Grotte), Ruinenmauern `ruins`, Treppe (Schub `stairs`), Becken `basin`; `stampWay` = schneller `stampLine` mit Abstandspuffer; `paintJungle`: Bodenbild (Code 0 malt der Kern in den Farben des Themes), Tempeldach als eigenes Bild (Stufenpyramide), Laubdach als eigenes Bild (nicht über dem Pfad), Wegweiser, Lager, Steinköpfe, Farne, Mangroven, Bäume des Ereignisses, Wurzeln quer in der Rinne), `jungle.js` (Laufzeit und Hooks).
- **Gabelungen:** die Mittellinie ist immer der kurze Weg (Sumpfrinne durchs Unterholz, Kugelgang); Bohlenweg, Trampelpfad und Wasserfallgrotte sind Nebenwege. KI im Hook `target` (`c.jgWay`, Punkte des Wegs, wie die Wüste): Bohlenweg für Autos mit `mud < 1.15` (LEICHT fast alle), Pfad für die schlechten im Matsch und die meisten auf LEICHT, Grotte nur dreckig (`.4 / .55 / .7`), auf LEICHT auch, wenn die Kugel gleich rollt; `throttle` .62 in der Grotte, ≤ .7 am Stamm, auf LEICHT im Unterholz × .88.
- **Liane:** Sprung `jumps[0]` an der Ostkante der Schlucht nach Westen, an (`off: false`), solange sie auf der Ostseite hängt (`sin(t / 6 · 2π) ≥ .55`), Rückkehrpunkt `land` hinter der Schlucht; ihr Schatten liegt auf der Straße. KI: `lane` rechnet die Ankunftszeit voraus und fährt in die Lianenspur oder auf den Stamm. Wer in die Schlucht fällt (Hook `ground`, Code 11), treibt im Fluss (`drawFall`) und kommt hinter der Schlucht zurück (`J.iLand`).
- **Laubdach und Tempel:** `J.under` (Spieler unter dem Laubdach): Loch um das eigene Auto (`destination-out`), Glühwürmchen; `J.inTemple`: statt des Dachs die Lichtkarte `darkRect` (`kit.js`) mit Fackeln, Autolampen und dem Lichtschacht über der Grotte; Hook `noBeams` schaltet die Sonnenstrahlen des Themes aus. Die Grotte wäscht über `washMask`.
- **Ereignis `baeume`:** `T.ev.jgTrees` (sechs, `def.trees` `[x, y, Seite, 'c' Straße / 'p' Pfad]`), Reihenfolge aus `hash`, Abstand nach der Runde des Führenden (`TREE.gap` 18–24 / 12–16 / 8–12 s); Knarren 1,8 s (Blätter, Schatten, Warndreieck `warnAt`), Fall .6 s (Treffer: weggeschleudert), danach `T.ev.jgLogs` und ein Sprung (Schanze); langsam: `crossBar` bremst auf 35 %.
- **Ereignis `kroko`:** `T.ev.jgCrocs`: 0 Stamm, 1 Augen und Blasen (1 s), 2 Maul öffnet sich (.45 s), 3 Schnapp: `stun` 1,2 s, Dreher, 60 px/s; ab Runde 2 des Führenden `T.ev.jgSwim` quer durch die Furt (schiebt, in `T.ev.obst`).
- **Ereignis `steinkugel`:** ab Runde 2 des auslösenden Autos, wenn es im Kugelgang in die Halle kommt (`J.iHall`); `T.ev.jgBalls` rollt 112 px/s die Mittellinie entlang bis zum Ende der Treppe, dann ins Becken (Fontäne); `c.flatT` 1,2 s (Hook `stuck`, `draw.js` zeichnet platt); nach 15 s wieder oben (`T.ev.jgReady`, Kugel am Seil in der Halle); letzte Runde zwei Kugeln (`T.ev.jgQueue`); `T.ev.jgAlarm` = Paukenwirbel im Lied.
- **Lied `jungle`:** Schichten über `raceLap()`: ab Runde 2 Marimba, Frosch, Vögel, Grillen; letzte Runde Taiko und Gong; im Tempel nur Bass und Trommel.
- **Prüfen:** `mudracer.check('DSCHUNGEL', { diff, fx, cars })`; `checkSpots` prüft Bäume (Straße oder Pfad) und Krokodile (Wasser oder Sumpf). Die Wurzelwände `ridges` müssen aus der Außenwand bis 50 px an die Mittellinie reichen, sonst fährt man das S gerade.

## 18. Weltall Rev 2 in Kürze (Karte 1700 × 1000, der Orbit; Plan `plaene/WELTALL_REV2.md`)

- **Dateien:** `spacemap.js` (`spaceTerrain`: Deck der Station (Code 1, `KD.deck`), Mond (13, Straße 1), Röhre, Plattformen (17); Gabelungen `forks` (die Straße wird zwischen `from` und `to` eine Gitterbrücke mit halber Breite 12, `narrowM`; die breite Plattform ist ein Nebenweg mit `stampWay`, `KD.wide`, `alt`); Ringfeld (Code 100, `ringTest`: zwischen `ring[0]` und der Straße, ab `tangent` Grad ist die Innenkante eine Tangente an den Ring, darum führt jede gerade Ausfahrt auf die Straße; `rroad` = Radius der Straße je Grad); Eisbrocken `chunks` (Poisson, Code 0 innen, Wandkreis); Asteroidenfeld `belt` (Abstand zur Mittellinie mit Puffer, an den Enden schmaler, Rauschen nur am Rand; Asteroiden aus zwei Kreisen mit `smin`, `edgeCircles`; Staub in Senken Code 2); Wurmloch-Plattform; großer Krater (Code 2) mit Umweg `crater.pts`; Bucht `bay` (`KD.bay`); `paintSpace` malt **den ganzen Boden** (der Kern überspringt Strecken mit `th.space`): Nebel aus einem 8-px-Raster, Abstand zum All `vd` als Feld, Planet, Erde, Ring-Reste als blasse Bänder, Hangar (Module, Turm, Roboterarm, Shuttle, Pfeiler an der Linie), Röhre als Bild über den Autos, Kraftfelder (`bob`-Wände) außen an den Kehren, Satellit, Mond-Deko, Bojen am Feldrand, Rampe), `space.js` (Laufzeit und Hooks).
- **Kräfte:** Planet `PULL` (55 · (170 / d)², höchstens 220, bis 300 px), Loch `HOLE` (9000 / d, höchstens 150, nur innerhalb der Reichweite `holeR` 300 / letzte Runde 360, zum Rand hin weich). Wer über Code 0 ist, driftet nach 0,12 s ab (`fallCar 'space'`, Traktorstrahl), nahe dem offenen Loch als Spirale.
- **Swing-by:** `c.spRing` = kleinster Abstand zum Planeten auf dem Ringfeld; beim Verlassen jenseits von 35° Schub `.5 + 1.1·k` s mit `k = (205 − spRing) / 75` (Glitzerspur, Ton nach k).
- **Mondsprung:** Sprung an der Rampe `crater.lip` nach Westen, `vz` 110, `g` 150, `soft`; etwa 1,5 s in der Luft, über den Krater ab rund 110 px/s.
- **KI:** Hook `target` (`c.spWay` = `{ P, k, kind }`, entschieden 2–20 Indizes vor dem Abzweig): `wide` (breite Plattform, LEICHT .85, MITTEL .5, SCHWER .2), `ring` (Linie über das Ringfeld auf Radius 192, auf SCHWER meist 170; LEICHT nie), `bay` (nur dreckig, .4 / .55 / .7), `detour` (unter 100 px/s vor der Rampe); das Wurmloch (`c.warpTry` .1 / .35 / .7, mit offenem Loch nur ab 110 px/s), der Kern übernimmt `c.spWay` als „kein Gaswegnehmen auf 17“. `lane`: auf und 36 Indizes vor einer Gitterbrücke genau mittig (über 118 px/s bremsen), im Feld 2,2-mal breiter, nie an einen Rand oder Fels. `throttle`: Bucht .6, Umweg .75, Ring und vor der Rampe voll, Gitterbrücke .78, vor dem Wurmloch .75. `T.ev.obst`: kreuzende Asteroiden, Eisbrocken und Feld-Asteroiden nahe Computerautos.
- **Ereignis `asteroiden`:** `T.ev.spAsts`, Abstand nach der Runde des Führenden (`AST.gap`), letzte Runde Schwärme von drei; Ziele nur auf `S.astIdx` (keine Station, Röhre, Wurmloch-Nähe, Loch-Umkreis).
- **Ereignis `schwarzesloch`:** `T.ev.spHolePre` ab Runde 2 des Führenden (2,5 s: Sterne verbiegen sich, `SFX.holeWarn`, Sub-Drop im Lied, Warndreieck), dann `T.ev.spHole`; Plattformen im Umkreis der letzten Runde blinken rot (`redPix`).
- **Lied `space`:** Schichten über `raceLap()`, kein `up` und kein `swap` mehr; `M.dive` einmal bei `spHolePre`.
- **Prüfen:** `mudracer.check('WELTALL', { diff, fx, cars })`; die meisten Stürze ins All liegen an den Gitterbrücken und am Anfang der Haarnadel.

## 19. Süß Rev 2 in Kürze (Karte 1500 × 1000, Landschaft um den Schokoberg; Plan `plaene/SUESS_REV2.md`)

- **Dateien:** `suessmap.js` (`suessTerrain`: Schokoberg (Kegel um `def.mountain`, Umriss als Tabelle über den Winkel `Rm`, fest mit `edgeCircles`, Fuß als Hang `KR.slope`, Rinnen der Ströme `KR.rill`, der Fluss im Berg `KR.cascade`), Marshmallows (Code 114, `def.stones`, Lakritzweg `stonePath`, je Stein ein Sprung `soft`), Wald-Feld (Code 110 wie das Unterholz des Dschungels: Abstand zur Mittellinie mit Rauschen, Zuckerstangen-Riegel `ridges` mit `smin`, Hecke `KR.hedge`), Karamellbäche (`def.brooks` = Anteil am Feld; die Quelle liegt auf der schmaleren Seite, Teich knapp hinter der Linie, `clean` = Versatz der sauberen Linie, Trampolin auf der Linie `vz` 118), Moor (Keksweg `KR.cookie` mit Karamell an den Rändern, Krokantspur `KR.spur` als Nebenweg, Krokantinseln `KR.island` fest), Fabrik (`def.factory`: Boden = Straße und Wartungsgang `KR.grate`, Rest Glaswand `KR.fwall`, Bänder Code 113 + `pushes`-Rechtecke, Presse), Bucht (`KR.bay`, `washMask` um die Fontäne), Brause-Pads (Code 4 auf einer Hälfte) mit Kaugummi (112) davor; `paintSuess`: Boden je Art, Schatten nur in Kästen `RT.boxes`, Streusel als Kachel, Fabrikdach als eigenes Bild, Ströme als nach Ankunft sortierte Pixellisten), `suess.js` (Laufzeit und Hooks), `suessmusic.js` (Lied).
- **Kleben:** nur über Codes im Hook `surf`; nach dem Karamell `c.stickT = .35 / mud` (Tempo bis −42 %, blendet aus, Fäden `c.thread`), nach einer geplatzten Blase `c.gumT` .5 s.
- **Presse:** `PRESS` (alle 2,4 s, Warnung .8 s: Schatten, Zischen, gelbe Leisten; unten .3 s): wer im Rechteck ist, `c.flatT` 1 s (Hook `stuck`, `draw.js` zeichnet platt). KI: `pressDanger` rechnet die Durchfahrt voraus, sonst wartet sie (Gas .12, nah davor rückwärts .5); an der Gabel nimmt sie den Wartungsgang auf LEICHT meist und immer, wenn die Presse beim Ankommen unten wäre.
- **KI:** Hook `target` (`c.swWay` = `{ P, k, kind }`, entschieden 2–20 Indizes vor dem Abzweig): `spur` (Autos mit `mud < 1.15`, .85 / .45 / .15), `stones` (0 / .12 / .35), `walk` (.8 / .35 / .1 oder Presse), `bay` (nur dreckig .4 / .55 / .7); `lane`: im Wald 2,2-mal breiter, vor jedem Bach allmählich auf das Trampolin (LEICHT .25, MITTEL .7, SCHWER .9) oder um den Teich (`c.swBrook`), sonst weg von Karamell, Kaugummi, Schokolade und Krokantinseln, vor der Presse mittig; `throttle`: Bucht .6, Gang .85 (auf dem Band gegen die Richtung voll), Marshmallows .82, LEICHT unter Wolken × .85; `progress`: ±260 Indizes um `c.idx`. `T.ev.obst`: wachsende Blasen, Lollis nahe Computerautos. `T.suess.stats` zählt im Dev-Server, wie oft welche Wege, Sprünge, Presse und Stürze vorkamen.
- **Ereignis `schoko`:** `T.ev.swSchoko` ab Runde 2 des Führenden; Strom k: Ankündigung ab `k · 4` s (2 s: Blubbern, `T.ev.swAlarm` = Paukenwirbel, Warndreieck `warnAt` über `st.warn`), dann Front mit 46 px/s, jedes Pixel bis zur Front Code 2 + `chocoM`; auf der Straße nur die Hälfte, von der der Strom kommt. Letzte Runde Streuselregen.
- **Ereignis `zuckerwatte`:** `T.ev.swWatte`, Wolken nur in den Kästen `def.clouds` (Wald, Moor), Zahl nach der Runde des Führenden 3 / 5 / 8; `c.inCloud` für den rosa Schleier.
- **Lied `candy`:** Schichten über die Runde (schmelzender Bass ab Runde 2, G-Dur und Chor in der letzten), Fabrik-Takt solange `T.suess.inFactory`, Paukenwirbel bei `T.ev.swAlarm`.
- **Prüfen:** `mudracer.check('SUESS', { diff, fx, cars })`; das Wald-Feld ist gewollt offen, die Riegel `ridges` müssen bis nah an die Mittellinie reichen, sonst fährt man das S gerade.

## 20. Spielzimmer Rev 2 in Kürze (Karte 1600 × 1000, das ganze Kinderzimmer; Plan `plaene/SPIELZIMMER_REV2.md`)

- **Dateien:** `toymap.js` (`toyTerrain`: Art je Pixel `kind` (`KD`: Boden, Teppich, Bett, Tisch, Rampe, Lineal, Murmelbahn, Treppe, Stadt), `upM` = oben (wer es oben verlässt, fällt), `hM` = Höhe auf Rampe und Treppe, Nebenwege `wayM`/`wayD` (`WAY`: unter dem Bett mit Treppe, Waschbucht, Malkasten-Zweig; je Weg Punkte mit dem Index der Mittellinie, für den sie zählen), `bedT` = Boden-Code der Bettoberfläche; der Boden unter Tischen ist Code 11 (niemand kommt hin, `check` sieht dort keine Abkürzung); `paintToys` malt den ganzen Boden selbst (Theme `ownGround`), die Pixel-Schleifen laufen in normalen Funktionen je Zeilenband (sonst bleibt der erste Bau langsam), das Bett ist ein eigenes Bild `bedImg`), `toys.js` (Laufzeit und Hooks).
- **Ebenen:** `c.lvl` 2 Boden, 1 Bett, 3 Schreibtisch, 4 Murmelbahn. Sie folgt dem Weg (Hook `ground`): Rampe ab halber Höhe → Bett, Treppe oben oder Tisch → Tisch, Kissen-Sprung landet auf dem Tisch → Tisch; ein Auto auf dem Bett, das nicht mehr auf Bett oder Rampe steht, fällt (`fallCar 'abyss'`, `c.tyUnder`) und kommt im Hook `respawn` am nächsten Punkt des Wegs unter dem Bett zurück (Boden, KI folgt dem Weg); vom Tisch zurück auf den Tisch (`c.safe`). `c.h` = Höhe fürs Zeichnen (größer, Schatten weit weg).
- **Bett über dem Weg darunter:** Mittellinie über das Bett, der Weg unter dem Bett liegt im selben Rechteck auf dem Boden (`T.ter` = Boden, das Auto oben liest `bedT`). Hook `deck` zeichnet `bedImg` zwischen den Autos unten und oben (wie die Brücke der Rennstrecke); ist der Spieler selbst unter dem Bett (`S.under`), kein Bild, sondern `darkRect` mit Licht an den offenen Seiten, Lattenrost und Rahmen; die Autos oben sind dann unsichtbar. Sprünge mit `lvl: 1` (Falten, Kissen) gelten nur oben.
- **Fortschritt:** Hook `progress` gibt Autos auf einem Nebenweg den Index ihres Wegpunkts (nicht für Autos oben auf dem Bett).
- **KI:** Hook `target` (`c.tyWay`): unter das Bett LEICHT .75, MITTEL .45, SCHWER .15 und jedes Auto, das für den Kissen-Sprung zu langsam ist (Höchsttempo unter 112); Malkasten-Zweig für Autos mit `mud < 1.15`; Waschbucht nur dreckig (.4 / .55 / .7); ein Auto auf dem Boden weitab der Linie (neben der Rampe, nach einem Sturz) übernimmt den Weg unter dem Bett. `throttle`: vor dem Kissen Vollgas, auf LEICHT bei einem Viertel der Anläufe .62 (fällt unter das Bett), MITTEL selten; Bucht .6, unter dem Bett .9. `lane`: Lineal und Kissen mittig, am Radiergummi vorbei, in der Stadt doppelt so breit, oben weniger Pendeln und Bremsen vor Kurven, vor geschlossenen Schranken warten.
- **Ereignis `saugroboter`:** `T.ev.toyRobot` ab Runde 2 des Spielers; nach `ROBOT.bored` 7 s ohne Fang jagt er das nächste Auto auf dem Boden (`R.prey`, nie unter dem Bett, nie auf Möbeln), Sog und Einsaugen wie bisher, frisst Murmeln, Dominos, Knete (`eatKnete`: `snap`, Boden darunter aus `kneteUnder`, Code 121) und Reifenspuren (`tctx` `destination-out`). Ausweichen der KI nach Stufe (`AI.dodge`).
- **Ereignis `schlafenszeit`:** `T.ev.toyNightOn`; letzte Runde des Spielers: `toyFlick` 1,1 s Flackern, dann `toyDarkOn` (Schleier mit weichen Lichtlöchern: Nachtlicht und Startlinie, Türspalt, Projektor, Scheinwerfer; Sterne des Projektors).
- **Reifenspuren** verblassen hier alle 0,5 s um 3,5 % (`toyUpdate`, 1S14-4).
- **Lied `toys`:** Schichten über `raceLap()` (ab Runde 2 Drone und dichtere Klicks), bei `toyDarkOn` Spieluhr, unter dem Bett (`G.T.toys.under`) gedämpft; kein `swap`, kein Tempowechsel.
- **Prüfen:** `mudracer.check('SPIELZIMMER', { diff, fx, cars })`; Ebenen kennt die Prüfung nicht: der Boden unter den Tischen ist Code 11, damit sie über Tischkanten keine Abkürzungen meldet.

## 21. Regenbogen Rev 2 in Kürze (Karte 1800 × 1000, Ehrenrunde über fünf Münzinseln; Plan `plaene/REGENBOGEN_REV2.md`)

- **Dateien:** `rainbowmap.js` (`rainbowTerrain`: Münzen `coin`, Innenseite der Runde `inside` (Zeilen-Paritätstest) wird Schlucht (48) hinter einer Wolkenbank, Schlucht unter dem Bogen, Schlucht unter dem doppelten Regenbogen; die Pixelschleife steht in `classifyRows` (normale Funktion je 50 Zeilen); Liftspalte `def.crevasse` von der Schlucht bis zum Kartenrand auf der Außenseite, Liftstation (131) davor; Wolkenpfad `def.cloudPath` (130, `stampWay`, Löcher `bites` am Rand); Regen-Bucht `def.bay`, Steg `def.jetty` (nicht `pier`: das ist der Strand im Kern); Pfütze, Teich mit Brücke, Kies und Kerbs, Riss in der Platinmünze `crack` mit der Liane als Sehne `def.liana`, Lavaröhre `def.cone` (Lava 15 neben der Straße innen, Fels mit `edgeCircles`), Wurmloch-Plattform, Gewitterwolken; `paintRainbow`: Boden selbst (Theme `ownGround`), Wolkenmeer aus einem 4-px-Raster `cloudField`, Tiefe der Löcher `holeDepth` (zwei Durchläufe statt Suche je Pixel), Münzen mit Glanzstreifen, Sphinx-Tor über `rot` (jedes Pixel der Box im Rahmen der Straße, keine Lücken), Wolkenzug-Gleis mit Wolkenbank und Warnlicht, Schanze auf einer Fahrbahnhälfte, Lift-Masten, Dach der Lavaröhre als eigenes Bild, Überlagerungen `clean`/`grey` als 128-px-Kacheln nur, wo Farbbahnen sind (`laneTiles`, `drawTiles`)), `rainbow.js` (Laufzeit und Hooks).
- **Seitenwege:** `wayOf` gibt jedem Punkt eines Wegs den Index der Mittellinie, für den er zählt (`ways.cloud`, `ways.bay`, `ways.liana`); Hook `progress` nimmt ihn, auf dem doppelten Regenbogen den anteiligen Index zwischen `dbl.i0` und `dbl.i1` (sonst übersprang man einen Checkpoint).
- **KI:** Hook `target` (`c.rbWay = { P, k, kind }`, entschieden 2–20 Indizes vor dem Abzweig): `cloud` (0 / .25 / .55), `liana` (.15 / .45 / .75 und nur, wenn die Liane bei der Ankunft auf dieser Seite hängt), `bay` (nur dreckig .4 / .55 / .7); vom Weg geschubst zuerst zum nächsten Wegpunkt zurück; Wurmloch (`c.warpTry` .1 / .3 / .5), doppelter Regenbogen ab MITTEL wie bisher. `lane`: rote Seite, vor dem Gleis auf die Schanzenhälfte, wenn der Zug dann da ist, weg von Blitzkreisen. `throttle`: Bogen fast immer voll, Liane voll, Bucht .6.
- **Sessellift:** Hook `ground` hängt auf Code 131 ein (`c.rbLift`), Hook `stuck` fährt das Auto in `LIFTC.t` 1,15 s zur Landestelle `lift.land` (kein Physik-Schritt, `c.ghost`, `c.lift` für die Größe), danach 95 px/s in Fahrtrichtung. Der Boden-Hook kehrt für Autos am Lift sofort zurück (der Kern ruft ihn in der Bodenschleife auch für sie auf; sonst fielen sie durch die Spalte).
- **Liane:** Sprung `jumps[2]` mit `liana: true`, `off`, solange `lianaS(t) = sin(t / 4,4 s · 2π)` nicht über .35 liegt; `soft`, `sfx: 'tarzan'`, `land` = Anfang der Sehne (wer zu kurz springt oder ohne Liane in den Riss fährt, kommt davor zurück).
- **Wolkenzug:** rein zeitgesteuert (`trainAt`: erst 7 s, dann alle 15 s, 2,4 s Warnung mit Pfeife und blinkendem Licht, 240 px/s nach Osten); Treffer nur am Boden (`z ≤ 6`): Schub, Dreher. Die Schanze liegt nur auf der linken Hälfte der Fahrbahn (`lo..hi` −34..−2).
- **Waschen:** nur die Regen-Bucht (`washMask` in ihrer Mitte); sauber heraus = Glitzerspur. Der Gewitterregen macht grau bis höchstens .4 (`STORM.rainDirt`, `rainMax`), wäscht nicht mehr.
- **Ereignisse:** `T.ev`-Felder mit `rb`. `einhorn`: Runde 1 alle 9–13 s, im Gewitter keine, letzte Runde alle 2,2–3,8 s; Hufschlag und Glitzer am Bildrand vorher. `gewitter`: wie im Prototyp, Blitze nie auf Münzen und nie am Bogen; Feuerwerk höchstens 6 Raketen.
- **Lied `rainbow`:** Schichten über `raceLap()` und `ev.rbStorm`/`ev.rbSun`, kein `swap` und kein Tonartwechsel mehr (Gewitter: dunkler Chor eine kleine Terz tiefer, Pauke, Filter zu; letzte Runde: Supersaw, zweites Arpeggio, Chor, Crash); Leitmotiv der Insel (`RB_MOTIF`, `T.rainbow.isle`) auf dem Glockenspiel, solange du auf einer Münze bist.
- **Prüfen:** `mudracer.check('REGENBOGEN', { diff, fx, cars })`; den Bogen und die Liane kennt die Prüfung nicht (Sprünge), die meisten Stürze liegen an der Bogenlücke und am Riss.
