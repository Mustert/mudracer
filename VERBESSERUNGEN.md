# Mudracer – Verbesserungsideen

Abgeglichen mit dem Code am 2026-10-06 (`index.html`, ca. 2800 Zeilen, eine Datei).
Legende: ✅ umgesetzt · 🟡 teilweise · ⬜ offen

## Ist-Zustand

Pixeliger Top-Down-Racer mit:
- 8 spielbaren Autos (5 von Anfang an, 3 per Grand-Prix-Sieg freischaltbar: Foodtruck, Krankenwagen, Quad) plus 7 generische Füllautos
- 5 Strecken: Wiese, Wald, Strand, Regenbogen (Weltraum) und Zug (mit Bahnübergang); jede mit fester Mittelwand, damit niemand quer über das Infield fährt
- 4 Modi: Grand Prix (5 Rennen), Einzelstrecke, Zeitfahren, Matschfahrt
- Matsch, Wasser, Waschanlage, Boost-Pads (nur Regenbogen), Offroad bremst wie Matsch
- Titelbildschirm, Optionsmenü (Zahnrad: Musik, Steuerung Standard/Alternativ), Pausenmenü, Menü-Button
- Eigene Musik pro Strecke, Touch-Steuerung, Ton-Tasten (`M` stumm, `N` Musik)

## Abgleich der Ideen mit dem aktuellen Stand

| Idee | Status | Bemerkung |
|---|---|---|
| Autos spürbar unterscheiden | ✅ | Werte `speed`, `mud`, `acc`, `turn`, `soil`; Sterne daraus abgeleitet |
| Bestzeiten, Geist, Zeitfahren | ✅ | Geist ein-/ausschaltbar, Rekord pro Strecke und Auto |
| Einstellungen / Pause | 🟡 | Musik an/aus, Steuerung, Pause da; offen: getrennte Regler Musik/Effekte, freie Tastenbelegung |
| Items / Power-ups | ⬜ | nur Boost-Pads auf Regenbogen |
| KI mit Charakter | ⬜ | weiterhin nur eine `skill`-Stufe (0,52–0,66) plus Gummiband |
| Drift / Handbremse | ⬜ | |
| Mehr Freischaltziele | ⬜ | Freischaltung nur über den Grand-Prix-Sieg |
| Schwierigkeitsgrad | ⬜ | siehe Advanced-Modus unten |
| Werkstatt | ⬜ | |
| Neue Strecken, Wetter, Tageszeit | ⬜ | |
| Streckenereignisse | 🟡 | nur der Zug; keine einstellbaren Ereignisse |
| Zwei-Spieler-Modus, Gamepad | ⬜ | keine Gamepad-API im Code |
| Datei aufteilen, automatisierte Tests | ⬜ | weiterhin eine Datei, keine Tests |
| PWA / Offline | ⬜ | Schrift kommt noch von Google Fonts |
| Barrierefreiheit | ⬜ | |

## Neu: Advanced-Modus (Checkbox im Hauptmenü)

Das Spiel ist standardmäßig für Kinder gedacht. Eine Checkbox „ADVANCED" im Hauptmenü schaltet den Erwachsenen-/Profi-Modus ein.

**Standardmodus (Checkbox aus, für Kinder)**
- Alle Autos sind von Anfang an wählbar, nichts ist gesperrt.
- Es gibt nur eine Einstellung: **Schwierigkeit Einfach / Mittel / Schwer**. Sie bestimmt alle übrigen Optionen mit, zum Beispiel:
  - Einfach: 2 Runden, lahme Gegner, wenig Matsch, kein Zug
  - Mittel: 3 Runden, normale Gegner, alles wie bisher (entspricht dem heutigen Spiel)
  - Schwer: 4 Runden, starke Gegner, weniger Wasser zum Waschen, keine Boost-Felder
- Platz dafür: untere Leiste des Hauptmenüs, neben der Checkbox.

