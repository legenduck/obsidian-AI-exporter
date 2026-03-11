# Obsidian Chat Sync

[日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

Auto-sync AI conversations from Google Gemini, Claude AI, ChatGPT, and Perplexity to your Obsidian vault.

> Based on [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Auto-sync**: Automatically syncs conversations as new messages appear via MutationObserver
- **Status indicator**: Color-coded dot shows sync state (idle / watching / syncing / synced / error / excluded)
- **Multi-platform**: Google Gemini, Claude AI, ChatGPT, and Perplexity
- **JSON Tree Export**: Save conversation branches as JSON tree with LLM-optimized markdown
- **Session exclusion**: Long-press (2s) the indicator to exclude a session and delete its files
- **Deep Research**: Export Gemini Deep Research and Claude Extended Thinking reports
- **Artifact support**: Extract Claude Artifacts with inline citations and sources
- **Tool content**: Optionally include Claude's web search results as collapsible callouts
- **Append mode**: Only new messages are added to existing notes
- **Path templates**: Use `{platform}`, `{year}`, `{month}`, `{weekday}`, `{title}`, `{sessionId}` in vault path
- **Multiple outputs**: Save to Obsidian, download as file, or copy to clipboard
- **Obsidian callouts**: Formatted with `[!QUESTION]` and `[!NOTE]` callouts + YAML frontmatter

## Requirements

- Google Chrome 88+ (or Chromium-based browser)
- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/legenduck/obsidian-chat-sync.git
   cd obsidian-chat-sync
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Load in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

## Setup

1. Install the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin in Obsidian
2. Enable the plugin and copy your API key
3. Click the extension icon in Chrome and enter:
   - **API Key**: Your Local REST API key
   - **Port**: Default is `27123`
   - **Vault Path**: Folder path in your vault (e.g., `AI/{platform}`)

## Usage

### Basic

1. Open a conversation on any supported platform
2. A small status dot appears in the bottom-right corner
3. Click the dot to sync the conversation to Obsidian

### Auto-sync

When enabled in settings, conversations sync automatically as new messages appear. No manual clicking needed.

### Session Exclusion

Long-press the status dot for 2 seconds to exclude a session:
- Orange blink while deleting files (md, JSON tree, LLM markdown)
- Yellow dot = excluded
- Click yellow dot to resume syncing

### Deep Research / Extended Thinking

Works with Gemini Deep Research panels and Claude Artifacts with inline citations.

## Output Format

Conversations are saved as Markdown with YAML frontmatter and Obsidian callouts:

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

## Architecture

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ extracts conversation / Deep Research / Artifacts
Background Service Worker
    ↓ sends to Obsidian
Obsidian Local REST API (127.0.0.1:27123)
```

| Component | Description |
|-----------|-------------|
| `src/content/` | Content script for DOM extraction and UI |
| `src/content/auto-sync.ts` | MutationObserver-based auto-sync |
| `src/content/extractors/` | Platform-specific extractors (Gemini, Claude, ChatGPT, Perplexity) |
| `src/background/` | Service worker for API communication |
| `src/popup/` | Settings UI |
| `src/lib/tree-builder.ts` | Conversation tree builder (branch-preserving JSON) |
| `src/lib/tree-to-markdown.ts` | Tree to LLM-optimized indent markdown |

## Development

```bash
npm run dev          # Dev server with HMR
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Run tests
npm run test:coverage # Tests with coverage
```

## Security & Privacy

- API key stored locally in `chrome.storage.local` (not synced)
- Only communicates with your local Obsidian instance (127.0.0.1)
- Input validation, path traversal protection, sender verification
- No data collection or external transmission

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgements

This project is based on [obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter) by [sho7650](https://github.com/sho7650).
