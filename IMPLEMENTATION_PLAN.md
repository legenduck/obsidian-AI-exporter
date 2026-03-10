# obsidian-AI-exporter: JSON Tree Export 추가 구현 계획

## 프로젝트 개요

**목적**: 기존 단일 브랜치 .md 파이프라인을 유지하면서, 대화 브랜치를 보존하는 JSON 트리 저장 + LLM용 인덴트 마크다운 변환 기능을 평행으로 추가

**원칙**: 기존 코드 최소 변경. 새 기능은 새 파일로 추가.

**레포**: https://github.com/sho7650/obsidian-AI-exporter (fork하여 작업)

---

## 현재 아키텍처 (변경 없음)

```
Content Script (claude.ai 등)
  ↓ extractMessages() → ConversationMessage[]
  ↓ conversationToNote() → ObsidianNote (.md body)
  ↓ generateNoteContent() → 최종 .md 문자열
  ↓ executeOutput() → obsidian / file / clipboard
```

### 핵심 데이터 흐름 지점

| 파일 | 함수 | 역할 | 변경 여부 |
|------|------|------|-----------|
| `src/content/extractors/claude.ts` | `extractMessages()` | DOM → `ConversationMessage[]` | **수정 (parent 추가)** |
| `src/content/extractors/base.ts` | `buildConversationResult()` | messages → `ExtractionResult` | 변경 없음 |
| `src/content/markdown.ts` | `conversationToNote()` | data → `ObsidianNote` (.md) | 변경 없음 |
| `src/content/index.ts` | `handleSync()` | 전체 sync 오케스트레이션 | **수정 (json 분기 추가)** |
| `src/background/output-handlers.ts` | `executeOutput()` | 실제 저장 실행 | **수정 (json 케이스 추가)** |
| `src/lib/types.ts` | 타입 정의 | 공유 인터페이스 | **수정 (타입 추가)** |
| `src/lib/storage.ts` | `getSettings()` / `saveSettings()` | 설정 관리 | **수정 (json 토글 추가)** |
| `src/popup/index.ts` + `index.html` | 설정 UI | popup 토글 | **수정 (UI 추가)** |

---

## 추가할 아키텍처

```
Content Script
  ↓ extractMessages() → ConversationMessage[] (parent 포함)
  ↓
  ├→ [기존] conversationToNote() → .md → Obsidian/File/Clipboard
  │
  └→ [신규] buildConversationTree() → TreeJSON
       ↓
       ├→ saveTreeJSON() → .json 파일 저장
       └→ treeToIndentMarkdown() → LLM용 .md 생성 (후처리)
```

---

## Phase 1: 타입 확장

### 파일: `src/lib/types.ts`

**수정 목적**: ConversationMessage에 parent 필드 추가, JSON 트리 관련 타입 정의

```typescript
// 기존 ConversationMessage에 추가
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlContent?: string;
  toolContent?: string;
  timestamp?: Date;
  index: number;
  parent?: string | null;    // ← 추가: 부모 메시지 ID (브랜치 추적용)
  children?: string[];       // ← 추가: 자식 메시지 ID 배열
}

// 새로 추가할 타입
export interface ConversationTree {
  id: string;
  title: string;
  source: AIPlatform;
  url: string;
  created: string;
  modified: string;
  activePath: string[];      // 현재 보고 있는 경로의 메시지 ID 배열
  tree: Record<string, TreeNode>;
}

export interface TreeNode {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parent: string | null;
  children: string[];
  toolContent?: string;
  timestamp?: string;
}

// OutputDestination 확장
export type OutputDestination = 'obsidian' | 'file' | 'clipboard' | 'json';

// OutputOptions 확장
export interface OutputOptions {
  obsidian: boolean;
  file: boolean;
  clipboard: boolean;
  json: boolean;              // ← 추가
}

// SyncSettings 확장
export interface SyncSettings {
  // ... 기존 필드 유지
  enableJsonTree: boolean;    // ← 추가
  jsonOutputPath: string;     // ← 추가: JSON 저장 경로 (기본: 'AI/json/{platform}')
}
```