**Advanced-Modus (Checkbox an)**
- Einige Autos sind hinter der Freischaltung versteckt (heute Foodtruck, Krankenwagen, Quad per Grand-Prix-Sieg). Die Freischaltung zählt nur in diesem Modus.
- Die Schwierigkeit entfällt, stattdessen gibt es einen **Optionsbildschirm pro Strecke**:
  - Runden (1–5), Gegnerstärke (leicht/normal/stark), Matsch und Wasser (aus/wenig/normal)
  - Streckenereignisse, die es auf der Strecke gibt: Zug (Zug-Strecke), Boost-Felder (Regenbogen)
  - „Standard"-Zeile setzt die Strecke zurück
  - Im Grand Prix schaltet eine erste Zeile zwischen den fünf Strecken um
- Die Einstellungen werden pro Strecke gespeichert.

**Hinweise für die Umsetzung**
- Matsch, Wasser und Boost-Felder sind in das Streckenbild eingebrannt (`buildTrack`). Abweichende Einstellungen brauchen deshalb eine eigene Streckenvariante, die beim ersten Bedarf gebaut und danach zwischengespeichert wird (kurzer Hänger beim ersten Start). Der Zug lässt sich dagegen zur Laufzeit abschalten.
- Rundenzahl: `LAPS` wird zu einer Variable pro Rennen.
- Gegnerstärke: Faktor auf `skill` der Computerautos.
- **Zeitfahren-Rekorde:** Zeiten unter anderen Regeln sind nicht vergleichbar. Standardregeln (3 Runden, normaler Matsch und Wasser, Zug, Boost) behalten den alten Schlüssel `mudracer-tt-<STRECKE>-<auto-id>`, alle anderen bekommen ein Suffix je Einstellung. So bleiben alle bisherigen Rekorde gültig (Grundregel, siehe unten).
- Neue Speicherschlüssel: `mudracer-adv` (Checkbox), `mudracer-diff` (Schwierigkeit), `mudracer-opt-<STRECKE>` (Optionen pro Strecke).
- Ein Prototyp dieser Umsetzung wurde getestet (Hauptmenü, Optionsbildschirm, Streckenvarianten, Zug aus, gesperrte Autos). Er wurde bewusst nicht übernommen, die Idee ist hier nur dokumentiert.

## 1. Spielgefühl und Tiefe

- **Items / Power-ups:** Matschbombe, Schlammschild, Nitro. Bisher kein aktives Eingreifen in den Wettbewerb.
- **KI mit Charakter:** Aktuell nur eine `skill`-Stufe (0,52–0,66). Eigene Fahrstile pro Auto, z. B. Polizei sauber, Monster rammt, Traktor stur.
- **Drift / Handbremse:** Drift mit Mini-Boost, besonders für Quad und Flitzer.
- **Autos spürbar unterscheiden:** ✅ umgesetzt. Fünf-Sterne-Anzeige (TEMPO/MATSCH) wird aus feinen Werten (`speed`, `mud`, `acc`, `turn`) abgeleitet. Schmutz bremst schlechte Matschfahrer stärker (`soil`). Alle Autos brauchen etwa gleich lang (Streckensumme ca. ±3 %), fühlen sich aber verschieden an.
- **Grundregel: Spielstände bleiben gültig.** `mudracer-car`, `mudracer-unlock` und `mudracer-tt-*` dürfen nie unbrauchbar werden. Änderungen an Fahrwerten bekommen eine Versionsnummer (`BAL`), alte Zeitfahr-Rekorde werden beim Laden umgerechnet (`BAL_OLD`), ohne die gespeicherten Daten zu überschreiben.

## 2. Langzeitmotivation

- **Bestzeiten und Rundenrekorde** pro Strecke und Auto in `localStorage`, dazu ein **Geister-Auto** der Bestrunde. ✅
- **Zeitfahren-Modus:** ✅ umgesetzt (Geist ein-/ausschaltbar, Bestzeit pro Strecke und Auto in `localStorage`, Key `mudracer-tt-<STRECKE>-<auto-id>`; Geist-Option in `mudracer-ghost`).
- **Mehr Freischaltziele:** z. B. Matschfahrt unter X Sekunden, alle Strecken sauber beenden, 3-mal in die Waschanlage. (Im Advanced-Modus würden sie die gesperrten Autos füllen.)
- **Schwierigkeitsgrad** (Einfach/Mittel/Schwer): geplant als Teil des Advanced-Modus (siehe oben).

### Werkstatt (Fahrzeuganpassung)

