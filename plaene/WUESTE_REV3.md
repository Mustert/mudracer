# WUESTE Rev 3 – Umsetzungsplan

Stand: 2026-10-23, Branch `map_pack`. Eigener Plan für den Komplettumbau der Wüste (Strecke 8, Cup 3). Er steht bewusst nicht in `ROADMAP.md`, damit die nicht zu groß wird; dort bleibt nur der Block `1S8`. Grundlage: Mockup `Obsidian/Mudracer/Screenshots/WUESTE_improvements.jpg` (die Ziffern unten sind die Ziffern im Mockup), Rev 2 in `src/desert.js` und `src/desertmap.js`, Skills `strecke` und `mechanik`, Streckendesign-Grundsätze in `CLAUDE.md`.

**Status je Paket** wird hier gepflegt (Abschnitt „Arbeitspakete“). Erst beim Abschluss (M6) wird `ROADMAP.md` nachgezogen: 1S8 auf den neuen Stand, Tabelle „Strecken im Überblick“, Notiz unter 1S9.

## Ziel in einem Satz

Die Wüste wird zur Wüstenrally: nach der ersten Kurve offenes Wüstengelände bis zu einem Sphinx-Tor, dann eine lange, dunkle Fahrt durch eine große Pyramide mit zwei Gabelungen und Sprüngen über Abgründe; ab Runde 2 tobt draußen ein Sandsturm und der Treibsand öffnet sich.

## Entscheidungen (mit dem Nutzer geklärt, 2026-10-23)

| Frage | Entscheidung |
|---|---|
| Kartengröße | **1600×720** (1,15 Mpx, wie Regenbogen); Mockup leicht gestaucht. Runde Ziel etwa 33–38 s |
| Waschen | **Waschanlage und zwei Oasen waschen voll.** Bewusste Ausnahme von Grundsatz 13 (in `Strecken.md` begründen): die Oasen sind ein echter Umweg, die Waschanlage die letzte Chance vor dem Ziel. Die KI nutzt alle drei nur, wenn sie dreckig ist |
| Gabelungen | **Wie im Mockup:** Gabelung 1 oben Sprung, unten stockdunkel (sicher). Gabelung 2 oben Skarabäen (sicher), unten Sprung |
| Sandsturm | **Rein optisch** (Sicht, Licht an den Autos). „Sturm macht sandig“ und die Verwehungen entfallen. Ereignis ist das Öffnen des Treibsands. Der Schalter `sandsturm` schaltet beides ab |
| Hängebrücke | **Entfällt.** Abgründe gibt es nur noch in der Pyramide |
| EIS | Beim Abschluss Notiz unter 1S9: EIS muss danach mindestens so anspruchsvoll werden (Grundsatz 1) |
| Name, Lied | Name `WUESTE` bleibt, `rev: 3` (neue Rekorde, alte bleiben). Lied `desert` bleibt; optional hallige Variante in der Pyramide über `swap` |

## Grundriss

```
 ┌───────────────────────────────────────────────────────────────────────┐
 │  ╭─ Kurve ──→  OFFENE WÜSTE (Rallysand) ─────────────→ Trichter ⟩ 🦁🦁 ─╮│
 │  │   (2) Weichsand · Dünen(6) · Mauern(7) · Kakteen(8)   (9)    (10)    ││ (11)
 │  │   Schilder → (3) · Treibsand ab R2 (4) · Oase 1 unten, Oase 2 oben (5)││
 │  🏁 Start ═════════ PYRAMIDE: Nordwand / Dach ════════════════ Eingang ▼│
 │  ║ (1)   ╭─ Gabelung 2 ─╮            ╭─ Gabelung 1 ─╮                   ││
 │  ║ Wasch  │ Skarabäen(17)│═══(13)═════│ Sprung (14)  │═══════(13)════════╯│
 │  ╚═(18)═══│ Sprung (14)  │            │ ═Mauer(15)═  │                    │
 │   Ausgang ╰──────────────╯            │ stockdunkel(16)                    │
 └───────────────────────────────────────────────────────────────────────┘
```

Uhrzeigersinn: Start auf der linken Geraden nach oben, Wüste nach rechts, durchs Sphinx-Tor, Kurve nach unten in die Pyramide (Eingang Ostseite), innen von rechts nach links, Ausgang unten links auf die Startgerade, Waschbucht, Ziel.

Grobe Aufteilung der Karte (wird in M1 festgelegt): y 0–400 Wüste, y 400–440 Nordwand der Pyramide (fest, keine Verbindung von der Wüste ins Innere), y 440–720 Inneres. Startgerade links bei x ≈ 70–130.

