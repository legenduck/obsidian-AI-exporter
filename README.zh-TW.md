# Obsidian Chat Sync

[日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

將 Google Gemini、Claude AI、ChatGPT 和 Perplexity 的 AI 對話自動同步到你的 Obsidian 保管庫。

> Based on [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 功能特色

- **自動同步**：透過 MutationObserver 偵測新訊息，自動同步對話內容
- **狀態指示器**：彩色圓點顯示同步狀態（閒置 / 監視中 / 同步中 / 已同步 / 錯誤 / 已排除）
- **多平台支援**：Google Gemini、Claude AI、ChatGPT 和 Perplexity
- **JSON 樹匯出**：將對話分支儲存為 JSON 樹狀結構，並產生 LLM 最佳化的 Markdown
- **工作階段排除**：長按（2秒）指示器即可排除工作階段並刪除相關檔案
- **Deep Research**：匯出 Gemini Deep Research 和 Claude Extended Thinking 報告
- **Artifact 支援**：擷取 Claude Artifacts，包含行內引用和來源
- **工具內容**：可選擇將 Claude 的網路搜尋結果以可摺疊標註方式呈現
- **附加模式**：僅將新訊息加入現有筆記中
- **路徑範本**：在保管庫路徑中使用 `{platform}`、`{year}`、`{month}`、`{weekday}`、`{title}`、`{sessionId}`
- **多種輸出方式**：儲存到 Obsidian、下載為檔案或複製到剪貼簿
- **Obsidian 標註格式**：使用 `[!QUESTION]` 和 `[!NOTE]` 標註 + YAML frontmatter

## 系統需求

- Google Chrome 88+（或基於 Chromium 的瀏覽器）
- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 外掛

## 安裝

1. 複製此儲存庫：
   ```bash
   git clone https://github.com/legenduck/obsidian-chat-sync.git
   cd obsidian-chat-sync
   ```

2. 安裝相依套件並建置：
   ```bash
   npm install
   npm run build
   ```

3. 在 Chrome 中載入：
   - 前往 `chrome://extensions`
   - 啟用「開發人員模式」
   - 點選「載入未封裝項目」
   - 選擇 `dist/` 資料夾

## 設定

1. 在 Obsidian 中安裝 [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 外掛
2. 啟用該外掛並複製你的 API 金鑰
3. 點選 Chrome 中的擴充功能圖示，輸入以下資訊：
   - **API Key**：你的 Local REST API 金鑰
   - **Port**：預設為 `27123`
   - **Vault Path**：保管庫中的資料夾路徑（例如 `AI/{platform}`）

## 使用方式

### 基本使用

1. 在任意支援的平台上開啟一個對話
2. 右下角會出現一個小狀態圓點
3. 點擊圓點即可將對話同步到 Obsidian

### 自動同步

在設定中啟用後，新訊息出現時對話會自動同步，無需手動點擊。

### 工作階段排除

長按狀態圓點 2 秒即可排除工作階段：
- 橘色閃爍表示正在刪除檔案（md、JSON 樹、LLM Markdown）
- 黃色圓點 = 已排除
- 點擊黃色圓點可恢復同步

### Deep Research / Extended Thinking

支援 Gemini Deep Research 面板和 Claude Artifacts（含行內引用）。

## 輸出格式

對話以 Markdown 格式儲存，包含 YAML frontmatter 和 Obsidian 標註：

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

## 架構

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ 擷取對話 / Deep Research / Artifacts
Background Service Worker
    ↓ 傳送到 Obsidian
Obsidian Local REST API (127.0.0.1:27123)
```

| 元件 | 說明 |
|------|------|
| `src/content/` | 用於 DOM 擷取和 UI 的內容腳本 |
| `src/content/auto-sync.ts` | 基於 MutationObserver 的自動同步 |
| `src/content/extractors/` | 平台專用擷取器（Gemini、Claude、ChatGPT、Perplexity） |
| `src/background/` | 用於 API 通訊的 Service Worker |
| `src/popup/` | 設定介面 |
| `src/lib/tree-builder.ts` | 對話樹建構器（保留分支的 JSON） |
| `src/lib/tree-to-markdown.ts` | 樹狀結構轉 LLM 最佳化縮排 Markdown |

## 開發

```bash
npm run dev          # 帶 HMR 的開發伺服器
npm run build        # 正式建置
npm run lint         # ESLint
npm run format       # Prettier
npm test             # 執行測試
npm run test:coverage # 含覆蓋率的測試
```

## 安全性與隱私

- API 金鑰儲存在本機 `chrome.storage.local` 中（不會同步）
- 僅與本機 Obsidian 實例通訊（127.0.0.1）
- 輸入驗證、路徑遍歷防護、傳送者驗證
- 不蒐集資料，不向外部傳輸

## 授權條款

MIT — 詳見 [LICENSE](LICENSE)

## 致謝

本專案基於 [sho7650](https://github.com/sho7650) 的 [obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)。
