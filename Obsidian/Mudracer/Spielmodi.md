
> **Stand im Spiel (2026-10-12, Branch `map_pack`):** Das Hauptmenü hat fünf Karten: GRAND PRIX, EINZELSTRECKE, ZEITFAHREN, MATSCHFAHRT, WERKSTATT (`MODES` in `src/state.js`), oben links den Schalter NORMAL/KINDER (Kindermodus: immer LEICHT, keine Streckeneffekte, alle Autos und Cups offen) und oben rechts das Zahnrad (Musik, Steuerung, Spielstand als Datei sichern, Spielstand aus Datei laden). Abläufe im Code:
> - Grand Prix: Cup-Wahl (mit Schwierigkeit oben rechts) → Autowahl → Rennen. Custom Cup: eigene Streckenfolge (bis 12 Strecken) und 2 bis 7 Gegner.
> - Einzelstrecke: Streckenwahl → Autowahl → Optionen (Gegner 1 bis 7, Schwierigkeit, Streckeneffekte an/aus) → Rennen.
> - Zeitfahren: Streckenwahl → Autowahl → Optionen (Geist, Streckeneffekte) → Zeitfahrt.
> - Matschfahrt: Autowahl → Matschfahrt.
> - Werkstatt: Auto wählen, Lackfarbe wählen (11 Farben).
> - Rundenzahl ist überall fest 3 (`LAPS`), eine Rundenwahl gibt es noch nicht (`ANALYSE.md` M12).
> - Ladebildschirm: Die Strecken werden nicht beim Start gebaut, sondern im Hintergrund, während ein Menü zu sehen ist; bis dahin zeigen die Menüs nur die Form der Strecke. Ist eine Strecke beim Rennstart noch nicht fertig, erscheint kurz „STRECKE WIRD GEBAUT“ mit Balken.

**Hauptmenü** => kann so bleiben

![[Pasted image 20261006220529.png]]


**Autowahl**

Die Autowahl tritt auf nachdem eine Strecke (Einzelstrecke / Zeitfahren) / ein Grand Prix Pokal / die Matschfahrt ausgewählt wurde.

![[Pasted image 20261006225859.png]]
Das ist ein Mockup für die Idee der neuen Autowahl. Links die Inspiration und rechts wie es zukünftig aussehen soll. Der schwarze Kasten ist dann die neue View.
Oben alle Autos in der Vorauswahl. Unterhalb der Vorschau der Autos (roter kleiner Kasten) ist die Seitenspezifische Info (Zeitfahren => Bestzeit, Grand Prix => Bester Platz bisher / Pokale etc.). Der Grüne Kasten ist die aktuelle Auswahl, die unterhalb der Haupauswahl auch zu der Ansicht des Autos in groß führt.
✅ umgesetzt (ddc7b0a): Regal mit allen Autos oben, darunter je Auto ein Infokasten (Zeitfahren: Bestzeit, Grand Prix: Pokale), das gewählte Auto groß darunter (`src/carselect.js`).

**=> Grand Prix**
![[Pasted image 20261006230249.png]]

Idee für die Auswahl. Wird über eine Auswahl gehovert, so "löst" diese sich von den anderen, bekommt quasi ein padding top und bottom
✅ umgesetzt (ddc7b0a): Die gewählte Cup-Zeile tritt aus der Liste heraus und wird höher (`src/cupselect.js`).

Neue Einordnung der [[Strecken]] (siehe Link) in Cups. Iconographie ist auch dort dargestellt.

=> Alle möglichen Belohnungen in GrandPrix sollen erkennbar sein (drehendes Geschenk soll in der UI angezeigt werden, damit SpilerInnen bescheid wissen)
✅ umgesetzt: drehendes Geschenk in der Cup-Wahl (`drawGift` in `src/cupselect.js`).

**=> Einzelstrecke**
	=> Führt zur Streckenauswahl (wie bisher, alle neuen und alten strecken einfach nach Reihenfolge aneinandergereiht)
		=> Führt zur Autoauswahl
			=> Führt zu Optionswahl (Gegner 0-9 | Anzahl Runden 1-5)
				(im Spiel: Gegner 1 bis 7, Schwierigkeit, Streckeneffekte; Runden noch fest 3)
				=> Führt zur Einzelstrecke
**=> Zeitfahren**
	=> Führt zur Streckenauswahl (wie bisher, alle neuen und alten strecken einfach nach Reihenfolge aneinandergereiht)
		=> Führt zur Autoauswahl
			=> Führt zu Optionswahl wie bisher (Geist ein/Aus)
				(im Spiel: Geist und Streckeneffekte)
				=> Führt zur Zeitfahrt


**=> Matschfahrt**
	=> führt zur Autoauswahl
		=> Führt zur Matschfahrt wie bisher