Rundenzeit-Schätzung: Wüste ~12 s, Tor und Kurve ~4 s, Pyramide ~14 s, Gerade ~3 s.

## Die Elemente

| # | Element | Umsetzung |
|---|---|---|
| 1 | Waschanlage | Seitenbucht an der Startgeraden, nach dem Pyramidenausgang und vor der Ziellinie, durch eine niedrige Mauer von der Fahrbahn getrennt. Wüstenlook: Sandsteinbogen, Palmblattdach, Wasserspeier mit Löwenköpfen, Tonkrüge. Vorhandene `washMask` (wäscht nicht sofort). KI über Hook `target`, nur wenn dreckig. Startaufstellung bleibt frei und gerade |
| 2 | Offene Wüste | **Rallysand, Code 60**: Tempo etwa 0,7 der Straße, Haftung und Lenkung etwas weniger, macht langsam sandig (etwa +0,07/s). Code 0 wird im Feld **Weichsand** (langsamer, schneller sandig) in Feldern als Matsch-Entscheidung (Grundsatz 12). Kein Zurück-Pfeil im Feld (`alt`-Maske). KI fährt breiter (Hook `wander`, etwa 40 px) |
| 3 | Schilder | Pfeil nach rechts, über das Feld verteilt; Deko, flach und blass (Grundsatz 10). Sorgen dafür, dass man nie raten muss (Grundsatz 4) |
| 4 | Treibsand | Erst ab Runde 2 mit dem Sturm. Felder neben der Ideallinie. Ankündigung etwa 3 s vorher: **Code 61** (Vorstufe, harmlos) mit Blubbern, dunkler werdendem Ring, Rieseln und Ton, dann Code 10 (vorhandener Sog `sinkInSand`, Versinken). KI meidet ihn über `desertLane` |
| 5 | Zwei Oasen | Nur flaches Wasser (Code 3), **kein tiefes Wasser** (kein Reinfallen). Waschen voll. Oase 1 unten in der Mitte, deutlich abseits der Ideallinie. Oase 2 oben rechts kurz vor dem Trichter, ebenfalls ein Umweg. Palmen, Matschufer nur außerhalb des Wegs. KI fährt hin, wenn dreckig und die Oase auf ihrem Weg liegt |
| 6 | Dünensprünge | Breite Kämme quer übers Feld (`jumps` mit breitem `lo`/`hi`, unabhängig von der Mittellinie). In der Luft bremst der Sand nicht, dazu kleiner Schub bei der Landung (`c.boost` etwa 0,4 s). Schiefe Landung: Dreher wie bisher (`crookedLanding`) |
| 7 | Sandsteinmauern | Kurze Stücke, feste Hindernisse (Kreise im `grid`), kräftig mit Schatten gezeichnet; zusätzlich in `T.ev.obst`, damit die KI ausweicht |
| 8 | Kakteen | `dsCacti` aus Rev 2 (Stich, „AUTSCH!“), über das Feld verteilt, mit Steinkranz (klar anders als die Deko-Kakteen) |
| 9 | Trichter | Widderallee (Karnak): zwei Reihen Widdersphingen und Obelisken, die zum Tor hin enger werden; fest. Führt alle auf die Straße |
| 10 | Sphinx-Tor | Zwei große Sphinxe (etwa 70×40), die sich ansehen; dazwischen setzt die Straße (Code 1) wieder ein. Fest (Kreise) |
| 11 | Kurve | Straße nach rechts und hinunter zum Pyramideneingang an der Ostseite |
| 12 | Sandsturm | Ab Runde 2 draußen, rein optisch: ockerfarbener Dunst über der Lichtkarte, alle Autos fahren mit Licht (Kegel und Schein). Ziellinie, Startaufstellung und Pyramide bleiben frei (Grundsatz 14, 1A-5). Reifenspuren verwehen |
| 13 | Pyramide innen | Lange Strecke von rechts nach links. Straße aus hellen Steinplatten mit Randsteinen, im Dunkeln klar erkennbar. Fackeln an den Wänden. Dach von innen durchsichtig (wie bisher, aber über die Lichtkarte) |
| 14 | Sprünge über Abgründe | In jeder Gabelung ein Zweig mit Rampe über einen Grabschacht: Code 11, `fallCar 'abyss'` mit Landepunkt (Baustein der Schlucht aus Rev 2) |
| 15 | Mauer | Feste Mauer zwischen den zwei Zweigen einer Gabelung. Zweige als Nebenwege wie in Rev 2 (`stampLine`, `alt`, Hook `target`) |
| 16 | Gabelung 1 | Unterer Zweig stockdunkel: keine Fackeln, Dunkelheit fast deckend, nur Scheinwerfer (auch die der anderen Autos im Bild). Oberer Zweig: Sprung |
| 17 | Gabelung 2 | Oberer Zweig mit blauen Skarabäenschwärmen (`dsBugs`): wandern langsam, bremsen bei der Durchfahrt leicht (etwa ×0,85, kein Dreher), in `T.ev.obst` (Slalom möglich, auch für die KI), Krabbelgeräusch. Unterer Zweig: Sprung |
| 18 | Ausgang | Unten links auf die Startgerade |