**주의**: `parent`는 optional (`?`)로 추가하므로 기존 코드에서 이 필드를 사용하지 않는 부분은 영향 없음.

---

## Phase 2: 트리 빌더 모듈 (신규 파일)

### 파일: `src/lib/tree-builder.ts` (신규 생성)

**목적**: `ConversationMessage[]` → `ConversationTree` 변환 + JSON merge 로직

```typescript
/**
 * Tree Builder
 * 
 * ConversationMessage[] → ConversationTree 변환
 * 기존 JSON과 merge하여 브랜치 누적 저장
 */

export function buildConversationTree(
  data: ConversationData
): ConversationTree;

export function mergeTree(
  existing: ConversationTree,
  incoming: ConversationTree
): ConversationTree;

export function serializeTree(
  tree: ConversationTree
): string;  // JSON.stringify with 2-space indent
```

#### buildConversationTree 로직

```
1. data.messages를 순회
2. 각 메시지에 대해 TreeNode 생성
   - parent: msg.parent ?? 직전 메시지 ID (선형 대화의 경우)
   - children: 다음 메시지 ID (나중에 merge로 추가됨)
3. activePath: 현재 메시지 ID 배열 (순서대로)
4. 메타데이터 (id, title, source 등) 첨부
```

#### mergeTree 로직 (브랜치 누적)

```
1. existing.tree의 모든 노드 유지
2. incoming.tree의 각 노드에 대해:
   a. 같은 ID가 있으면 → content 비교하여 동일하면 skip
   b. 같은 ID가 없으면 → 새 노드로 추가
   c. parent 노드의 children 배열에 새 child 추가
3. activePath 업데이트 (최신 경로 반영)
```

**핵심**: merge 시 기존 노드의 children 배열이 확장됨 → 자연스럽게 브랜치 트리 형성

---

## Phase 3: LLM용 마크다운 변환기 (신규 파일)

### 파일: `src/lib/tree-to-markdown.ts` (신규 생성)

**목적**: `ConversationTree` → 인덴트 마크다운 (토큰 효율 최적)

```typescript
/**
 * Tree to Indent Markdown Converter
 * 
 * ConversationTree → LLM에 넘길 인덴트 마크다운
 * 오버헤드: ~4% (JSON 대비 60% 절약)
 */

export function treeToIndentMarkdown(
  tree: ConversationTree
): string;
```

#### 출력 포맷

```markdown
U: 크롬 확장 프로그램 소스코드를 분석해줘
A: Content Script가 DOM에서 대화를 파싱하고...
  [A] U: 자동 동기화는 어떻게 구현해?
      A: MutationObserver로 URL 변경을 감지...
  [B] U: 브랜치 저장은 어떻게 해?
      A: 트리 구조로 parent/children 참조를...
      [B-1] U: JSON이면 토큰 낭비 아닌가?
            A: 저장은 JSON, LLM 입력은 변환해서...
      [B-2] U: 마크다운으로 바로 저장하면?
            A: 브랜치 중첩되면 파싱 어려워져서...
```

#### 변환 알고리즘

```
1. tree의 root 노드 찾기 (parent === null)
2. DFS(깊이 우선 탐색)으로 트리 순회
3. children이 1개면 → 같은 들여쓰기에서 계속
4. children이 2개 이상이면 → 브랜치 라벨 [A], [B]... 붙이고 들여쓰기 증가
5. 깊이에 따라 들여쓰기: depth * 2 spaces
6. 브랜치 라벨 중첩: [A], [A-1], [A-1-a]... 
```

---

## Phase 4: Claude extractor 수정

### 파일: `src/content/extractors/claude.ts`

