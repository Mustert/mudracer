# Mudracer – Arbeitsanweisungen für Claude

## Git

Nach jeder Änderung in diesem Repo immer committen und auf den aktuellen Branch pushen (`origin/<aktueller Branch>`; auf `main` nur, wenn man dort arbeitet).
Nur wenn der Nutzer im Prompt ausdrücklich sagt, dass es ohne Commit/Push erfolgen soll, entfällt das.

## Projektstruktur

- Vite-Projekt: Quellcode in `src/` (ES-Module), `index.html` im Root ist nur noch das Gerüst mit CSS.
- Gemeinsamer veränderlicher Zustand liegt in `src/g.js`, in drei Teilen: `G` (Spielablauf und Rennen), `UI` (Menüzustand), `PREFS` (Auswahl und Einstellungen). Neue Felder gehören in einen davon und in die Liste dort; alles andere sind normale Exporte. Gespeichert wird nur über `src/save.js`.
- `npm run dev` startet den Dev-Server (Port 5177), `npm run build` erzeugt **eine** Datei `dist/index.html` (vite-plugin-singlefile).
- `dist/` und `node_modules/` sind nicht im Repo. Nach dem Klonen `npm install`.
- `npm run lint` (ESLint), `npm test` (Vitest, Tests in `test/`) und `npm run typecheck` (TypeScript prüft die JS-Dateien) laufen vor jedem Commit und müssen sauber sein.
- Nichts Schweres beim Start berechnen: Strecken und Auto-Sprites entstehen in Häppchen (`src/idle.js`), die Spielphysik läuft in festen Schritten (`src/clock.js`). Im Dev-Server gibt es `window.mudracer` mit `frameAt(now)`, um Frames ohne sichtbares Vorschaufenster zu rechnen, und mit der Streckenprüfung `check`, `checkAll`, `checkPic` (`src/check.js`, nur im Dev-Server, nicht im Build).

## Roadmap und Doku aktuell halten (Pflicht bei jeder Änderung)

Jede Änderung am Spiel wird vor dem Commit mit `ROADMAP.md` und der Obsidian-Doku abgeglichen. Das ist Teil der Änderung, nicht optional, und gehört in denselben Commit.

**`ROADMAP.md`** (Repo-Wurzel) ist die eine Liste für alles, was noch zu tun ist: drei Phasen (1 Map_Pack, 2 Cars & Customizations, 3 Game_Modes), dazu „Offene Entscheidungen“ und „Nach dem Release“. Es gibt keine zweite Liste: `ANALYSE.md`, `VERBESSERUNGEN.md` und einzelne Fehler- oder Ideenlisten existieren nicht mehr (alte Stände in der Git-Historie, letzter Stand `git show 8fb323f:ANALYSE.md`). Code-Kommentare mit „ANALYSE.md T21“ o. ä. meinen diesen alten Stand.
1. Vor der Arbeit: in `ROADMAP.md` die Punkte des Bereichs nachsehen (`grep -n "WUESTE\|1A-" ROADMAP.md`) und beim Umsetzen berücksichtigen. Gearbeitet wird an der Phase, die dran ist, nicht an späteren.
2. Vor dem Commit:
   - erledigte Punkte auf `erledigt (<commit oder Kurzbeschreibung>)` setzen, teilweise erledigte auf `teilweise (…)`;
   - neu entdeckte Schwächen oder Ideen mit der nächsten freien ID im passenden Block der passenden Phase anhängen (IDs `<Phase><Block>-<Nr>`, nie wiederverwenden); Großes ohne Platz in den drei Phasen kommt nach „Nach dem Release“;
   - Angaben, die durch die Änderung falsch geworden sind (Zahlen, Fundstellen, Stand, Tabelle „Strecken im Überblick“), korrigieren;
   - die Zeile „Zuletzt abgeglichen“ oben auf Datum und Commit nachziehen.
3. Die Grundregel „Spielstände bleiben gültig“ in `ROADMAP.md` gilt für jede Änderung.
4. Jede Phase hat einen Block `…T` mit technischen Aufgaben (Skills, `CLAUDE.md`, Prüfskripte, Tests). Ändert sich eine Arbeitsweise, wird dieser Block und diese Datei im selben Schritt angepasst.

