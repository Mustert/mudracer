# Mudracer – Arbeitsanweisungen für Claude

## Git

Nach jeder Änderung in diesem Repo immer committen und nach `origin/main` pushen.
Nur wenn der Nutzer im Prompt ausdrücklich sagt, dass es ohne Commit/Push erfolgen soll, entfällt das.

## Preview

- Die Preview immer stumm öffnen: direkt nach dem Start per JavaScript `localStorage.setItem('mudracer-music', '0')` setzen und neu laden. Die Musik des Spiels darf nie hörbar sein.
- Die Preview nach jedem Test wieder schließen: Server mit `preview_stop` beenden und den Tab mit `tabs_close` schließen.

## Feature-Abschluss und Publish

Nach jeder Umsetzung (neues Feature, größere Änderung) fragt Claude den Nutzer:
„Ist das ein Feature-Abschluss?“

- **Ja:** `index.html` als Artifact auf claude.ai veröffentlichen (Artifact-Tool, `file_path` = `index.html`).
  Gab es schon ein Artifact für dieses Projekt, mit dessen `url` aktualisieren statt ein neues anzulegen, damit der Link gleich bleibt.
- **Nein:** nichts publishen, weiterarbeiten.

Nicht eigenmächtig publishen. Erst fragen, dann veröffentlichen.

Artifact-URL (nach dem ersten Publish hier eintragen): _noch keine_