Entfällt aus Rev 2: der alte Rundkurs (`poly`), Oasen-Nebenweg, Schlucht mit Hängebrücke (Code 14 auf dieser Strecke), Verwehungen, „Sturm macht sandig“. Bleibt bzw. wird wiederverwendet: Kakteen, Dünensprünge, Treibsand, Schlucht als Abgrund, Fackeln und durchsichtiges Dach, Geier, Kamele, Hitzeflimmern (nur Runde 1, nur über der Straße), Lied.

## Performance (Pflicht, ROADMAP 1P-1)

Bau:
- Ziel: Bau im Hintergrund unter 1 s, gemessen mit `mudracer.perf` und `check`.
- Alle Schleifen über Pixel mit `yield` (wie heute alle 40 000 Pixel).
- Im Bodenbild kein `vnoise` je Pixel, wo es sich vermeiden lässt: Wellen im Feld aus `sin`, `vnoise` nur grob (z. B. jede 4. Zeile/Spalte gerechnet und gehalten).
- Abstandsfeld (`dist`/`near`) wächst nur mit der Länge der Mittellinie, nicht mit der Fläche; das passt.
- Abgedunkelte Straßenmaske der Pyramide einmal beim Bau rechnen (Canvas nur so groß wie die Pyramide).

Laufzeit:
- **Eine Lichtkarte in Sichtgröße** (`VW×VH` = 480×270) für Dunkelheit in der Pyramide und Dunst im Sturm, einmal je Frame zusammengesetzt. Heute wird die Pyramidenmaske in Pyramidengröße jedes Frame neu gezeichnet; bei 1600 px Breite geht das nicht mehr.
- Scheinwerferkegel und Lichtschein als vorgerenderte Sprites, nur gedreht gezeichnet (`destination-out`); keine Verläufe je Frame.
- Treibsand: `snap` nur über die Rechtecke der Felder, nicht mehr über die ganze Karte (heute `snap(T, 0, 0, T.W, T.H)`).
- Reifenspuren verwehen nur im Sichtfeld und höchstens alle 0,25 s, nicht mehr `fillRect` über die ganze Spurenebene in jedem Frame.
- Fackeln, Skarabäen, Kakteen, Sphinxe nur im Sichtfeld zeichnen (`inView`). Höchstens 6 Schwärme à etwa 12 Käfer. Kollisionen nur über Abstandsquadrat und nur in der Nähe.
- `T.ev.obst` klein halten (nur Objekte des Abschnitts, in dem die Autos sind, falls die Liste zu lang wird).
- Kein `getImageData` im Frame.
- Messen: Frame-Zeit im Sturm und in der Pyramide mit 10 Autos, Desktop und Mobilgröße (`resize_window` mobile).

## Technik

- **Boden-Codes:** 60 Rallysand, 61 Treibsand-Vorstufe; Hook `surf`, Eintrag in die Liste über `surfOf` (`physics.js`) und im Skill `mechanik`.
- **`T.ev`-Felder** beginnen mit `ds` (`dsCacti`, `dsBugs`, `dsQuick`, `dsStorm` …).
- **Dateien:** `src/desertmap.js` (Gelände und Bild: Feld, Weichsand, Oasen, Mauern, Trichter, Sphinxe, Pyramide, Gabelungen, Abgründe, Waschbucht), `src/desert.js` (Laufzeit: Lichtkarte, Sturm, Treibsand, Skarabäen, Kakteen, KI-Hooks), `src/tracks.js` (`TRACK_DEFS`: `rev: 3`, `W: 1600`, `H: 720`, neue Felder; `THEMES.wueste`), `src/audio.js` (Krabbeln, Treibsand öffnet sich), optional `src/music.js` (Pyramiden-Variante).
- **KI:**
  - Hook `target`: Oasen und Waschbucht (nur dreckig), Zweige der Gabelungen (Sprung auf SCHWER, sichere Seite auf LEICHT, gemischt auf MITTEL; zu langsam für den Sprung → sichere Seite, wie heute an der Schlucht). Gilt auch im Zustand `finish`.
  - Hook `lane`: Abstand zum Treibsand (auch zur Vorstufe), Mauern.
  - Hook `wander`: breiter im Wüstenfeld.
