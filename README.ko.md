# Obsidian Chat Sync

[日本語](README.ja.md) | 한국어 | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

Google Gemini, Claude AI, ChatGPT, Perplexity의 AI 대화를 Obsidian 볼트에 자동 동기화합니다.

> Based on [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 기능

- **자동 동기화**: MutationObserver를 통해 새 메시지가 나타나면 자동으로 대화를 동기화
- **상태 인디케이터**: 동기화 상태를 색상으로 표시 (idle / watching / syncing / synced / error / excluded)
- **멀티 플랫폼**: Google Gemini, Claude AI, ChatGPT, Perplexity 지원
- **JSON Tree Export**: 대화 브랜치를 JSON 트리와 LLM 최적화 마크다운으로 저장
- **세션 제외**: 인디케이터를 2초간 길게 눌러 세션을 제외하고 파일을 삭제
- **Deep Research**: Gemini Deep Research 및 Claude Extended Thinking 보고서 내보내기
- **Artifact 지원**: Claude Artifact에서 인라인 인용 및 출처 추출
- **도구 콘텐츠**: Claude의 웹 검색 결과를 접을 수 있는 callout으로 포함 (선택 사항)
- **추가 모드**: 기존 노트에 새 메시지만 추가
- **경로 템플릿**: 볼트 경로에 `{platform}`, `{year}`, `{month}`, `{weekday}`, `{title}`, `{sessionId}` 사용 가능
- **다중 출력**: Obsidian에 저장, 파일로 다운로드, 클립보드에 복사
- **Obsidian callout**: `[!QUESTION]` 및 `[!NOTE]` callout과 YAML frontmatter로 포맷

## 요구 사항

- Google Chrome 88+ (또는 Chromium 기반 브라우저)
- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 플러그인

## 설치

1. 이 저장소를 클론합니다:
   ```bash
   git clone https://github.com/legenduck/obsidian-chat-sync.git
   cd obsidian-chat-sync
   ```

2. 의존성을 설치하고 빌드합니다:
   ```bash
   npm install
   npm run build
   ```

3. Chrome에 로드합니다:
   - `chrome://extensions`로 이동
   - "개발자 모드" 활성화
   - "압축해제된 확장 프로그램을 로드합니다" 클릭
   - `dist/` 폴더 선택

## 설정

1. Obsidian에 [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 플러그인을 설치합니다
2. 플러그인을 활성화하고 API 키를 복사합니다
3. Chrome에서 확장 프로그램 아이콘을 클릭하고 다음을 입력합니다:
   - **API Key**: Local REST API 키
   - **Port**: 기본값은 `27123`
   - **Vault Path**: 볼트 내 폴더 경로 (예: `AI/{platform}`)

## 사용법

### 기본 사용

1. 지원되는 플랫폼에서 대화를 엽니다
2. 우측 하단에 작은 상태 점이 나타납니다
3. 점을 클릭하면 대화가 Obsidian에 동기화됩니다

### 자동 동기화

설정에서 활성화하면 새 메시지가 나타날 때 자동으로 대화가 동기화됩니다. 수동 클릭이 필요 없습니다.

### 세션 제외

상태 점을 2초간 길게 누르면 세션을 제외할 수 있습니다:
- 파일 삭제 중 주황색 깜빡임 (md, JSON 트리, LLM 마크다운)
- 노란색 점 = 제외됨
- 노란색 점을 클릭하면 동기화 재개

### Deep Research / Extended Thinking

Gemini Deep Research 패널 및 인라인 인용이 포함된 Claude Artifact를 지원합니다.

## 출력 형식

대화는 YAML frontmatter와 Obsidian callout이 포함된 마크다운으로 저장됩니다:

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

## 아키텍처

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ 대화 / Deep Research / Artifact 추출
Background Service Worker
    ↓ Obsidian으로 전송
Obsidian Local REST API (127.0.0.1:27123)
```

| 컴포넌트 | 설명 |
|-----------|------|
| `src/content/` | DOM 추출 및 UI를 위한 Content Script |
| `src/content/auto-sync.ts` | MutationObserver 기반 자동 동기화 |
| `src/content/extractors/` | 플랫폼별 추출기 (Gemini, Claude, ChatGPT, Perplexity) |
| `src/background/` | API 통신을 위한 Service Worker |
| `src/popup/` | 설정 UI |
| `src/lib/tree-builder.ts` | 대화 트리 빌더 (브랜치 보존 JSON) |
| `src/lib/tree-to-markdown.ts` | 트리를 LLM 최적화 들여쓰기 마크다운으로 변환 |

## 개발

```bash
npm run dev          # HMR이 포함된 개발 서버
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm run format       # Prettier
npm test             # 테스트 실행
npm run test:coverage # 커버리지 포함 테스트
```

## 보안 및 개인정보

- API 키는 `chrome.storage.local`에 로컬 저장 (동기화되지 않음)
- 로컬 Obsidian 인스턴스(127.0.0.1)와만 통신
- 입력 검증, 경로 탐색 방지, 발신자 확인
- 데이터 수집 또는 외부 전송 없음

## 라이선스

MIT — [LICENSE](LICENSE) 참조

## 감사의 글

이 프로젝트는 [sho7650](https://github.com/sho7650)의 [obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)를 기반으로 합니다.
