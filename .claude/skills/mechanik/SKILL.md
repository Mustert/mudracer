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
  3. Kollisionen: Hindernisse aus `T.grid` (`nearObstacles`, Radius `o.r + 9`), Kartenrand (10 px), `eventCollisions` (Kois, Kipper, Reifen, Hook `collisions`, Kühe), Auto gegen Auto (Abstand 18, nicht bei `ghost`/`fall`/anderem `lvl`)
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
| 15 | Lava | – | Fall (`'lava'`), rußig, heiß |
| 16 | Kruste | wie Straße | Lava, wenn `T.volcano.hot` |
| 17 | Plattform Schwerelosigkeit | wenig Haftung | Weltall |
| 30–32, 41–48, 50–52 | Spielzimmer, Regenbogen, Strand-Volleyball | Hook `surf` | eigene Blöcke |
| 60–61 | Wüste Rev 3: Rallysand, Treibsand-Vorstufe | Hook `surf` | siehe Abschnitt 14 |
| 70–71 | Eis Rev 2: 70 Lifttrasse (Straße unter den Seilen), 71 Pulverschnee im Wald | Hook `surf`: 71 `[.9, 6, .9]`, 70 wie Straße | 70: das Auto wird eingehängt (`c.iceLift`), 71: offenes Feld, macht nicht weiß; siehe Abschnitt 15 |

Die Physik liest den Code am Auto-Mittelpunkt (ein Pixel), gesetzt im Boden-Teil von `updateRace` (`c.surf`), also einen Schritt verzögert.

## 4. Wasser, Brücken, Trittsteine (Garten, Dschungel, Süß, Eis)

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

- `c.dirt` 0..1. Steigt in Matsch/Zement (.55/s, langsam unter 8 px/s), Öl (1,36/s), Treibsand (.5/s); Fallen in Sand/Lava setzt 1, Versinken im Wasser 0.
- Wirkung über `def.soil` (`cars.js`, aus `mud` berechnet, 0,04 bis 0,21): Höchsttempo × `(1 − soil·dirt)`, Lenkung schwächer, Stottern beim Gas, Schlingern ab `dirt > .15`. Geländewagen (hohes `mud`) leiden kaum.
- Sauber werden: flaches Wasser (−.7/s), Waschanlage `washMask` (−.35 beim Einfahren, dann −3/s), Duschen `T.showers` (−.12, dann −1,8/s), Schlauch, Sonderstrecken über Hook `ground`. Grundsatz 13: genau eine Art je Strecke.
- Box (Rennstrecke, `ring.js` `ringGround`): wer in der Gasse die Mitte der Box erreicht, steht 1 s (`c.boxT`) und wird dabei sauber; immer nur ein Auto zugleich. Boxenmauer (`def.pit.wall`) und Leitplanke vor den Garagen fassen die Gasse ein, es gibt keinen Weg an der Box vorbei. In der letzten Runde eines Autos (`boxShut`) ist die Einfahrt mit einer Schranke zu (`pit.gate`, Hook `collisions`, nur für dieses Auto fest; gezeichnet, wenn dein Auto in der letzten Runde ist). Computerautos fahren nur dreckig (`dirt ≥ .5`), einzeln und mit Gas ≤ .55 hinein (Hooks `target`, `throttle`).
- Aussehen: je Auto 6 Schmutzstufen (`newSet`, `cars.js`), Farbe aus `th.goo` (Matsch, Sand, Schnee, Asche …), zweiter Satz `Fc` für Zement/`goo2`; `c.cem` sagt, welcher gezeigt wird.

## 6. Physik eines Autos (`physics.js` `physics`)

- Autowerte `CAR_DEFS` (`cars.js`): `speed`, `mud`, `acc`, `turn`, `engine`, `honk`; abgeleitet `soil`. Konstanten `core.js`: `MAXS = 135` px/s, `ACC = 230`, `MUD_A/B`, `LAPS = 3`.
- Höchsttempo `MAXS · speed · Boden · (1 − soil·dirt) · Boost 1,5 · Windschatten · Gefälle (c.slope) · heiß .85`.
- Lenkung zum Zielwinkel `tgt`, max. `4.6 · turn · Bodenlenkung · …` rad/s, bei Stillstand schwächer. Seitliche Geschwindigkeit zerfällt mit `exp(−Haftung·dt)` (wenig Haftung = Rutschen).
- Rollwiderstand `exp(−.25·dt)` mit Gas, `exp(−3·dt)` ohne; Bremse `exp(−6·dt)`; rückwärts höchstens 35 px/s.
- Fliegend (`c.z > 0`): nur geradeaus weiter, keine Lenkung, kein Boden.
- Steuerung: `PREFS.CTRL` `'std'` (oben = Gas, links/rechts lenken) oder `'alt'` (Richtung auf dem Bildschirm), in `updateRace`.

## 7. Fallen, Sprünge, Schübe (`trackfx.js`)

