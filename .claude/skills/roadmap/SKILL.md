---
name: roadmap
description: Eingang (F8-Meldungen in feedback/) in ROADMAP.md einordnen und die Roadmap pflegen. Laden, wenn der Nutzer sagt „sichte den Eingang“, neue Bugs oder Ideen nennt, die in die Planung gehören, oder wenn Punkte der Roadmap erledigt, verschoben oder neu bewertet werden.
---

# Roadmap pflegen

`ROADMAP.md` ist die **einzige** Liste für Bugs, Ideen und offene Arbeit. Es gibt keine `ANALYSE.md`, keine `VERBESSERUNGEN.md` und keine Meldungsdateien, die nach der Sichtung liegen bleiben.

## Eingang sichten (nur auf Ansage des Nutzers)

Das F8-Fenster im Dev-Server legt `bug_<datum>_<zeit>_<STRECKE>.md` und `feature_…md` mit gleichnamigem `.jpg` in `feedback/` ab. Claude sichtet sie nur, wenn der Nutzer es sagt, nie von sich aus.

1. Alle `*.md` in `feedback/` lesen (außer `README.md`). Der erste Absatz ist der Text des Nutzers, die Tabelle darunter der Stand (Strecke mit `rev`, Modus, Stufe, Runde, Platz, Autos). Bei Meldungen ohne Text das Bild ansehen und in Zusammenhang mit der Meldung davor oder danach lesen.
2. Jede Meldung einer **Phase** und einem **Block** zuordnen:
   - Strecke (Fehler, Wunsch, Optik, Balance einer Strecke) → Phase 1, Block `1S<Nr>`; gilt es für mehrere Strecken → `1A`.
   - Cups, Freischaltung, Siegerehrung, Platzberechnung → `1C` (Phase 1) bzw. `2C` (Belohnungen).
   - Performance → `1P`; Musik und Ton → `1M`.
   - Autos, Handhabung, Anpassungen, Achievements → Phase 2.
   - Schwierigkeit, KI, Optionen, Kindermodus, Grafik-Politur → Phase 3.
   - Große neue Funktion ohne Platz in den drei Phasen → „Nach dem Release“.
3. Vorher prüfen, ob es den Punkt schon gibt (`grep -n "Stichwort" ROADMAP.md`): dann den Punkt ergänzen und die Meldung in „Herkunft“ nennen, statt einen zweiten anzulegen.
4. Neuen Punkt mit der **nächsten freien ID** im Block anhängen (`1S6-4`, nie eine ID wiederverwenden). Spalten: ID, Prio (H/M/N), Status `offen`, Aufgabe (ein bis zwei Sätze, die Bedingung zum Abhaken steht drin), Herkunft (`Meldung <Datum> <STRECKE>`). Der Wortlaut des Nutzers bleibt erhalten, wird aber nicht abgeschrieben, sondern auf die Aufgabe verdichtet.
5. Ein Wunsch, der gegen die Streckendesign-Grundsätze oder gegen die Phasenziele läuft, wird nicht still eingeordnet: dem Nutzer die Frage stellen.
6. Gehört ein Punkt in eine **Entscheidung** (Tabelle „Offene Entscheidungen“), dort ergänzen statt eine Aufgabe zu erfinden.
7. Erst wenn alles eingeordnet ist: die verarbeiteten `.md` **und** `.jpg` in `feedback/` löschen. `README.md` bleibt. Dem Nutzer in einer kurzen Liste sagen, welche Meldung zu welcher ID geworden ist.
8. „Zuletzt abgeglichen“ in `ROADMAP.md` nachziehen, committen und pushen (`CLAUDE.md`). Die Feedback-Dateien sind nicht im Git; das Löschen ist deshalb nicht rückholbar, also erst nach Schritt 4 bis 6.

## Roadmap sonst pflegen

- Erledigt: Status `erledigt (<commit>)`, Zeile stehen lassen. Wenn die Phase abgeschlossen ist, wandert die Kurzfassung nach „Erledigt“ ganz unten.
- Neue Erkenntnis aus der Arbeit (Fehler, Schwäche, Idee): sofort mit nächster freier ID im Block anhängen, auch wenn sie nicht zur aktuellen Aufgabe gehört.
- Die Tabelle „Strecken im Überblick“ und die Statuszeile der drei Phasen bei jeder Änderung an einer Strecke nachziehen.
- Der Technik-Block `…T` jeder Phase hält fest, welche Skills, `CLAUDE.md`-Regeln, Prüfungen und Tests zur Phase gehören. Entsteht oder ändert sich eine Arbeitsweise, dort eintragen und `CLAUDE.md` anpassen.
- Die Grundregel „Spielstände bleiben gültig“ steht in `ROADMAP.md` oben und gilt für jeden Punkt.
