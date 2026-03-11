# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian Chat Sync — Chrome Extension that auto-syncs AI conversations from Google Gemini, Claude AI, ChatGPT, and Perplexity to Obsidian via the Local REST API. Built with CRXJS + Vite + TypeScript. Forked from [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter).

## ⚠️ Absolute Rules

### 🚫 NEVER (Absolutely Forbidden)

The following are **forbidden under any circumstances**. No exceptions. No context override.

#### Documentation

- **NEVER** create project-related docs under `~/.claude/`
- **NEVER** place design docs in global directories
- **NEVER** create files in `~/.claude/plans/` even in Plan mode

#### Assumptions

- **NEVER** say "should be" or "probably" without verifying server state
- **NEVER** assume current state based on past information
- **NEVER** assert "already done" without verification
- **NEVER** apply "best practices" without validation
- **NEVER** speculate on the cause of a failure — read the actual output first
- **NEVER** dismiss a failure or problem as "cascading" or "unrelated" without evidence

#### Implementation

- **NEVER** generate code before plan approval
- **NEVER** expand scope during execution phase
- **NEVER** guess configuration parameters
- **NEVER** try alternatives without error analysis
- **NEVER** modify files directly on the main branch

### ✅ ALWAYS (Mandatory Actions)

The following are **always required**. No shortcuts.

#### Verification

- **ALWAYS** follow: "I'll check" → actually check → report results
- **ALWAYS** say "verification needed" when uncertain
- **ALWAYS** read ALL details of a problem before attempting a fix
- **ALWAYS** confirm every issue independently — never assume one problem explains another
- **ALWAYS** ask the user before making any decision that has alternatives — merge strategy, file deletion, scope of changes, etc.

#### Documentation

- **ALWAYS** place project docs under `docs/`
- **ALWAYS** document reasons for config changes in comments
- **ALWAYS** create ADR for significant config changes

#### Implementation Process

- **ALWAYS** output [PLAN] before implementation
- **ALWAYS** wait for explicit approval before execution
- **ALWAYS** follow approved plan strictly
- **ALWAYS** output progress for each step
- **ALWAYS** Create a branch with an appropriate name and switch to it before making any modifications

**ADR Guide:**

- Location: `docs/adr/`
- Naming: `NNN-<topic>.md`

## Commands

```bash
npm run build    # TypeScript check + Vite production build
npm run dev      # Vite dev server with HMR
npm run lint     # ESLint on src/
npm run format   # Prettier formatting
```

Load the extension in Chrome: `chrome://extensions` → Load unpacked → select `dist/` folder

## Architecture

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ extracts conversation / Deep Research / Artifacts
Background Service Worker
    ↓ sends to Obsidian