- `c.fall > 0`: Auto ist weg (zählt herunter, dann `respawn`). Arten über `fallCar(c, kind, at)`: `'abyss'` (Schlucht), `'sand'`, `'lava'`, `'space'`, `'cloud'`; Wasser über `sinkCar` (ohne `fallKind`). Gezeichnet über Hook `drawFall`.
- Sprung `{x, y, tx, ty, lo, hi, vz, push, off, land}`: abheben beim Überqueren der Kante vorwärts (≥ 30 px/s), Schwerkraft 380; `land` prüft den Boden (11/15/48 → Fall, 3/5 → Spritzer), schiefe große Landung (über 0,7 s in der Luft) → `stun`.
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

Reihenfolge: `base` → Reifenspuren `tctx` → Wasserglitzern → Strand → Tiere → `drawEventsGround` → Hook `drawGround` → Geist → Autos am Boden (nach `y` sortiert; Ring-Brücke dazwischen) → Zug → Autos in der Luft (`z > 0`, über dem Zug, 1S4-9; ein Hook `airTop(c)` kann sie hinter `top` verschieben, EIS: über die Baumkronen) → Partikel, Rauch → `top` (Baumkronen, Geländer) → Bahnübergänge (je ein Warnlicht, `cr.lx/ly` aus `buildTrack`) → Windmühle, Vögel → Zurück-Pfeil → `drawEventsAbove` → Hook `drawAbove` → Nacht → Regen → Hook `drawSky` → Stimmung → 1P-Schild → HUD → Countdown/Ziel. Auto: `drawCar` (Hook `drawCar`, `drawFall`), Schmutzstufe `round(dirt·5)`.

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

- **Dateien:** `icemap.js` (`iceTerrain`: See, Wald-Feld mit Pinienverteilung und Tiefschnee, Lift, Fön-Spur, Bobbahn, Sprung, Schübe; `paintIce`: Boden, Massive, Grate, Klippen, Zaun, Lift-Masten und Stationen, Fön, Pinien, Dorf), `ice.js` (Laufzeit: Lift, Schach, Schneeball, Eisbruch, Tiere, Polarlicht, KI-Hooks). `def`-Felder: `lift`, `chess`, `bob`, `jump`, `slopes`, `field` (Polygon), `deep`, `eight`, `bay`, `fence`, `blocks`, `ridges` (sechster Wert 1 = Klippen-Stil), `klippen`, `balls`, `lake`, `animals`, `village`.
- **Abkürzungen zu:** Zaun x = 172, Massive an Rand und Bobbahn, Grate (Felswand y = 415, Waldrand, Trichter, Wand vor dem See, Bergauf-Ostgrat), Klippen zwischen den Serpentinen (Kreise r = 20, an einem Ende am Grat). Wandenden dürfen nicht in die Straße ragen (Bogenmitte: Abstand zur Bogenmitte gegen `HALF` rechnen).
- **Lift:** Hook `ground` hängt das Auto ein (`c.iceLift`, nicht `c.lift` – das gehört der Regenbogen-Rampe in `draw.js`), Hook `stuck` fährt es mit 190 px/s (kein Physik-Schritt, `c.ghost` hält Auto-Kollisionen aus, `c.idx` aus y), `drawCar` zeichnet Sessel und Schatten, `noRespawn` sperrt Code 70.
- **Wald:** Bäume in `T.ice.trees` (Kreise mit `ground: true` bis y 800: wer in der Luft ist, ignoriert sie, `update.js`), Kronen im `top`-Bild, `airTop` zeichnet Autos mit z > 22 darüber. `T.ev.obst` enthält nur Bäume nahe KI-Autos und rollende Schneebälle.
- **Fön:** wie die Wüsten-Waschbucht: Spur (`stampLine`, `alt`), Waschboden `washMask`, Hook `target` (`foenTarget`) nur dreckig, Hook `throttle` .6.
- **Schneeball:** `T.ev.iceBalls`, Zähler läuft nur mit einem Auto im Index-Bereich `T.ice.serp`; Treffer `c.snowT`, `iceStuck` (Hook `stuck`).
- **Eisbruch:** `T.ev.iceLake` = Zellen (16 px, `T.ice.lakeD` = Abstand zum Ufer, Rand `RIM` = 28 bricht nie), `breakN()` Überfahrten je Autozahl, `safeCells`/`wayAcross` halten einen sicheren Weg quer offen, `lakeRespawn` (Hook `respawn`) setzt hinter dem Loch ab und dreht das Auto zur Route, `lakeRoute`/`lakeTarget` (Hook `target`) lassen die KI über die Zellen fahren (Dijkstra, Wegpunkt nur, wenn die Gerade frei von Löchern ist). Nicht über feste Spuren planen: Eis lenkt langsam, ein Auto, das zum falschen Punkt zeigt, fällt endlos in dasselbe Loch.
- **Hook `progress`:** sucht ±200 Indizes um `c.idx` (Wald neben Bergauf, Serpentinen-Schenkel).
- **Prüfung:** `mudracer.check('EIS', { diff, fx, cars })`; für Bilder im Rennen die Rennschleife anhalten (`window.requestAnimationFrame = () => 0`), Auto versetzen, `update` laufen lassen und `drawRace(1)` rufen.
