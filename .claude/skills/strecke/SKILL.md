---
name: strecke
description: Ablauf für eine neue Mudracer-Strecke oder die Überarbeitung einer bestehenden (Karte, Ereignis, Lied, Prüfung, Doku). Laden, sobald eine Strecke gebaut, umgebaut oder geprüft werden soll, auch für einen Prototyp oder ein Rework.
---

# Strecke bauen oder überarbeiten

Gilt für neue Strecken und Überarbeitungen. Die Streckendesign-Grundsätze 1–11 stehen in `CLAUDE.md` und gelten immer. Dieser Skill sagt, **wo** etwas hingehört und **wie** es geprüft wird, damit nichts neu hergeleitet werden muss.

## 1. Lesen, aber gezielt

- `ANALYSE.md`: nur die Zeilen zur Strecke und zu den berührten Themen (`grep -n "NAME\|T21\|T22\|D7" ANALYSE.md`).
- `Obsidian/Mudracer/Strecken.md`: nur den Abschnitt der Strecke (Plan, Wünsche, Ereignis).
- Als Vorlage **eine** ähnliche, neuere Strecke lesen, nicht alle. Spielzimmer (`toymap.js` + `toys.js`) und Regenbogen (`rainbowmap.js` + `rainbow.js`) sind die vollständigsten Beispiele für eine Sonderstrecke.
- `tracks.js` ist groß: nur mit `grep -n` und Zeilenbereichen lesen (`TRACK_DEFS`-Eintrag, `THEMES`-Eintrag, die Stellen in `buildTrack`).
- Ist-Zustand vor einer Überarbeitung: `mudracer.check('NAME')` laufen lassen (Abschnitt 4). Das ersetzt das Durchklicken.

## 2. Festlegen, bevor Code entsteht

| Was | Regel |
|---|---|
| Nummer und Cup | Strecke n gehört in Cup ⌈n/3⌉ (`cups.js` `CUPS`). Schwierigkeit steigt mit n (Grundsatz 1). |
| Kartengröße | Standard 800×450; größer über `W`/`H` im `TRACK_DEFS`-Eintrag. Mehr Fläche heißt längere Bauzeit und Runde (T18, T19, T23). |
| Boden-Codes | 0–17 sind gemeinsame Codes (Straße, Matsch, Wasser, Schlucht, Eis, Lava …, siehe Kommentar in `physics.js` `surfOf` und `trackfx.js`). Eigene Codes in einem eigenen Zehnerblock: belegt sind 30–32 (Spielzimmer) und 41–48 (Regenbogen), also ab 50 (ANALYSE.md T21). |
| Felder in `T.ev` | mit dem Kürzel der Strecke beginnen (z. B. `toyRobot`), nie allgemeine Namen wie `wind`, `storm` oder `msg` (T22; `checkAll` listet, was doppelt ist). |
| Ereignisse | Schlüssel in `def.events`, Schalter in `PREFS.events` (`state.js`), Anzeigename in `FX_NAMES` (`raceopts.js`), Start im Hook `events` der Strecke (`events: { spielzeug: initToyEvents }`, siehe Abschnitt 3). |
| Lied | eigener Schlüssel in `SONGS` (`music.js`), `song` im `TRACK_DEFS`-Eintrag (Grundsatz 8). |
| Überarbeitung | Ändert sich der Kurs, `rev` im `TRACK_DEFS`-Eintrag hochzählen: alte Rekorde bleiben, neue starten frisch (Grundregel „Spielstände bleiben gültig“). Name nie ändern. |

## 3. Wo eine Sonderstrecke eingehängt wird

Neue Dateien: `src/<name>map.js` (Gelände und Bild beim Bau, Generatoren mit `yield`) und `src/<name>.js` (Laufzeit: Ereignisse, Physik-Sonderfälle, Zeichnen). Dazu der Schalter `<flag>: true` im `TRACK_DEFS`-Eintrag; daraus wird `G.T.<flag>` (was `paint*` zurückgibt).

Der Kern fragt nicht mehr nach einzelnen Strecken (`if (G.T.toys) …`), sondern ruft Hooks auf: `trackHooks(G.T).ground?.(c, j, sp, dt)`. Eine neue Strecke wird an genau diesen Stellen eingehängt:

| Datei | Stelle |
|---|---|
| `src/_template.js` | **Vorlage**: alle Hooks mit Signatur und je einer Zeile, wann der Kern sie aufruft (`init`, `events`, `update`, `collisions`, `surf`, `target`, `wander`, `avoidAll`, `lane`, `throttle`, `stuck`, `ground`, `noRespawn`, `respawn`, `drawCar`, `drawFall`, `drawGround`, `drawAbove`, `drawSky`). In `src/<name>.js` am Ende ein Objekt `export const <name>Hooks = { … }` mit nur den Hooks, die die Strecke braucht (Beispiele: Ende von `toys.js`, `rainbow.js`). |
| `hooks.js` | `HOOKS`: Schalter → Hook-Objekt (eine Zeile, plus Import) |
| `tracks.js` | `MAPS`: Schalter, `decor`, `terrain`, `paint` aus `<name>map.js` (eine Zeile, plus Import); dazu `THEMES` (Farben, `goo`, `landCol`) und `TRACK_DEFS` (Eintrag). `paint` gibt den Zustand der Strecke zurück, darin optional `jumps`, `pushes`, `alt` (Bausteine aus `trackfx.js`). |
| `cars.js` / `race.js` | eigener Schmutz-Satz (`goo`, `goo2`: Liste `KINDS` und `newSet`) |
| `audio.js` | eigene Geräusche in `SFX` |
| `music.js` | `SONGS.<lied>` (Wechsel über `swap`, wie Vulkan, Spielzimmer, Regenbogen) |
| `state.js`, `raceopts.js`, `cups.js` | `PREFS.events`, `FX_NAMES`, Cup-Eintrag |

Nicht über Hooks, weil die Streckenmodule sie selbst importieren (Import-Kreis): `trackfx.js` liest Daten aus dem Streckenzustand (`T.desert.landI`, `T.volcano.hot`, `quick`), `music.js` fragt in den Liedern nach `G.T.<flag>`. Braucht eine neue Strecke dort etwas, lieber Daten im Streckenzustand oder im Theme ablegen als eine neue Abfrage.

Hilfen, die es schon gibt (nicht neu schreiben): `core.js` (`hash`, `vnoise`, `rng`, `hex`, `clamp`, `mk`), `bau.js` `nearestIdx`, `trackfx.js` (Sprünge `jumps`, Schübe `pushes`, `fallCar`, Landung), `grid.js` (Hindernisse), `particles.js` (`addP`, `drop`, `splash`, `mudBurst`).

## 4. Prüfen mit dem Prüfskript

Preview starten und stumm schalten (CLAUDE.md), dann im Tab per JavaScript:

```js
mudracer.check('NAME')                  // Bericht als Text: Bau, Grundsätze 4, 5, 7, 8, Boden-Codes, ganzes Rennen
mudracer.check('NAME', { fx: false })   // dasselbe ohne Ereignisse (zeigt, ob ein Problem vom Ereignis kommt)
mudracer.check('NAME', { diff: 0 })     // LEICHT; Standard ist SCHWER (diff 2); { sim: false } ohne Rennen
mudracer.checkPic('NAME')               // ganze Karte mit Befunden über der Seite, dann EIN Screenshot
mudracer.checkAll({ sim: true })        // alle Strecken als Tabelle (~30 s): Steigerung, doppelte Codes und T.ev-Felder
```

Das Rennen läuft am Stück (ca. 1–3 s), alle Autos fährt der Computer, deins mit Vollgas. Danach steht das Spiel im Hauptmenü.

Lesen des Berichts:
- **Startaufstellung**: Drehung der Straße über die 200 px der 5 Reihen; bis 8° gilt als gerade (Grundsatz 5).
- **Abkürzungen**: gerade Linien, die fahrbar sind und unterm Strich (Gras zählt langsamer) Zeit sparen. „Runde zählt JA“ heißt, die Abkürzung funktioniert wirklich (Grundsatz 4). Gewollte Wege (Eissee auf EIS, Wege zur Wahl) bewusst so lassen und im Bericht an den Nutzer nennen. Ebenen (Brücken, Möbel) kennt die Prüfung nicht.
- **Rennen**: Rundenzeiten des Bots; „hängt fest“ und „nur x von 10 im Ziel“ sind Fehler; viele Stürze an einer Stelle (blau im Bild) heißen meist, dass KI oder Rückkehrpunkt dort nicht passen.
- **checkPic**: weiß gestrichelt die Mittellinie, magenta die 4 Checkpoints, grün/rot die Startplätze, rot/orange die Abkürzungen, blau Stürze, gelb Zurücksetzen, rotes X festhängende Autos.

Die Grundsätze 2, 3, 6, 9, 10, 11 prüft kein Skript: einmal das `checkPic`-Bild und ein bis zwei Screenshots im Rennen (`frameAt`) ansehen, nicht mehr.

## 5. Abschluss

1. `npm run lint`, `npm test`, `npm run typecheck`.
2. `mudracer.check('NAME')` ohne Hinweise (oder jeder verbleibende Hinweis ist gewollt und begründet).
3. `ANALYSE.md`: berührte Punkte nachziehen, neue Funde mit nächster freier ID, Abschnitt „…-Prototyp“ mit Größe, Bauzeit, Rundenzeit aus dem Bericht, Zeile „Zuletzt abgeglichen“.
4. `Obsidian/Mudracer/Strecken.md`: Status, Ereignis, Lied der Strecke; Wünsche nur als `✅ umgesetzt (<commit>)` markieren, nie umschreiben.
5. Preview schließen, committen, pushen, dann fragen: „Ist das ein Feature-Abschluss?“