**Eingang (F8):** Meldungen aus dem Dev-Server landen wie bisher in `feedback/` (`bug_…`, `feature_…`, mit Bild). Sie bleiben dort liegen. Nur wenn der Nutzer es sagt („sichte den Eingang“), ordnet Claude sie nach dem Skill `roadmap` in `ROADMAP.md` ein und löscht die verarbeiteten Dateien. Nichts wird von sich aus eingeordnet oder gelöscht.

**Obsidian-Doku** unter `Obsidian/Mudracer/` (Obsidian-Vault des Nutzers, im Git; nur das Fensterlayout `.obsidian/workspace*.json` ist ignoriert):
- `Strecken.md`: Plan aller Strecken und Cups (Cup 1 bis 5, Strecken 1 bis 15) mit Thema, Ereignis und Ideen; Grundlage für neue Strecken, zusammen mit den Streckendesign-Grundsätzen unten.
- `Autos.md`: alle Autos mit Freischaltung, Sternen, Feinwerten (`speed`, `mud`, `acc`, `turn`, `engine`), Hupe und Änderungswünschen; dazu die Füllautos.
- `Spielmodi.md`: Menüfluss und Bildschirme (Hauptmenü, Autowahl, Cup-Wahl, Einzelstrecke, Zeitfahren, Matschfahrt) mit Mockups.
- Ideen und offene Punkte gehören nicht in den Vault, sondern in `ROADMAP.md`. (Verweise auf `ANALYSE.md` im Vault meinen den alten Stand in der Git-Historie.)
- Bilder liegen in `Bilder/` und direkt im Vault; nicht anfassen.

Regeln für die Obsidian-Doku:
- Ändert sich etwas, das dort beschrieben ist (Werte, Freischaltungen, Strecken, Cups, Menüs), wird die passende Datei im selben Arbeitsschritt angepasst.
- Fakten (Ist-Stand, Werte, Status) werden aktualisiert. Wünsche und Pläne des Nutzers (z. B. Spalte „Änderungswunsch“, geplante Strecken) werden nicht umgeschrieben oder gelöscht, sondern als umgesetzt markiert (`✅ umgesetzt (<commit>)`).
- Obsidian-Syntax beibehalten (`![[Bild.png]]`, `[[Strecken]]`).

## Preview

- Die Preview immer stumm öffnen: direkt nach dem Start per JavaScript `localStorage.setItem('mudracer-music', '0')` setzen und neu laden. Die Musik des Spiels darf nie hörbar sein.
- Die Preview nach jedem Test wieder schließen: Server mit `preview_stop` beenden und den Tab mit `tabs_close` schließen.

## Streckendesign-Grundsätze

Gelten für jede neue Strecke und jede Überarbeitung. Vor dem Abschluss einer Strecke alle Punkte prüfen.

Für jede Arbeit an einer Strecke zuerst den Skill `strecke` laden (`.claude/skills/strecke/SKILL.md`: Ablauf, Einhängepunkte, Boden-Codes). Die Grundsätze 4, 5, 7 und 8 und ein ganzes Rennen prüft im Dev-Server `mudracer.check('NAME')` (`src/check.js`), die Übersicht über alle Strecken `mudracer.checkAll({ sim: true })`.

