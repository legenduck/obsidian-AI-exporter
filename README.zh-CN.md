# Obsidian Chat Sync

[日本語](README.ja.md) | [한국어](README.ko.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

将 Google Gemini、Claude AI、ChatGPT 和 Perplexity 的 AI 对话自动同步到你的 Obsidian 仓库。

> Based on [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 功能特性

- **自动同步**：通过 MutationObserver 检测新消息，自动同步对话内容
- **状态指示器**：彩色圆点显示同步状态（空闲 / 监视中 / 同步中 / 已同步 / 错误 / 已排除）
- **多平台支持**：Google Gemini、Claude AI、ChatGPT 和 Perplexity
- **JSON 树导出**：将对话分支保存为 JSON 树结构，并生成 LLM 优化的 Markdown
- **会话排除**：长按（2秒）指示器即可排除会话并删除相关文件
- **Deep Research**：导出 Gemini Deep Research 和 Claude Extended Thinking 报告
- **Artifact 支持**：提取 Claude Artifacts，包含内联引用和来源
- **工具内容**：可选择将 Claude 的网络搜索结果作为可折叠标注展示
- **追加模式**：仅将新消息添加到现有笔记中
- **路径模板**：在仓库路径中使用 `{platform}`、`{year}`、`{month}`、`{weekday}`、`{title}`、`{sessionId}`
- **多种输出方式**：保存到 Obsidian、下载为文件或复制到剪贴板
- **Obsidian 标注格式**：使用 `[!QUESTION]` 和 `[!NOTE]` 标注 + YAML frontmatter

## 系统要求

- Google Chrome 88+（或基于 Chromium 的浏览器）
- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 插件

## 安装

1. 克隆此仓库：
   ```bash
   git clone https://github.com/legenduck/obsidian-chat-sync.git
   cd obsidian-chat-sync
   ```

2. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```

3. 在 Chrome 中加载：
   - 打开 `chrome://extensions`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `dist/` 文件夹

## 配置

1. 在 Obsidian 中安装 [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 插件
2. 启用该插件并复制你的 API 密钥
3. 点击 Chrome 中的扩展图标，输入以下信息：
   - **API Key**：你的 Local REST API 密钥
   - **Port**：默认为 `27123`
   - **Vault Path**：仓库中的文件夹路径（例如 `AI/{platform}`）

## 使用方法

### 基本使用

1. 在任意支持的平台上打开一个对话
2. 右下角会出现一个小状态圆点
3. 点击圆点即可将对话同步到 Obsidian

### 自动同步

在设置中启用后，新消息出现时对话会自动同步，无需手动点击。

### 会话排除

长按状态圆点 2 秒即可排除会话：
- 橙色闪烁表示正在删除文件（md、JSON 树、LLM Markdown）
- 黄色圆点 = 已排除
- 点击黄色圆点可恢复同步

### Deep Research / Extended Thinking

支持 Gemini Deep Research 面板和 Claude Artifacts（含内联引用）。

## 输出格式

对话以 Markdown 格式保存，包含 YAML frontmatter 和 Obsidian 标注：

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

## 架构

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ 提取对话 / Deep Research / Artifacts
Background Service Worker
    ↓ 发送到 Obsidian
Obsidian Local REST API (127.0.0.1:27123)
```

| 组件 | 说明 |
|------|------|
| `src/content/` | 用于 DOM 提取和 UI 的内容脚本 |
| `src/content/auto-sync.ts` | 基于 MutationObserver 的自动同步 |
| `src/content/extractors/` | 平台专用提取器（Gemini、Claude、ChatGPT、Perplexity） |
| `src/background/` | 用于 API 通信的 Service Worker |
| `src/popup/` | 设置界面 |
| `src/lib/tree-builder.ts` | 对话树构建器（保留分支的 JSON） |
| `src/lib/tree-to-markdown.ts` | 树结构转 LLM 优化缩进 Markdown |

## 开发

```bash
npm run dev          # 带 HMR 的开发服务器
npm run build        # 生产构建
npm run lint         # ESLint
npm run format       # Prettier
npm test             # 运行测试
npm run test:coverage # 带覆盖率的测试
```

## 安全与隐私

- API 密钥存储在本地 `chrome.storage.local` 中（不会同步）
- 仅与本地 Obsidian 实例通信（127.0.0.1）
- 输入验证、路径遍历防护、发送者验证
- 不收集数据，不向外部传输

## 许可证

MIT — 详见 [LICENSE](LICENSE)

## 致谢

本项目基于 [sho7650](https://github.com/sho7650) 的 [obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)。
