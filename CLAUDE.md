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

Die Reihenfolge der Lektionen im Array ist die **Lernreihenfolge**
(chronologisch nach Kursdatum). Die Lektionsnummer im `name` folgt der
Array-Position, die `id`/Wort-IDs bleiben davon unabhängig und stabil.
Neue Lektionen: nächste freie `id` (l10, l11 …) vergeben und an der
chronologisch richtigen Stelle einsortieren, Namen neu durchnummerieren.

Kursvarianten: Standardkroatisch ist die Hauptform (`hr`), serbische/
bosnische Varianten aus dem Kurs als Notiz (z.B. nogomet/fudbal).

SRS-Regeln in app.js: Neue Wörter starten nur HR→DE; DE→HR wird erst
eingeführt, wenn die HR→DE-Karte graduiert ist. Pro Wort erscheint
höchstens eine Richtung pro Sitzung (Geschwisterkarten-Schutz).

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

Datenvalidierung nach jedem Import (IDs eindeutig, Lücken korrekt):

```bash
node -e "
const w={}; global.window=w; require('./data/vocab.js');
let n=0, ids=new Set(), errs=[];
for (const l of w.VOCAB.lessons) for (const word of l.words) {
  n++; if (ids.has(word.id)) errs.push('doppelt: '+word.id); ids.add(word.id);
  for (const s of (word.sentences||[])) if ((s.hr.match(/\*/g)||[]).length!==2) errs.push('Lücke: '+word.id);
}
console.log(n, 'Wörter ·', errs.length ? errs.join(', ') : 'OK');"
```

Screenshots: `HOME=<scratchpad> firefox --headless --screenshot out.png
--window-size=420,900 <url>` – Achtung: Einblend-Animation vorher per
Style-Override abschalten, sonst wirken Karten leer. Beim Beenden des
Testservers `pkill`-Muster wählen, das nicht den eigenen Befehl matcht.

## Veröffentlichen

- Live-URL: **https://picknicker4all.github.io/rijeci/**
- GitHub: `Picknicker4all/rijeci` (öffentlich), Pages von `main`, Pfad `/`
- `gh` liegt in `~/.local/bin/gh` (ohne sudo installiert), Auth via Keyring
- Deploy = einfach committen und pushen; danach prüfen:
  `curl -s https://picknicker4all.github.io/rijeci/data/vocab.js | grep version`
  (Pages braucht ~30–60 s)
- Mitlernende nutzen dieselbe URL; Lernstand ist immer lokal pro Gerät.
- Git-Identität ist repo-lokal konfiguriert (user.email/user.name).
