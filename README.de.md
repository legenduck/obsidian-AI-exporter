# Obsidian Chat Sync

[日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Español](README.es.md) | [Français](README.fr.md) | **Deutsch**

Automatische Synchronisierung von KI-Unterhaltungen aus Google Gemini, Claude AI, ChatGPT und Perplexity in deinen Obsidian-Tresor.

> Based on [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Funktionen

- **Automatische Synchronisierung**: Synchronisiert Unterhaltungen automatisch, wenn neue Nachrichten über MutationObserver erscheinen
- **Statusanzeige**: Farbcodierter Punkt zeigt den Synchronisierungsstatus an (inaktiv / beobachtend / synchronisierend / synchronisiert / Fehler / ausgeschlossen)
- **Multiplattform**: Google Gemini, Claude AI, ChatGPT und Perplexity
- **JSON-Baum-Export**: Speichert Unterhaltungszweige als JSON-Baum mit LLM-optimiertem Markdown
- **Sitzungsausschluss**: Langes Drücken (2s) auf den Indikator schließt eine Sitzung aus und löscht ihre Dateien
- **Deep Research**: Exportiert Gemini Deep Research- und Claude Extended Thinking-Berichte
- **Artifact-Unterstützung**: Extrahiert Claude Artifacts mit Inline-Zitaten und Quellen
- **Tool-Inhalte**: Optionale Einbindung der Websuchergebnisse von Claude als einklappbare Callouts
- **Anfügemodus**: Nur neue Nachrichten werden zu bestehenden Notizen hinzugefügt
- **Pfadvorlagen**: Verwende `{platform}`, `{year}`, `{month}`, `{weekday}`, `{title}`, `{sessionId}` im Tresorpfad
- **Mehrere Ausgaben**: Speichern in Obsidian, als Datei herunterladen oder in die Zwischenablage kopieren
- **Obsidian-Callouts**: Formatiert mit `[!QUESTION]`- und `[!NOTE]`-Callouts + YAML-Frontmatter

## Voraussetzungen

- Google Chrome 88+ (oder Chromium-basierter Browser)
- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)-Plugin

## Installation

1. Klone dieses Repository:
   ```bash
   git clone https://github.com/legenduck/obsidian-chat-sync.git
   cd obsidian-chat-sync
   ```

2. Installiere die Abhängigkeiten und baue das Projekt:
   ```bash
   npm install
   npm run build
   ```

3. In Chrome laden:
   - Navigiere zu `chrome://extensions`
   - Aktiviere den „Entwicklermodus"
   - Klicke auf „Entpackte Erweiterung laden"
   - Wähle den `dist/`-Ordner aus

## Einrichtung

1. Installiere das [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)-Plugin in Obsidian
2. Aktiviere das Plugin und kopiere deinen API-Schlüssel
3. Klicke auf das Erweiterungssymbol in Chrome und gib ein:
   - **API-Schlüssel**: Dein Local REST API-Schlüssel
   - **Port**: Standard ist `27123`
   - **Tresorpfad**: Ordnerpfad in deinem Tresor (z.B. `AI/{platform}`)

## Verwendung

### Grundlagen

1. Öffne eine Unterhaltung auf einer unterstützten Plattform
2. Ein kleiner Statuspunkt erscheint in der unteren rechten Ecke
3. Klicke auf den Punkt, um die Unterhaltung mit Obsidian zu synchronisieren

### Automatische Synchronisierung

Wenn in den Einstellungen aktiviert, werden Unterhaltungen automatisch synchronisiert, sobald neue Nachrichten erscheinen. Kein manuelles Klicken erforderlich.

### Sitzungsausschluss

Halte den Statuspunkt 2 Sekunden lang gedrückt, um eine Sitzung auszuschließen:
- Oranges Blinken während der Dateilöschung (md, JSON-Baum, LLM-Markdown)
- Gelber Punkt = ausgeschlossen
- Klicke auf den gelben Punkt, um die Synchronisierung fortzusetzen

### Deep Research / Extended Thinking

Funktioniert mit Gemini Deep Research-Panels und Claude Artifacts mit Inline-Zitaten.

## Ausgabeformat

Unterhaltungen werden als Markdown mit YAML-Frontmatter und Obsidian-Callouts gespeichert:

```markdown
---
id: gemini_abc123
title: "How to implement authentication"
source: gemini
url: https://gemini.google.com/app/abc123
created: 2025-01-10T12:00:00Z
tags:
  - ai-conversation
  - gemini
message_count: 4
---

> [!QUESTION] User
> How do I implement JWT authentication?

> [!NOTE] Gemini
> To implement JWT authentication, you'll need to...
```

## Architektur

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ extrahiert Unterhaltung / Deep Research / Artifacts
Background Service Worker
    ↓ sendet an Obsidian
Obsidian Local REST API (127.0.0.1:27123)
```

| Komponente | Beschreibung |
|-----------|-------------|
| `src/content/` | Content Script für DOM-Extraktion und Benutzeroberfläche |
| `src/content/auto-sync.ts` | MutationObserver-basierte automatische Synchronisierung |
| `src/content/extractors/` | Plattformspezifische Extractors (Gemini, Claude, ChatGPT, Perplexity) |
| `src/background/` | Service Worker für API-Kommunikation |
| `src/popup/` | Einstellungsoberfläche |
| `src/lib/tree-builder.ts` | Unterhaltungsbaum-Builder (verzweigungserhaltender JSON) |
| `src/lib/tree-to-markdown.ts` | Baum zu LLM-optimiertem eingerücktem Markdown |

## Entwicklung

```bash
npm run dev          # Entwicklungsserver mit HMR
npm run build        # Produktions-Build
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Tests ausführen
npm run test:coverage # Tests mit Abdeckung
```

## Sicherheit und Datenschutz

- Der API-Schlüssel wird lokal in `chrome.storage.local` gespeichert (nicht synchronisiert)
- Kommuniziert nur mit deiner lokalen Obsidian-Instanz (127.0.0.1)
- Eingabevalidierung, Schutz vor Path Traversal, Absenderüberprüfung
- Keine Datenerfassung oder externe Übertragung

## Lizenz

MIT — siehe [LICENSE](LICENSE)

## Danksagungen

Dieses Projekt basiert auf [obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter) von [sho7650](https://github.com/sho7650).