Eigenes Menü, in dem das gewählte Auto angepasst wird. Zwei Varianten, die sich auch kombinieren lassen:

- **Variante A: Upgrades mit Wirkung (freischaltbar)**
  - Motor (Topspeed), Reifen (weniger Matschverlust, z. B. Profilreifen), Getriebe/Beschleunigung, Stoßstange (weniger Stun bei Kollisionen).
  - Währung: Punkte aus Rennen oder Münzen auf der Strecke; Stufen 1–3 pro Teil.
  - Ansatzpunkte im Code: die Werte `speed`, `mud`, `acc`, `turn` in `CAR_DEFS` als Basis, Upgrades als Multiplikatoren darauf.
  - Risiko: Balance. Upgrades sollten Stärken verstärken statt Autos gleichzumachen, und in Grand Prix und Zeitfahren ggf. begrenzt oder neutralisiert werden.
- **Variante B: rein kosmetisch**
  - Lackfarbe (`M`, `D`, `L` der Autodefinition umfärben), Lackierungen/Streifen, Aufkleber, Felgen, Spoiler, Hupen-Sound.
  - Keine Auswirkung auf die Fahrwerte, daher fair und ohne Balanceaufwand.
  - Ansatzpunkt im Code: `buildCar()` erzeugt die Sprites (48 Drehungen x 6 Schmutzstufen) aus `def.draw`; Farbvarianten ließen sich als Palette-Override beim Bauen einspeisen. Sprites müssen pro Variante neu gebaut werden (Speicher/Ladezeit beachten).
  - Gute Anbindung an die Freischaltungen: Lacke und Aufkleber als Belohnung für Ziele.
- **Empfehlung:** Mit B (kosmetisch) starten, weil es risikoarm ist und die Freischaltziele sinnvoll füllt. Upgrades (A) später ergänzen, sobald Zeitfahren/Bestzeiten existieren, damit Balance messbar ist.
- **Speicherung:** pro Auto in `localStorage` (analog zu `mudracer-car` und `mudracer-unlock`).

## 3. Inhalt und Abwechslung

- **Neue Strecken:** Winter/Schnee mit Eis (rutschig), Vulkan oder Wüste mit Treibsand, Stadt/Hafen.
- **Wetter und Tageszeit:** Regen (Strecke wird matschiger), Nacht mit Scheinwerferkegel (Lichter sind schon im Sprite).
- **Streckenereignisse:** Nach dem Zug-Vorbild z. B. Kuhherde auf der Wiese oder Flutwelle am Strand. Im Advanced-Modus pro Strecke einzeln ein-/ausschaltbar.

## 4. Mehrspieler

- **Lokaler Zwei-Spieler-Modus** (Splitscreen oder geteilte Tastatur): für ein Familien-/Kinderspiel wohl das stärkste Einzelfeature.
- **Gamepad-API** zusätzlich zu Tastatur und Touch (wenige Zeilen Code).

## 5. Technik und Politur

- **Datei aufteilen:** Module für Autos, Strecken, Audio, Physik. Grundlage für alles andere.
- **Automatisierte Tests:** Rundenzählung, Checkpoint-Logik, Platzierung (`score()`), Zug-/Kollisionsfälle.
- **PWA / Offline:** Schrift „Press Start 2P" lokal einbinden statt Google Fonts, dann installierbar und offlinefähig.
- **Einstellungen:** ✅ Zahnrad-Menü (Musik an/aus, Steuerung Standard/Alternativ) und Pausenmenü (`Esc`, Menü-Button oben links) umgesetzt. Offen: getrennte Regler für Musik/Effekte, freie Tastenbelegung.
- **Barrierefreiheit:** Modus mit weniger Flackern (Sirenen, Regenbogen), farbschwächefreundliche Unterscheidung.

## Empfohlene Reihenfolge

1. ✅ Zeitfahren mit Geist und Bestzeiten
2. Advanced-Modus mit Schwierigkeit und Optionen pro Strecke (Grundlage für Streckenereignisse und Freischaltziele)
3. Items (verändert das Rennen am stärksten)
4. Zwei-Spieler-Modus (macht aus Solo-Spaß ein Familienspiel)
5. Werkstatt, zuerst kosmetisch (Lacke, Aufkleber), später ggf. Upgrades
