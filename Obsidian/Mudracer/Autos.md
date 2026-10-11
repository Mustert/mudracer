
Stand: Spielstand Branch `content_patch_01` (nach Merge von main), Quelle `src/cars.js` und `src/audio.js`. Reihenfolge wie in `CAR_DEFS`.

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
| 6   | FOODTRUCK    | Ja, 1. Grand-Prix-Sieg | ★★★☆☆ | ★★★☆☆  | 1.005 | 1.20 | 0.95 | 0.95 | 46     | `jingle`: Eiswagen-Melodie (7 Töne)                                            |                                                                     | Zukünftig Freischaltbar durch 1. Sieg in Cup1 |
| 7   | KRANKENWAGEN | Ja, 2. Grand-Prix-Sieg | ★★★★☆ | ★★☆☆☆  | 1.03  | 1.00 | 1.05 | 1.03 | 56     | `ambulance`: Wechselton 415/554 Hz, 3×                                         | Sirene                                                              | Zukünftig Freischaltbar durch 1. Sieg in Cup2 |
| 8   | QUAD         | Ja, 3. Grand-Prix-Sieg | ★★★★☆ | ★★★☆☆  | 1.015 | 1.20 | 1.25 | 1.15 | 72     | `quad`: zwei sehr kurze, hohe Töne                                             |                                                                     | Zukünftig Freischaltbar durch 1. Sieg in Cup3 |
| 9   | RALLY CAR    | Nein, von Anfang an    | ★★★☆☆ | ★★☆☆☆  | 1.00  | 1.00 | 1.10 | 1.05 | 70     | `rally`: einfaches Autohupen, leicht anders als Flitzer (466/587 Hz)           | weiß, bunt, ohne echte Werbung                                      | Zukünftig Freischaltbar durch 1. Sieg in Cup4 |
| 10  | BATMOBIL     | Nein, von Anfang an    | ★★★★★ | ★★★★☆  | 1.10  | 1.40 | 1.40 | 1.20 | 85     | `batmobil`: Melodie wie ein amerikanisches Wohnmobil (La Cucaracha), ca. 3,9 s | stärkstes Auto: höchste Werte bei Tempo, Beschleunigung und Lenkung | Zukünftig Freischaltbar durch 1. Sieg im Cup5 |

Hinweise zum Abgleich mit der alten Tabelle:
- Rally Car und Batmobil standen mit "Ja" bei Freischaltbar. Im Spiel sind beide **von Anfang an wählbar** (Kommentar im Code: "playable from the start, no unlock needed"). Sollen sie freischaltbar werden, braucht es ein `lock`-Feld (heute nur 1 bis 3 für Foodtruck, Krankenwagen, Quad) und weitere Freischaltziele.
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