**수정 목적**: 메시지 추출 시 parent 관계 추론

**수정 범위**: `extractMessages()` 메서드 내부만

현재 DOM에서는 명시적 parent/children 정보가 없으므로, 선형 추론:

```typescript
// extractMessages() 내부, messages 빌드 후 추가
// 선형 대화에서의 parent 추론
for (let i = 0; i < messages.length; i++) {
  messages[i].parent = i > 0 ? messages[i - 1].id : null;
  messages[i].children = i < messages.length - 1 ? [messages[i + 1].id] : [];
}
```

**중요**: 이 시점에서는 현재 보이는 브랜치만 선형으로 연결. 브랜치 분기는 mergeTree에서 처리됨.

---

## Phase 5: Output 파이프라인 연결

### 파일: `src/content/index.ts`

**수정 목적**: handleSync()에서 JSON 출력 분기 추가

```typescript
// handleSync() 내부, 기존 md 저장 코드 다음에 추가

// JSON tree 출력 (설정이 켜져 있을 때만)
if (settings.enableJsonTree && result.data) {
  const treeData = buildConversationTree(result.data);
  
  // 기존 JSON이 있으면 merge
  const existingTree = await loadExistingTree(result.data.id, settings);
  const finalTree = existingTree 
    ? mergeTree(existingTree, treeData) 
    : treeData;
  
  await saveTreeJSON(finalTree, settings);
  
  // LLM용 마크다운도 동시 생성
  const llmMarkdown = treeToIndentMarkdown(finalTree);
  await saveLLMMarkdown(llmMarkdown, result.data, settings);
}
```

### 파일: `src/background/output-handlers.ts`

**수정 목적**: JSON 파일 저장 핸들러 추가

```typescript
// executeOutput 함수의 switch문에 케이스 추가
case 'json':
  return handleDownloadToJSON(note, treeData, settings);
```

`handleDownloadToJSON`은 `handleDownloadToFile`과 거의 동일하되:
- MIME type: `application/json`
- 파일 확장자: `.json`
- content: `serializeTree(treeData)`

---

## Phase 6: JSON 파일 로드/저장 (Obsidian REST API)

### 파일: `src/lib/obsidian-api.ts`

**수정 목적**: JSON 파일 읽기/쓰기 메서드 추가

기존 `ObsidianApiClient` 클래스에 메서드 추가:

```typescript
async getJSONFile(path: string): Promise<ConversationTree | null>;
async putJSONFile(path: string, tree: ConversationTree): Promise<boolean>;
```

기존 `getFile()` / `putFile()` 래퍼이므로 실질적 변경은 미미.

---

## Phase 7: 설정 UI

### 파일: `src/popup/index.html` + `src/popup/index.ts`

**수정 목적**: JSON Tree 출력 토글 + 경로 설정

팝업 Advanced 섹션에 추가:

```html
<!-- JSON Tree Export 토글 -->
<div class="toggle-row">
  <label for="enableJsonTree">Export JSON tree (branches)</label>
  <input type="checkbox" id="enableJsonTree">
</div>

<!-- JSON 저장 경로 -->
<div class="input-row" id="jsonPathRow" style="display:none">
  <label for="jsonOutputPath">JSON path</label>
  <input type="text" id="jsonOutputPath" value="AI/json/{platform}">
</div>
```

### 파일: `src/lib/storage.ts`

**수정 목적**: 새 설정 필드의 기본값 추가

```typescript
const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  // ... 기존 필드
  enableJsonTree: false,       // ← 추가
  jsonOutputPath: 'AI/json/{platform}',  // ← 추가
};
```

---

## Phase 8: 상수 및 Validation

### 파일: `src/lib/constants.ts`

```typescript
export const VALID_OUTPUT_DESTINATIONS = [
  'obsidian', 'file', 'clipboard', 'json'   // json 추가
] as const;
```

### 파일: `src/background/validation.ts`