- **Fortschritt:** Checkpoints nicht in den Gabelungen; beide Zweige nah genug an der Mittellinie, damit `updateProgress` (Fenster ±40) richtig zählt.
- **Prüfung:** `check` meldet im offenen Feld Abkürzungen; die gewollten (Feld ist frei befahrbar) im Bericht begründen. Ebenen kennt die Prüfung nicht (hier keine).

## Arbeitspakete

Jedes Paket ist ein Commit (lint, test, typecheck sauber). Ab M1 ist die Strecke spielbar, `rev: 3` kommt mit M1.

| Paket | Inhalt | Prüfen | Status |
|---|---|---|---|
| M1 Grundriss | Kartengröße, Mittellinie, Startgerade, Pyramidenhülle mit Nordwand, Rallysand-Feld, Eingang und Ausgang, Checkpoints | `check`: Start 0°, keine ungewollten Abkürzungen, 10/10 im Ziel; Bauzeit | offen |
| M2 Wüstenrally | Weichsand, Dünensprünge mit Schub, Sandsteinmauern, Kakteen, Schilder, zwei Oasen, Trichter, Sphinx-Tor, Kurve; KI in der Wüste (`wander`, Oasen) | `check` LEICHT/SCHWER, `checkPic`, ein Screenshot | offen |
| M3 Pyramide innen | Straße, Lichtkarte, Fackeln, Gabelungen mit Mauer, zwei Abgrund-Sprünge, stockdunkler Zweig, Skarabäen; KI-Wahl der Zweige | `check` alle Stufen (Stürze in den Schächten?), Screenshot innen, Frame-Zeit | offen |
| M4 Waschanlage | Seitenbucht im Wüstenlook, KI nur dreckig | `check`, Screenshot | offen |
| M5 Ereignis | Sandsturm optisch mit Licht an allen Autos, Treibsand mit Ankündigung ab Runde 2, Schalter `sandsturm` | `check` mit und ohne `fx`, Ziellinie frei, Frame-Zeit im Sturm | offen |
| M6 Abschluss | Lied (optional Pyramiden-Variante), Feinschliff, Performance messen, `check` LEICHT/MITTEL/SCHWER, Grundsätze 1–14 durchgehen; Doku: `ROADMAP.md` (1S8, Tabelle, Notiz unter 1S9, „Zuletzt abgeglichen“), `Obsidian/Mudracer/Strecken.md` (Abschnitt 8, Ausnahme Grundsatz 13 begründen), Skill `mechanik` (Codes 60/61, Lichtkarte), Skill `strecke` falls nötig | alles | offen |

## Grundsätze-Check (für M6)

1. Steigerung: schwerer als RENNSTRECKE; EIS muss nachziehen (Notiz 1S9).
2. Nichts Unlogisches: Abgründe sind Grabschächte in der Pyramide, Oasen haben Palmen und Ufer, das Feld ist natürlich begrenzt (Kartenrand, Pyramide, Trichter).
3. Weichsand und Treibsand liegen in Senken und an Dünenrändern, nicht als Flecken.
4. Keine Abkürzung durch die Mitte (Pyramidenwand ist fest), Schilder und Trichter zeigen den Weg.
5. Startaufstellung komplett auf der linken Geraden.
6. Mehr als ein Kreis: offenes Feld, Oasen-Umwege, zwei Gabelungen.
7. Ereignis: Treibsand ab Runde 2 (mit Sturm), Schalter `sandsturm`.
8. Eigenes Lied: `desert`.
9. Nicht zu viel auf einmal: Treibsand kündigt sich an; Sturm nicht in der Pyramide; Sprünge und Skarabäen in getrennten Zweigen.
10. Deko-Schilder und Deko-Kakteen blass, Mauern und Hindernis-Kakteen kräftig mit Schatten.
11. Nicht kindgerecht: Abgründe und Dunkelheit sind gewollt.
12. Matsch ist eine Entscheidung: Weichsand-Felder auf der Ideallinie gegen Umweg.
13. Waschen: bewusste Ausnahme (Waschanlage und zwei Oasen), begründen.
14. Ziellinie und Start frei von Sturm und Dunkelheit.
