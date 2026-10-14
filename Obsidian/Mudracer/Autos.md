
Stand: 2026-10-11, Branch `map_pack`, Quelle `src/cars.js` und `src/audio.js`. Reihenfolge wie in `CAR_DEFS`. Werte, Sterne und Hupen am 2026-10-11 mit dem Code abgeglichen.

Sterne werden aus den Feinwerten abgeleitet:
- Tempo = `speed + 0.1 × (acc − 1)`, skaliert von 0,94 bis 1,09 auf 1–5 Sterne
- Matsch = `mud`, skaliert von 0,8 bis 1,6 auf 1–5 Sterne (hoher Wert = kommt gut durch Matsch)

| NR  | Name         | Freischaltbar          | Tempo | Matsch | speed | mud  | acc  | turn | engine | Hupe (`honk`)                                                                  | Besonderheit                                                        | Änderungswunsch                               |
| --- | ------------ | ---------------------- | ----- | ------ | ----- | ---- | ---- | ---- | ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------- |
| 1   | FLITZER      | Nein, von Anfang an    | ★★★★★ | ★☆☆☆☆  | 1.085 | 0.80 | 1.20 | 1.12 | 64     | `meep`: zwei kurze Doppeltöne (415/523 Hz)                                     |                                                                     |                                               |
| 2   | MONSTER      | Nein, von Anfang an    | ★★☆☆☆ | ★★★★☆  | 0.97  | 1.40 | 0.90 | 0.95 | 40     | `horn`: tiefer, langer Dreiklang (185/233/277 Hz)                              |                                                                     |                                               |
| 3   | TRAKTOR      | Nein, von Anfang an    | ★☆☆☆☆ | ★★★★★  | 0.95  | 1.60 | 0.80 | 0.90 | 30     | `tractor`: zwei kurze und ein langer tiefer Ton (neuer Sound umgesetzt)        |                                                                     |                                               |
| 4   | POLIZEI      | Nein, von Anfang an    | ★★★★☆ | ★★☆☆☆  | 1.04  | 0.95 | 1.10 | 1.05 | 58     | `police`: Wechselton 440/587 Hz, 2×                                            | Sirene                                                              |                                               |
| 5   | FEUERWEHR    | Nein, von Anfang an    | ★★☆☆☆ | ★★★☆☆  | 1.005 | 1.25 | 0.85 | 0.90 | 44     | `fire`: Wechselton 392/523 Hz, 2×                                              | Sirene                                                              |                                               |
| 6   | FOODTRUCK    | Ja, 1. Sieg in Cup 1 (Bronze) | ★★★☆☆ | ★★★☆☆  | 1.005 | 1.20 | 0.95 | 0.95 | 46     | `jingle`: Eiswagen-Melodie (7 Töne)                                            |                                                                     | Zukünftig Freischaltbar durch 1. Sieg in Cup1 ✅ umgesetzt (ddc7b0a) |
| 7   | KRANKENWAGEN | Ja, 1. Sieg in Cup 2 (Silber) | ★★★★☆ | ★★☆☆☆  | 1.03  | 1.00 | 1.05 | 1.03 | 56     | `ambulance`: Wechselton 415/554 Hz, 3×                                         | Sirene                                                              | Zukünftig Freischaltbar durch 1. Sieg in Cup2 ✅ umgesetzt (ddc7b0a) |
| 8   | QUAD         | Ja, 1. Sieg in Cup 3 (Gold) | ★★★★☆ | ★★★☆☆  | 1.015 | 1.20 | 1.25 | 1.15 | 72     | `quad`: zwei sehr kurze, hohe Töne                                             |                                                                     | Zukünftig Freischaltbar durch 1. Sieg in Cup3 ✅ umgesetzt (ddc7b0a) |
| 9   | RALLY CAR    | Ja, 1. Sieg in Cup 4 (Platin) | ★★★☆☆ | ★★☆☆☆  | 1.00  | 1.00 | 1.10 | 1.05 | 70     | `rally`: einfaches Autohupen, leicht anders als Flitzer (466/587 Hz)           | weiß, bunt, ohne echte Werbung                                      | Zukünftig Freischaltbar durch 1. Sieg in Cup4 ✅ umgesetzt (ddc7b0a) |
| 10  | BATMOBIL     | Ja, 1. Sieg in Cup 5 (Fantasy); Cup 5 hat bisher nur das Spielzimmer | ★★★★★ | ★★★★☆  | 1.10  | 1.40 | 1.40 | 1.20 | 85     | `batmobil`: Melodie wie ein amerikanisches Wohnmobil (La Cucaracha), ca. 3,9 s | stärkstes Auto: höchste Werte bei Tempo, Beschleunigung und Lenkung | Zukünftig Freischaltbar durch 1. Sieg im Cup5 ✅ umgesetzt (ddc7b0a); erreichbar, seit Cup 5 das Spielzimmer hat (Prototyp) |

Hinweise:
- **Freischaltung:** Ein Auto mit `cup: n` in `CAR_DEFS` ist gesperrt, bis Cup n zum ersten Mal gewonnen ist (`isLocked` in `src/cars.js`, gewonnene Cups in `mudracer-cups`). Der Kindermodus öffnet alle Autos; Siege dort schalten für das normale Spiel nichts frei. Alte Spielstände mit `mudracer-unlock` (0 bis 3 GP-Siege) zählen als Cup 1 bis n. Seit Cup 5 das Spielzimmer hat, ist das Batmobil auch außerhalb des Kindermodus erreichbar (`ANALYSE.md` M1).
- **Lackierung:** In der Werkstatt kann jedes Auto eine von 11 Farben bekommen (`PAINTS` in `src/cars.js`, gespeichert in `mudracer-paint-<id>`). Bei Rally Car und Quad färben sich die Akzente mit (Streifen, Panels, Band bzw. Anzug und Helm; Feld `accent`).
- Der neue Traktor-Hupensound ist umgesetzt. Alle Änderungswünsche der alten Tabelle sind damit erledigt.
- Die Nummerierung entspricht der Reihenfolge in `CAR_DEFS` (Autowahl und Index `def.k`). Rally Car und Batmobil stehen dort nach den drei Freischalt-Autos.
- Alte Zeitfahr-Rekorde hängen am Index im Code (`def.k`) und an der Balance-Version `BAL` (aktuell 2).

## Füllautos (nicht wählbar)

Sieben schlichte Autos füllen das Starterfeld im Grand Prix auf acht auf: GRAU, BEIGE, OLIV, WEINROT, TUERKIS, LILA, GOLD. Alle gleich: speed 1.03, mud 1.0, acc 1.0, turn 1.0, Hupe `meep`, Motor 50 + 3 × Nummer.

## Bilder der Vorlagen

Rally Car (Mini-Edition, bunt aber ohne echte Werbung):
![[Pasted image 20261006221654.png]]

Batmobil:
![[Pasted image 20261006220656.png]]