output destination에 'json' 추가 (validation whitelist)

---

## 파일별 변경 요약

### 신규 생성 (2개)

| 파일 | 크기 (예상) | 목적 |
|------|------------|------|
| `src/lib/tree-builder.ts` | ~120줄 | ConversationTree 빌드 + merge |
| `src/lib/tree-to-markdown.ts` | ~80줄 | 트리 → 인덴트 마크다운 변환 |

### 수정 (기존 파일 8개)

| 파일 | 변경 규모 | 내용 |
|------|-----------|------|
| `src/lib/types.ts` | +30줄 | 새 타입/인터페이스 추가 |
| `src/lib/constants.ts` | +2줄 | json destination 추가 |
| `src/lib/storage.ts` | +5줄 | 기본 설정값 추가 |
| `src/content/extractors/claude.ts` | +8줄 | parent/children 추론 |
| `src/content/index.ts` | +20줄 | handleSync에 json 분기 |
| `src/background/output-handlers.ts` | +30줄 | JSON 저장 핸들러 |
| `src/lib/obsidian-api.ts` | +20줄 | JSON 파일 GET/PUT |
| `src/popup/index.html` + `index.ts` | +20줄 | 토글 UI |
| `src/background/validation.ts` | +1줄 | json whitelist |

### 변경 없음

| 파일 | 이유 |
|------|------|
| `src/content/markdown.ts` | 기존 .md 변환 파이프라인 그대로 |
| `src/content/extractors/base.ts` | 추상 클래스 변경 불필요 |
| `src/content/extractors/gemini.ts` | claude만 먼저 구현 |
| `src/content/extractors/chatgpt.ts` | claude만 먼저 구현 |
| `src/content/extractors/perplexity.ts` | claude만 먼저 구현 |
| `src/content/ui.ts` | Sync 버튼 로직 변경 없음 |
| `src/lib/append-utils.ts` | .md append 로직 그대로 |
| `src/manifest.json` | 추가 권한 불필요 |

---

## 구현 순서 (Claude Code 작업 순서)

```
Step 1: 브랜치 생성
  git checkout -b feat/json-tree-export

Step 2: 타입 정의 (Phase 1)
  → src/lib/types.ts 수정
  → npm run lint로 타입 에러 없는지 확인

Step 3: 트리 빌더 구현 (Phase 2)
  → src/lib/tree-builder.ts 신규 생성
  → test/tree-builder.test.ts 테스트 작성 및 통과 확인

Step 4: LLM 마크다운 변환기 구현 (Phase 3)
  → src/lib/tree-to-markdown.ts 신규 생성
  → test/tree-to-markdown.test.ts 테스트 작성 및 통과 확인

Step 5: Claude extractor 수정 (Phase 4)
  → src/content/extractors/claude.ts 수정
  → 기존 테스트 깨지지 않는지 확인: npm test

Step 6: 설정/상수 수정 (Phase 7, 8)
  → src/lib/constants.ts 수정
  → src/lib/storage.ts 수정
  → src/background/validation.ts 수정

Step 7: Output 핸들러 연결 (Phase 5, 6)
  → src/lib/obsidian-api.ts 수정
  → src/background/output-handlers.ts 수정
  → src/content/index.ts 수정

Step 8: 팝업 UI (Phase 7)
  → src/popup/index.html 수정
  → src/popup/index.ts 수정

Step 9: 빌드 및 전체 테스트
  → npm run build
  → npm run lint
  → npm test
  → Chrome에서 로드하여 수동 테스트

Step 10: 문서 업데이트
  → README.md 업데이트
  → CLAUDE.md 아키텍처 섹션 업데이트
  → docs/adr/NNN-json-tree-export.md ADR 작성
```

---

## 저장 결과물 예시

### Vault 구조