Obsidian Local REST API (127.0.0.1:27123)
```

### Key Components

| Path                               | Purpose                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `src/content/extractors/gemini.ts` | DOM extraction for Gemini conversations & Deep Research    |
| `src/content/extractors/claude.ts` | DOM extraction for Claude conversations & Artifacts        |
| `src/content/extractors/base.ts`   | Abstract extractor with selector fallback & title helpers  |
| `src/content/markdown.ts`          | HTML→Markdown via Turndown with custom rules               |
| `src/content/auto-sync.ts`         | MutationObserver auto-sync (debounced DOM change detection)|
| `src/content/ui.ts`                | Status dot indicator & toast notifications                 |
| `src/lib/obsidian-api.ts`          | REST API client for Obsidian (get/put/delete files + JSON) |
| `src/lib/path-utils.ts`            | Path security & template resolution (`{platform}`, `{year}`, etc.) |
| `src/lib/tree-builder.ts`          | Conversation tree builder (branch-preserving JSON)         |
| `src/lib/tree-to-markdown.ts`      | Tree → LLM-optimized indent markdown converter             |
| `src/lib/storage.ts`               | Chrome storage wrapper (settings, path tracking, exclusions)|
| `src/lib/types.ts`                 | Shared TypeScript interfaces                               |
| `src/background/index.ts`          | Service worker handling API calls & template resolution    |
| `src/background/obsidian-handlers.ts` | Save, delete, JSON tree handlers                        |
| `src/popup/`                       | Settings UI (toggle switches, collapsible advanced panel)  |

### Extractor Pattern

Extractors implement `IConversationExtractor` from `src/lib/types.ts`. The `BaseExtractor` provides:

- `queryWithFallback()` - tries multiple CSS selectors in priority order
- `queryAllWithFallback()` - same for querySelectorAll
- `sanitizeText()` - normalizes whitespace
- `getPageTitle()` - extracts title from `document.title` stripping platform suffixes
- `buildConversationResult()` - constructs `ExtractionResult` with common boilerplate
- `buildMetadata()` - builds `ConversationMetadata` from messages

### Vault Path Templates

Vault path supports template variables (default: `AI/{platform}`).
`resolvePathTemplate()` in `src/lib/path-utils.ts` resolves variables at save time.

Supported variables: `{platform}`, `{year}`, `{month}`, `{weekday}`, `{title}`, `{sessionId}`

### Status Dot & Auto-sync

The content script injects a color-coded status dot (`src/content/ui.ts`):
- **idle** (gray) → **watching** (blue) → **syncing** (blue pulse) → **synced** (green) → **watching**
- **error** (red) — click for details
- **deleting** (orange blink) → **excluded** (yellow) — long-press triggered session exclusion

Auto-sync (`src/content/auto-sync.ts`) uses MutationObserver with debouncing to detect new messages and AI response completion.

SPA navigation is detected via persistent URL polling (`watchForNavigation()` in `src/content/index.ts`).

### JSON Tree Export

When enabled, conversations are saved as branch-preserving JSON trees alongside LLM-optimized indent markdown:
- `src/lib/tree-builder.ts` — builds `ConversationTree` from `ConversationData`, content-hash based node IDs
- `src/lib/tree-to-markdown.ts` — converts tree to indented markdown with branch labels
- Files saved under `.json/` and `.llm/` dot-prefixed directories (hidden from Obsidian indexing)
- `mergeTree()` accumulates branches across syncs

### Session Exclusion

Long-press (2s) the status dot to exclude a session:
- Deletes tracked files (md, json, llm) via `ObsidianApiClient.deleteFile()`
- File paths tracked per conversation in `chrome.storage.local` (`paths:{convId}`)
- Excluded sessions stored in `chrome.storage.local` (`excludedSessions`)
- Click yellow dot to resume syncing

### DOM Selectors

**Gemini** uses Angular components. Key selectors in `gemini.ts`:

- `.conversation-container` - each Q&A turn
- `user-query` / `model-response` - Angular component tags
- `.query-text-line` - user message lines (multiple per query)
- `.markdown.markdown-main-panel` - assistant response content

**Claude** uses React components. Key selectors in `claude.ts`:

- `.whitespace-pre-wrap.break-words` - user message content
- `.font-claude-response` - assistant response content
- `#markdown-artifact` - Deep Research / Artifact content
- `span.inline-flex a[href^="http"]` - inline citations

When DOM changes, update `SELECTORS` in the respective extractor file.

## Output Format

Conversations are saved as Markdown with YAML frontmatter and Obsidian callouts:

```markdown
---
id: gemini_xxx
title: '...'
source: gemini
---

> [!QUESTION] User
> query text

> [!NOTE] Gemini
> response text
```

## Supported Platforms

- **Gemini** (`gemini.google.com`): Conversations and Deep Research reports
- **Claude** (`claude.ai`): Conversations, Extended Thinking, and Artifacts with inline citations
- **ChatGPT** (`chatgpt.com`): Conversations (including custom GPTs via `/g/` URLs)
- **Perplexity** (`www.perplexity.ai`): Conversations

## Adding New Platforms

When adding a new platform extractor:

1. Add platform to union types in `src/lib/types.ts` (`source`, `platform`)
2. Add platform to `BaseExtractor` in `src/content/extractors/base.ts`
3. Create new extractor class extending `BaseExtractor`
4. Add routing in `src/content/index.ts` (`getExtractor()`)
5. Update `waitForConversationContainer()` selectors if needed
6. **Add origin to `ALLOWED_ORIGINS` in `src/background/index.ts`** ← CRITICAL
7. Update `src/manifest.json`:
   - `host_permissions`
   - `content_scripts.matches`
8. Add DOM helpers and tests

## Future Platforms

Add new extractors by extending `BaseExtractor` and implementing `IConversationExtractor`.
