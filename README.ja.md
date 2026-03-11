# Obsidian Chat Sync

日本語 | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

Google Gemini、Claude AI、ChatGPT、Perplexity の AI 会話を Obsidian Vault に自動同期する Chrome 拡張機能です。

> Based on [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 機能

- **自動同期**: MutationObserver により新しいメッセージが表示されると自動的に会話を同期
- **ステータスインジケーター**: 同期状態を色分けドットで表示（idle / watching / syncing / synced / error / excluded）
- **マルチプラットフォーム**: Google Gemini、Claude AI、ChatGPT、Perplexity に対応
- **JSON Tree Export**: 会話の分岐を JSON ツリーとして保存し、LLM 最適化 Markdown も生成
- **セッション除外**: ステータスドットを2秒長押しでセッションを除外し、関連ファイルを削除
- **Deep Research**: Gemini Deep Research および Claude Extended Thinking レポートのエクスポート
- **Artifact 対応**: Claude Artifacts のインライン引用とソースを抽出
- **ツールコンテンツ**: Claude のウェブ検索結果を折りたたみ可能なコールアウトとして表示（オプション）
- **追記モード**: 既存のノートには新しいメッセージのみ追加
- **パステンプレート**: Vault パスに `{platform}`、`{year}`、`{month}`、`{weekday}`、`{title}`、`{sessionId}` を使用可能
- **複数の出力先**: Obsidian への保存、ファイルダウンロード、クリップボードへのコピー
- **Obsidian コールアウト**: `[!QUESTION]` と `[!NOTE]` コールアウト + YAML frontmatter でフォーマット

## 動作要件

- Google Chrome 88+（または Chromium ベースのブラウザ）
- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) プラグイン

## インストール

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/legenduck/obsidian-chat-sync.git
   cd obsidian-chat-sync
   ```

2. 依存パッケージのインストールとビルド:
   ```bash
   npm install
   npm run build
   ```

3. Chrome に読み込み:
   - `chrome://extensions` を開く
   - 「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist/` フォルダを選択

## セットアップ

1. Obsidian に [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) プラグインをインストール
2. プラグインを有効化し、API キーをコピー
3. Chrome の拡張機能アイコンをクリックして以下を入力:
   - **API Key**: Local REST API のキー
   - **Port**: デフォルトは `27123`
   - **Vault Path**: Vault 内のフォルダパス（例: `AI/{platform}`）

## 使い方

### 基本操作

1. 対応プラットフォームで会話を開く
2. 右下にステータスドットが表示される
3. ドットをクリックして会話を Obsidian に同期

### 自動同期

設定で有効にすると、新しいメッセージが表示されるたびに自動的に同期されます。手動クリックは不要です。

### セッション除外

ステータスドットを2秒長押しでセッションを除外:
- ファイル削除中はオレンジ色に点滅（md、JSON ツリー、LLM Markdown）
- 黄色ドット = 除外済み
- 黄色ドットをクリックすると同期を再開

### Deep Research / Extended Thinking

Gemini Deep Research パネルおよび Claude Artifacts のインライン引用に対応しています。

## 出力フォーマット

会話は YAML frontmatter と Obsidian コールアウトを含む Markdown として保存されます:

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

## アーキテクチャ

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ 会話 / Deep Research / Artifacts を抽出
Background Service Worker
    ↓ Obsidian に送信
Obsidian Local REST API (127.0.0.1:27123)
```

| コンポーネント | 説明 |
|-----------|-------------|
| `src/content/` | DOM 抽出と UI のための Content Script |
| `src/content/auto-sync.ts` | MutationObserver ベースの自動同期 |
| `src/content/extractors/` | プラットフォーム別エクストラクター（Gemini、Claude、ChatGPT、Perplexity） |
| `src/background/` | API 通信用の Service Worker |
| `src/popup/` | 設定 UI |
| `src/lib/tree-builder.ts` | 会話ツリービルダー（分岐保持 JSON） |
| `src/lib/tree-to-markdown.ts` | ツリーから LLM 最適化インデント Markdown への変換 |

## 開発

```bash
npm run dev          # HMR 付き開発サーバー
npm run build        # プロダクションビルド
npm run lint         # ESLint
npm run format       # Prettier
npm test             # テスト実行
npm run test:coverage # カバレッジ付きテスト
```

## セキュリティとプライバシー

- API キーは `chrome.storage.local` にローカル保存（同期なし）
- ローカルの Obsidian インスタンス（127.0.0.1）とのみ通信
- 入力バリデーション、パストラバーサル保護、送信元検証
- データ収集や外部送信は一切なし

## ライセンス

MIT — [LICENSE](LICENSE) を参照

## 謝辞

This project is based on [obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter) by [sho7650](https://github.com/sho7650).