1. **Steigerung:** Je höher die Nummer der Strecke, desto anspruchsvoller darf sie sein. Eine Strecke soll nicht schwerer sein als spätere.
2. **Nichts Unlogisches oder Halbfertiges:** Ein Fluss endet nicht im Nichts (er kommt vom Kartenrand oder aus einer Quelle und fließt in einen See oder zum Rand), eine Schlucht hört nicht plötzlich auf, Brücken führen über etwas, Tunnel durch etwas. Keine harten Rechtecke, wo Natur sein soll.
3. **Schlamm und Pfützen fügen sich ein:** Matsch, Pfützen und ihre Entsprechungen (Sand, Sumpf, Asche, Schnee …) gehen natürlich in die Umgebung über und liegen dort, wo sie Sinn ergeben (Senken, Ufer, Fahrspuren). Nicht einfach als Fleck auf die Strecke geklatscht.
4. **Elegante Streckenführung:** Man kann nicht durch die Mitte abkürzen, und man muss nie raten, welchen Weg man nehmen muss, damit die Runde zählt. Begrenzungen ergeben sich aus dem Thema (Felsen, Wasser, Hecken, Lava …), nicht aus unsichtbaren Wänden. Die Form der Strecke passt zum Thema der Karte.
5. **Startaufstellung:** Bis zu 10 Autos (5 Reihen à 2, siehe `startRace` in `src/race.js`) stehen komplett auf einer Geraden, nie in einer Kurve.
6. **Mehr als ein Kreis ab Strecke 5:** Ab Nummer 5 bietet jede Strecke mehr als einen einfachen Rundkurs (Ausbuchtungen, Wege zur Wahl, Ebenen, Kreuzungen, Abkürzungen mit Risiko …).
7. **Streckenereignis:** Jede Strecke hat mindestens ein thematisch passendes Ereignis, das über `PREFS.events` ausschaltbar ist und eine witzige Schwierigkeit, gern auch Chaos, hineinbringt.
8. **Eigenes Lied:** Jede Strecke hat ihr eigenes Lied, passend zum Thema, zu Mudracer und zu einem Autorennen.
9. **Nicht zu viel auf einmal:** Mehrere Dinge auf einer Strecke sind gut, aber nicht gleichzeitig und nicht zu dicht hintereinander. Gefahren kündigen sich an (Schatten, Blinken, Ton, Text), sodass man reagieren kann.
10. **Wege sind sichtbar:** Was durchfahrbar ist, sieht deutlich anders aus als das, was ein Auto aufhält (z. B. Deko-Zäune flach und blass, feste Zäune und Wände kräftig mit Schatten). Hindernisse auf der Fahrbahn unterscheiden sich klar von gleichartiger Deko daneben.
11. **Nicht kindgerecht:** Kindgerechtes Design ist kein Kriterium für neue Strecken. Darum kümmert sich der Kindermodus. Das Spiel hat die Kinderspielschuhe hinter sich gelassen.
12. **Matsch ist eine Entscheidung:** Matsch und Pfützen sind selten unausweichlich, aber auch nicht nie: an mehreren Stellen eine kürzere Linie durch Matsch gegen eine längere saubere Linie (Ideallinie gegen außen herum). Die Menge richtet sich nach dem Thema der Strecke (die Wiese darf viel haben).
13. **Ein verständliches Wasch-Konzept:** Jede Strecke hat genau eine erkennbare Art, sauber zu werden (Dusche, Waschanlage, Box, Oase, Schlauchstelle). Sie wäscht nicht sofort, kündigt sich an, die Computerautos nutzen sie nur, wenn sie dreckig sind. Wo es viele Pfützen gibt, braucht es keine zusätzliche Waschstraße.
14. **Ziellinie und Start sind immer sichtbar:** Nichts (Schnee, Frost, Sand, Wolken, Schatten) überdeckt die Ziellinie oder die Startaufstellung.

## Feature-Abschluss und Publish

Nach jeder Umsetzung (neues Feature, größere Änderung) fragt Claude den Nutzer:
„Ist das ein Feature-Abschluss?“

**Ausnahme:** Solange in `ROADMAP.md` für die Phase des aktuellen Branches (z. B. `map_pack` = Phase 1) noch Punkte offen oder teilweise sind, wird nicht nach dem Feature-Abschluss gefragt und nicht publisht. Gefragt wird erst, wenn dort alles erledigt ist, oder wenn der Nutzer selbst einen Publish verlangt.

- **Ja:** erst `npm run build`, dann `dist/index.html` als Artifact auf claude.ai veröffentlichen (Artifact-Tool, `file_path` = `dist/index.html`).
  Gab es schon ein Artifact für dieses Projekt, mit dessen `url` aktualisieren statt ein neues anzulegen, damit der Link gleich bleibt.
- **Nein:** nichts publishen, weiterarbeiten.

Nach jedem Publish die Artifact-Ansicht sofort mit `mcp__ccd_view__close_pane` (`pane: "artifact"`) schließen, denn sie öffnet sich automatisch und spielt die Musik des Spiels ab.

Nicht eigenmächtig publishen. Erst fragen, dann veröffentlichen.

Artifact-URL: https://claude.ai/artifact/VZUv6XokmZMQgqNuhG2NHE (bei jedem Publish als `url` angeben, damit der Link gleich bleibt; nie ein neues Artifact anlegen). Vor dem ersten Publish in einer neuen Session die Live-Version mit `action: "read"` lesen, sonst wird der Publish abgelehnt.
