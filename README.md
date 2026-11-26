# Quillmark

Einzeldatei-Web-App für das iPad: Screenshots → lokaler OCR-Text → (optional) lokale KI-Umformulierung →
echte Vektor-Handschrift auf einem Goodnotes-Blatt → Export als native `.goodnotes`-Datei oder Vektor-PDF.

Die gesamte App steckt in **`index.html`** (früherer Name: Tintenwerk; `Tintenwerk.html` leitet nur noch weiter).
Adresse: **https://elias296.github.io/Quillmark/**

## Kurzanleitung für das iPad Air (M2)

### 1. Kostenlos per HTTPS bereitstellen
`file://` reicht nicht: Safari schaltet dort WebGPU, Web-Worker (OCR) und „Zum Home-Bildschirm“ nicht bzw. nur eingeschränkt frei.

**GitHub Pages**
1. Repository auf GitHub öffnen → **Settings → Pages**.
2. *Source*: **Deploy from a branch**, Branch mit `index.html` wählen, Ordner `/ (root)` → **Save**.
3. Nach ca. einer Minute ist die App unter `https://<benutzername>.github.io/<repository>/` erreichbar.
   (Pages benötigt bei kostenlosen Konten ein öffentliches Repository.)

**Alternative Cloudflare Pages:** *Workers & Pages → Create → Pages → Upload assets*, Ordner mit `index.html`
hochladen → `https://<projekt>.pages.dev/`.

### 2. Zum Home-Bildschirm hinzufügen
Adresse in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“**. Quillmark startet danach im Vollbild.
Entwurf, Einstellungen und eigene Handschrift liegen nur im lokalen Browserspeicher – die Handschrift bitte
zusätzlich als JSON sichern (Schritt 2 → Sicherung).

### 3. Export in Goodnotes öffnen
1. **Exportieren → Native .goodnotes-Datei erzeugen**.
2. **„Teilen / in Goodnotes öffnen“** tippen und *Goodnotes* wählen – oder **„In ‚Dateien‘ sichern“**, die Datei in der
   Dateien-App antippen und über Teilen → *In Goodnotes öffnen*.
3. In Goodnotes **„Als neues Dokument importieren“**. Die Schrift besteht aus einzelnen Stiftstrichen
   (Lasso, Radierer und Farbwechsel funktionieren wie bei eigener Handschrift).

### Lokale KI (optional)
WebGPU ist in Safari ab iPadOS 26 aktiv (unter iPadOS 18: Einstellungen → Apps → Safari → Erweitert → Feature Flags → WebGPU).
Das Modell (ca. 480 MB) wird erst nach Tipp auf „Lokales KI-Modell laden“ geholt. Ohne KI funktioniert alles andere unverändert.

## Aufgaben lösen (Hausaufgaben-Helfer)
Tab **Text & KI** → Karte **Aufgaben lösen** (Einstellungen aufklappen): optionalen Namen für die Überschrift, Klasse und „Rechenweg zeigen“ einstellen, **Tizian** (so heißt die lokale KI) laden
(für Aufgaben wird **Besser · Qwen2.5-1.5B** empfohlen), dann **Buchseite(n) senden & lösen**.
Ablauf: Zuschnitt → lokale OCR → Aufgaben werden an Nummern („1.“, „2)“, „Aufgabe 3“) getrennt → reine Rechenzeilen (`345 + 678 =`) löst ein exakter
Rechner, alles andere die lokale KI → Vergleichsfenster (Aufgaben links, Lösungen rechts, beides bearbeitbar, „Erneut lösen“) → Übernahme als neue Notiz
oder angehängt (mit Undo) → Vektor-Handschrift im Goodnotes-Export.
Grenzen: nur Texterkennung (keine Bilder, Diagramme, Handschrift, Formeln), kleine Modelle machen Fehler; die Größenangaben der Modelle sind geschätzt
und das 1,5-B-Modell wurde nicht auf einem iPad getestet (Speicherbedarf!).

## Chat mit Tizian
Seitenleiste → **Chat**: frei mit Tizian schreiben, sich etwas erklären oder Aufgaben lösen lassen. Schnell-Aktionen:
**Lernzettel mit Skizze**, **Aufgaben lösen**, **Zusammenfassen**, **Quiz** (ohne Eingabe nutzen sie den Notiztext).
Unter jeder Antwort: **Als Notiz / Als Lernzettel übernehmen**, **Anhängen** (mit Undo) oder **Kopieren**. Die Kamera hängt Text
aus einem Foto an (Texterkennung). Reine Rechenzeilen (`12 + 30 =`) rechnet der exakte Rechner. Der Verlauf bleibt nur auf diesem Gerät.

## Lernzettel mit Skizzen und Bildern
Tizian ist ein Textmodell und kann keine Fotos erzeugen – dafür zeichnet Quillmark Skizzen als echte Handschrift-Striche:
- `[[Licht -> Chlorophyll -> Glucose]]` – Ablauf mit Kästen und Pfeilen (bricht bei Bedarf um)
- `[[Fotosynthese: Licht, Wasser, CO2, Glucose]]` – Mindmap
- **Bild in den Lernzettel einfügen** (Text & KI) setzt eigene Fotos als `![Bild](bild:…)` ein. In der Vorschau und im PDF erscheinen sie direkt;
  im `.goodnotes`-Export liegen sie im Seitenhintergrund (sichtbar, aber in Goodnotes nicht verschiebbar).