```
AI/
├── claude/                          ← 기존 .md (변경 없음)
│   ├── 크롬확장분석-abc12345.md
│   └── API설계논의-def67890.md
│
└── json/claude/                     ← 신규 JSON 트리
    ├── abc12345.json                ← raw tree (merge 누적)
    ├── abc12345.llm.md              ← LLM용 인덴트 마크다운
    ├── def67890.json
    └── def67890.llm.md
```

### abc12345.json (브랜치 3번 전환 후)

```json
{
  "id": "abc12345",
  "title": "크롬 확장 분석",
  "source": "claude",
  "url": "https://claude.ai/chat/abc12345",
  "created": "2026-03-03T10:00:00Z",
  "modified": "2026-03-03T11:30:00Z",
  "activePath": ["001", "002", "004", "006"],
  "tree": {
    "001": { "id": "001", "role": "user", "content": "소스코드 분석해줘", "parent": null, "children": ["002"] },
    "002": { "id": "002", "role": "assistant", "content": "Content Script가...", "parent": "001", "children": ["003", "004", "005"] },
    "003": { "id": "003", "role": "user", "content": "자동 동기화는?", "parent": "002", "children": ["007"] },
    "004": { "id": "004", "role": "user", "content": "브랜치 저장은?", "parent": "002", "children": ["006"] },
    "005": { "id": "005", "role": "user", "content": "성능 문제는?", "parent": "002", "children": ["008"] },
    "006": { "id": "006", "role": "assistant", "content": "트리 구조로...", "parent": "004", "children": ["009", "010"] },
    "007": { "id": "007", "role": "assistant", "content": "MutationObserver로...", "parent": "003", "children": [] },
    "008": { "id": "008", "role": "assistant", "content": "셀렉터 캐싱으로...", "parent": "005", "children": [] },
    "009": { "id": "009", "role": "user", "content": "JSON 토큰 낭비?", "parent": "006", "children": ["011"] },
    "010": { "id": "010", "role": "user", "content": "md로 바로 하면?", "parent": "006", "children": ["012"] },
    "011": { "id": "011", "role": "assistant", "content": "저장은 JSON, LLM은 변환", "parent": "009", "children": [] },
    "012": { "id": "012", "role": "assistant", "content": "중첩되면 파싱 어려워", "parent": "010", "children": [] }
  }
}
```

### abc12345.llm.md (위 JSON에서 자동 생성)

```markdown
U: 소스코드 분석해줘
A: Content Script가...
  [A] U: 자동 동기화는?
      A: MutationObserver로...
  [B] U: 브랜치 저장은?
      A: 트리 구조로...
      [B-1] U: JSON 토큰 낭비?
            A: 저장은 JSON, LLM은 변환
      [B-2] U: md로 바로 하면?
            A: 중첩되면 파싱 어려워
  [C] U: 성능 문제는?
      A: 셀렉터 캐싱으로...
```

---

## 리스크 및 주의사항

1. **DOM 브랜치 감지 한계**: Claude는 브랜치 전환 시 DOM을 교체하므로, 한 번의 sync로는 현재 보이는 경로만 캡처됨. 여러 브랜치를 모두 저장하려면 사용자가 브랜치를 전환하면서 여러 번 sync해야 함.

2. **메시지 ID 안정성**: 현재 extractor가 `user-0`, `assistant-1` 같은 인덱스 기반 ID를 생성하므로, 브랜치 전환 시 동일 위치의 다른 메시지가 같은 ID를 받을 수 있음. → content hash를 ID에 포함하는 방식으로 해결 필요.

3. **기존 테스트 호환**: `parent` 필드가 optional이므로 기존 테스트는 깨지지 않아야 하나, npm test로 반드시 확인.

4. **CLAUDE.md 규칙 준수**: 이 프로젝트의 CLAUDE.md에 "NEVER generate code before plan approval" 규칙이 있으므로, Claude Code에 이 플랜 문서를 먼저 보여주고 승인 후 구현해야 함.


