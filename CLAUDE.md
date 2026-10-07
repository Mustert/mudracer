# Mudracer – Arbeitsanweisungen für Claude

## Git

Nach jeder Änderung in diesem Repo immer committen und nach `origin/main` pushen.
Nur wenn der Nutzer im Prompt ausdrücklich sagt, dass es ohne Commit/Push erfolgen soll, entfällt das.

## Projektstruktur

- Vite-Projekt: Quellcode in `src/` (ES-Module), `index.html` im Root ist nur noch das Gerüst mit CSS.
- Gemeinsamer veränderlicher Spielzustand liegt in `G` (`src/g.js`), alles andere sind normale Exporte.
- `npm run dev` startet den Dev-Server (Port 5177), `npm run build` erzeugt **eine** Datei `dist/index.html` (vite-plugin-singlefile).
- `dist/` und `node_modules/` sind nicht im Repo. Nach dem Klonen `npm install`.

## Preview

- Die Preview immer stumm öffnen: direkt nach dem Start per JavaScript `localStorage.setItem('mudracer-music', '0')` setzen und neu laden. Die Musik des Spiels darf nie hörbar sein.
- Die Preview nach jedem Test wieder schließen: Server mit `preview_stop` beenden und den Tab mit `tabs_close` schließen.

## Feature-Abschluss und Publish

Nach jeder Umsetzung (neues Feature, größere Änderung) fragt Claude den Nutzer:
„Ist das ein Feature-Abschluss?“

- **Ja:** erst `npm run build`, dann `dist/index.html` als Artifact auf claude.ai veröffentlichen (Artifact-Tool, `file_path` = `dist/index.html`).
  Gab es schon ein Artifact für dieses Projekt, mit dessen `url` aktualisieren statt ein neues anzulegen, damit der Link gleich bleibt.
- **Nein:** nichts publishen, weiterarbeiten.

Nach jedem Publish die Artifact-Ansicht sofort mit `mcp__ccd_view__close_pane` (`pane: "artifact"`) schließen, denn sie öffnet sich automatisch und spielt die Musik des Spiels ab.

Nicht eigenmächtig publishen. Erst fragen, dann veröffentlichen.

Artifact-URL: https://claude.ai/artifact/VZUv6XokmZMQgqNuhG2NHE (bei jedem Publish als `url` angeben, damit der Link gleich bleibt; nie ein neues Artifact anlegen). Vor dem ersten Publish in einer neuen Session die Live-Version mit `action: "read"` lesen, sonst wird der Publish abgelehnt.
