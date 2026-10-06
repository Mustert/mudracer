# Mudracer – Verbesserungsideen

Stand der Analyse: 2026-09-30 (Codebasis: `index.html`, ca. 2300 Zeilen, eine Datei)

## Ist-Zustand

Pixeliger Top-Down-Racer mit:
- 9 spielbaren Autos (4 davon per Grand-Prix-Sieg freischaltbar) plus 7 generische Füllautos
- 5 Strecken: Wiese, Wald, Strand, Zug (mit Bahnübergang) und Regenbogen (Weltraum)
- 3 Modi: Grand Prix (5 Rennen), Einzelstrecke, Matschfahrt
- Matsch, Wasser, Waschanlage, Boost-Pads (nur Regenbogen)
- Eigene Musik pro Strecke, Touch-Steuerung, Mute-Tasten (`M`, `N`)

## 1. Spielgefühl und Tiefe

- **Items / Power-ups:** Matschbombe, Schlammschild, Nitro. Bisher kein aktives Eingreifen in den Wettbewerb.
- **KI mit Charakter:** Aktuell nur eine `skill`-Stufe (0,52–0,66). Eigene Fahrstile pro Auto, z. B. Polizei sauber, Monster rammt, Traktor stur.
- **Drift / Handbremse:** Drift mit Mini-Boost, besonders für Quad und Flitzer.
- **Autos spürbar unterscheiden:** ✅ umgesetzt. Fünf-Sterne-Anzeige (TEMPO/MATSCH) wird aus feinen Werten (`speed`, `mud`, `acc`, `turn`) abgeleitet. Schmutz bremst schlechte Matschfahrer stärker (`soil`). Alle Autos brauchen etwa gleich lang (Streckensumme ca. ±3 %), fühlen sich aber verschieden an.
- **Grundregel: Spielstände bleiben gültig.** `mudracer-car`, `mudracer-unlock` und `mudracer-tt-*` dürfen nie unbrauchbar werden. Änderungen an Fahrwerten bekommen eine Versionsnummer (`BAL`), alte Zeitfahr-Rekorde werden beim Laden umgerechnet (`BAL_OLD`), ohne die gespeicherten Daten zu überschreiben.

## 2. Langzeitmotivation

- **Bestzeiten und Rundenrekorde** pro Strecke und Auto in `localStorage`, dazu ein **Geister-Auto** der Bestrunde.
- **Zeitfahren-Modus:** ✅ umgesetzt (Geist ein-/ausschaltbar, Bestzeit pro Strecke und Auto in `localStorage`, Key `mudracer-tt-<STRECKE>-<auto-id>`; Geist-Option in `mudracer-ghost`).
- **Mehr Freischaltziele:** z. B. Matschfahrt unter X Sekunden, alle Strecken sauber beenden, 3-mal in die Waschanlage.
- **Schwierigkeitsgrad** (Leicht/Normal/Schwer) statt fester Gegnerstärke.

### Werkstatt (Fahrzeuganpassung)

Eigenes Menü, in dem das gewählte Auto angepasst wird. Zwei Varianten, die sich auch kombinieren lassen:

- **Variante A: Upgrades mit Wirkung (freischaltbar)**
  - Motor (Topspeed), Reifen (weniger Matschverlust, z. B. Profilreifen), Getriebe/Beschleunigung, Stoßstange (weniger Stun bei Kollisionen).
  - Währung: Punkte aus Rennen oder Münzen auf der Strecke; Stufen 1–3 pro Teil.
  - Ansatzpunkte im Code: die Werte `speed`, `mud`, `tempo` in `CAR_DEFS` als Basis, Upgrades als Multiplikatoren darauf.
  - Risiko: Balance. Upgrades sollten Stärken verstärken statt Autos gleichzumachen, und in Grand Prix und Zeitfahren ggf. begrenzt oder neutralisiert werden.
- **Variante B: rein kosmetisch**
  - Lackfarbe (`M`, `D`, `L` der Autodefinition umfärben), Lackierungen/Streifen, Aufkleber, Felgen, Spoiler, Hupen-Sound.
  - Keine Auswirkung auf die Fahrwerte, daher fair und ohne Balanceaufwand.
  - Ansatzpunkt im Code: `buildCar()` erzeugt die Sprites (48 Drehungen x 6 Schmutzstufen) aus `def.draw`; Farbvarianten ließen sich als Palette-Override beim Bauen einspeisen. Sprites müssen pro Variante neu gebaut werden (Speicher/Ladezeit beachten).
  - Gute Anbindung an die Freischaltungen: Lacke und Aufkleber als Belohnung für Ziele.
- **Empfehlung:** Mit B (kosmetisch) starten, weil es risikoarm ist und die Freischaltziele aus Abschnitt 2 sinnvoll füllt. Upgrades (A) später ergänzen, sobald Zeitfahren/Bestzeiten existieren, damit Balance messbar ist.
- **Speicherung:** pro Auto in `localStorage` (analog zu `mudracer-car` und `mudracer-unlock`).

## 3. Inhalt und Abwechslung

- **Neue Strecken:** Winter/Schnee mit Eis (rutschig), Vulkan oder Wüste mit Treibsand, Stadt/Hafen.
- **Wetter und Tageszeit:** Regen (Strecke wird matschiger), Nacht mit Scheinwerferkegel (Lichter sind schon im Sprite).
- **Streckenereignisse:** Nach dem Zug-Vorbild z. B. Kuhherde auf der Wiese oder Flutwelle am Strand.

## 4. Mehrspieler

- **Lokaler Zwei-Spieler-Modus** (Splitscreen oder geteilte Tastatur): für ein Familien-/Kinderspiel wohl das stärkste Einzelfeature.
- **Gamepad-API** zusätzlich zu Tastatur und Touch (wenige Zeilen Code).

## 5. Technik und Politur

- **Datei aufteilen:** Module für Autos, Strecken, Audio, Physik. Grundlage für alles andere.
- **Automatisierte Tests:** Rundenzählung, Checkpoint-Logik, Platzierung (`score()`), Zug-/Kollisionsfälle.
- **PWA / Offline:** Schrift „Press Start 2P" lokal einbinden statt Google Fonts, dann installierbar und offlinefähig.
- **Einstellungen:** getrennte Regler für Musik/Effekte, Tastenbelegung, echtes Pausenmenü (aktuell bricht `Esc` ins Hauptmenü ab).
- **Barrierefreiheit:** Modus mit weniger Flackern (Sirenen, Regenbogen), farbschwächefreundliche Unterscheidung.

## Empfohlene Reihenfolge

1. Zeitfahren mit Geist und Bestzeiten (viel Wiederspielwert, wenig Code)
2. Items (verändert das Rennen am stärksten)
3. Zwei-Spieler-Modus (macht aus Solo-Spaß ein Familienspiel)
4. Werkstatt, zuerst kosmetisch (Lacke, Aufkleber), später ggf. Upgrades
