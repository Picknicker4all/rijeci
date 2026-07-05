# Riječi 🟥⬜ – Kroatisch lernen

Persönlicher Kroatisch-Deutsch-Vokabeltrainer als schlanke Web-App (PWA).

- **Lernen**: Karteikarten mit Spaced Repetition (Wiederholung im richtigen Moment), beide Richtungen
- **Schreiben**: Kroatisch tippen mit č ć đ š ž-Tastenleiste
- **Sätze**: Lückentext-Übungen mit den gelernten Wörtern
- **Wörter**: alle Lektionen durchsuchen, eigene Vokabeln ergänzen
- Läuft am PC im Browser und am Handy als installierte App, komplett offline-fähig
- Lernstand bleibt lokal auf dem Gerät (Sicherung über Einstellungen → Export)

Neue Vokabellisten aus dem Kurs werden mit Claude Code eingepflegt
(siehe `CLAUDE.md`), inklusive automatisch generierter Beispielsätze und
passender Zusatzvokabeln.

## Lokal starten

```bash
python3 -m http.server 8765
```

Dann <http://localhost:8765> öffnen.
