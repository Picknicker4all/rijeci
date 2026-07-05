# Riječi – Kroatisch-Deutsch-Vokabeltrainer (PWA)

Persönliche Lern-App. Reines HTML/CSS/JS ohne Build-Schritt, offline-fähig,
Lernstand in localStorage pro Gerät. Gehostet über GitHub Pages.

## Wichtigster Workflow: Vokabel-Import

Der Nutzer bringt regelmäßig neue Vokabellisten aus seinem Kroatisch-Kurs mit
(als Text, Dokument oder Foto). Claude pflegt sie ein:

1. Liste einlesen (bei Fotos: Text auslesen, Rechtschreibung der Diakritika
   č/ć/đ/š/ž sorgfältig prüfen, Ergebnis dem Nutzer zur Kontrolle zeigen).
2. Neue Lektion in `data/vocab.js` anhängen (Schema siehe unten),
   `updated`-Datum setzen und `version` hochzählen.
3. Zu jeder Vokabel 1–2 **Beispielsätze** auf A1/A2-Niveau generieren
   (Feld `sentences`). Die im Satz verwendete – ggf. gebeugte – Form der
   Vokabel mit `*…*` markieren; daraus baut die App Lückentext-Übungen.
4. **3–5 passende Zusatzvokabeln** zum Themenkreis der Lektion ergänzen
   (`"extra": true`) – Wörter, die thematisch dazugehören, im Kurs aber
   fehlen. Dem Nutzer kurz auflisten, was ergänzt wurde.
5. Committen und pushen (GitHub Pages liefert automatisch neu aus).
   `sw.js`-Cache-Version nur hochzählen, wenn App-Dateien (HTML/CSS/JS
   außer vocab.js) geändert wurden – vocab.js wird network-first geladen.

## Schema `data/vocab.js`

```js
window.VOCAB = {
  "version": 1,            // bei jedem Import +1
  "updated": "JJJJ-MM-TT",
  "lessons": [{
    "id": "l1",            // fortlaufend: l1, l2, …
    "name": "Lektion 1 · <kroatisch> – <deutsch>",
    "words": [{
      "id": "l1-01",       // lektion-nummer, zweistellig – NIE nachträglich ändern
      "hr": "dobar dan",   // kroatisch (Verben im Infinitiv, Nomen mit Genus-Hinweis in note falls nötig)
      "de": "guten Tag",
      "pos": "Ausdruck",   // Wortart: Nomen/Verb/Adjektiv/Adverb/Ausdruck/Partikel …
      "note": "",          // kurzer Hinweis (Register, Grammatik), darf leer sein
      "extra": false,      // true = von Claude ergänzte Zusatzvokabel
      "sentences": [{ "hr": "*Dobar dan*, kako ste?", "de": "Guten Tag, wie geht es Ihnen?" }]
    }]
  }]
};
```

Wichtig: Wort-IDs sind Schlüssel für den Lernstand auf den Geräten des
Nutzers – bestehende IDs niemals ändern oder löschen, nur Tippfehler in
`hr`/`de`/`note`/`sentences` korrigieren.

## Struktur

- `index.html` – alle Views (Start, Lernen, Schreiben, Sätze, Wörter, Einstellungen)
- `js/app.js` – SRS (SM-2-Variante, Lernschritte 1 min/10 min), Übungsmodi, Speicher
- `css/style.css` – Design „Jadran“ (Kalkstein/Adriablau/Šahovnica-Rot), Dark Mode via prefers-color-scheme
- `data/vocab.js` – Vokabeldaten (siehe oben)
- `sw.js` – Offline-Cache; `CACHE`-Konstante bei App-Änderungen hochzählen
- `tools/make_icons.py` – Icons neu erzeugen (PIL)

## Testen

```bash
python3 -m http.server 8765 -d /home/arnealmighty/claude/rijeci
# dann http://localhost:8765 öffnen; node --check js/app.js für Syntax
```