## Tizian auf einem Server (für Geräte, auf denen die lokale KI nicht startet)
Text & KI → Tizian → **Server statt lokal**: Adresse eintragen, **Verbindung testen**, dann **Text auf Server verarbeiten**
einschalten (standardmäßig aus, mit Datenschutz-Abfrage). Unterstützt wird jede OpenAI-kompatible Chat-Schnittstelle
(`/v1/chat/completions`, mit Streaming). Im Server-Modus gehen nur die Texte für Tizian an den Server; Handschrift,
Texterkennung und Export bleiben lokal.
Empfohlen (kostenlos, privat): **eigener Laptop** mit Ollama und Tailscale – `OLLAMA_ORIGINS=https://elias296.github.io` setzen,
Tailscale auf Laptop und iPad, auf dem Laptop `tailscale serve --bg 11434`, dann die `https://…ts.net`-Adresse und den Modellnamen
aus `ollama list` eintragen. Adressen im eigenen Netz (Tailscale, Heimnetz) zeigt die App als „Eigener Rechner“ an.
Alternative: OpenRouter (`https://openrouter.ai/api/v1`, Modelle mit `:free`, Tageslimit; Texte gehen an fremde Anbieter).
Die Vorlage in [`server/huggingface-space`](server/huggingface-space/README.md) braucht inzwischen ein kostenpflichtiges Hugging-Face-Abo (Docker-Spaces).

## Technische Eckdaten des .goodnotes-Exports (aus der Referenzdatei abgeleitet)
- ZIP (Deflate) mit `index.events.pb`, `index.notes.pb`, `index.attachments.pb`, `index.search.pb`, `notes/…`,
  `attachments/…` (Hintergrund-PDF), `search/…`, `thumbnail.jpg`, `schema.pb` (Schema 24).
- Stiftstriche: TPL `vuA(v)A(S(uu))A(S(uuuu))vA(f)` (quadratische Bézier-Segmente) im Apple-LZ4-Container `bv41 … bv4$`.
- **Stiftspeicher-UUID = Seiten-UUID + 1** für jede Seite.
- Hintergrund-PDF in echten PDF-Punkten (419,53 × 595,28); Stiftkoordinaten = PDF-Punkt × 11/6.
- Kein offizielles Format: künftige Goodnotes-Versionen können sich anders verhalten.

## Nachgeladene Quellen (nur bei Bedarf)
- Tesseract.js 7.0.0 inkl. `tesseract.js-core` und Sprachdaten `deu`/`eng` (cdn.jsdelivr.net) – OCR
- Transformers.js 4.3.2 (cdn.jsdelivr.net) und Modell `onnx-community/Qwen2.5-0.5B-Instruct` oder `…-1.5B-Instruct` (huggingface.co) – lokale KI

ZIP, LZ4, TPL, Protobuf und PDF sind in der Datei selbst implementiert; kein Tracking, kein Konto.

## Oberfläche
Dunkles Milchglas-Design (Schwarz/Grau); die drei Schritte und die Einstellungen liegen in der schwebenden Seitenleiste links.
Drei Schritte: **Text & KI** (Notiztext, Screenshot-Import, Tizian, Aufgaben lösen) · **Handschrift** (Schriftstil, Größe, Tinte;
bei „Meine eigene Handschrift“ zusätzlich das Zeichenstudio) · **Papier & Export** (Blattvorlage, Export, Selbsttest).
Details stehen hinter den ⓘ-Symbolen der Karten. Zoom und Seitenwechsel liegen in der Leiste unter dem Blatt.
Texterkennung: Sprachen im Zuschnitt-Fenster wählen (DE, EN, ES, FR, IT, LA). Jede Sprache wird einzeln erkannt, pro Wort gewinnt
das sicherste Ergebnis – so bleiben Akzente, ñ, ß und Umlaute erhalten. Zweispaltige Listen (z. B. Vokabeln) werden zu Tabellenzeilen.
Hochzahlen: `x^2`, `x2`, `cm3` werden zu x², x², cm³ (abschaltbar im ⓘ der Karte „Notiztext“).

## Entwicklung
- Quellen: `dev/src/` · Bauen: `dev/tools/build.sh` (schreibt `index.html`) · Tests: `node dev/tools/test.js`
- Browser-Tests (Playwright, lokaler Server auf Port 8765): `node dev/tools/e2e-ui.js`, `e2e-server.js`, `e2e-server-compat.js`, `e2e-server-private.js`, `e2e-cache.js`, `e2e-solver.js`, `e2e-chat.js`
- Texterkennung mit echten Sprachdaten: `TESS_PK=<ordner> node dev/tools/e2e-ocr.js` (benötigte Pakete stehen im Kopf der Datei)
- `dev/tools/shape.py` vergleicht eine erzeugte `.goodnotes` strukturell mit einer Referenzdatei (`python3 -I dev/tools/shape.py ref.goodnotes out.goodnotes`).
- Änderungen immer in `dev/src/` machen und neu bauen, nicht in `index.html`.
