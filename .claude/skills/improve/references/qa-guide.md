# QA Phase Detailed Guide — obsidian-AI-exporter

## Parallel QA Teams (optional)

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and `qa.parallel_teams` is true:

| Team | Tasks | Weight |
|------|-------|--------|
| **Team A** | ESLint + Prettier + TypeScript | Light (fast) |
| **Team B** | Vitest (full test suite) | Heavy (test execution) |
| **Team C** | Build + /sc:analyze + serena review | Heavy (MCP calls) |

Otherwise, run all checks sequentially as documented below.

## Standardized Test Output Reading

All Vitest execution in Phase 1 (and all subsequent phases) MUST follow the standardized procedure defined in SKILL.md. Key points:

1. **Use `timeout` command** to enforce test execution deadline (default: 120s)
2. **Exit code 0** = pass, **1** = test failure, **124** = timeout (infra), **other** = infra issue
3. **Always compare test count against baseline** (from Phase 0). If count drops, abort condition #2.
4. **Distinguish infra failures** (Docker, port, disk) from actual test logic failures.

Refer to SKILL.md "## Standardized Test Output Reading" section for full details.

## Parsing Output by QA Tool

### ESLint

**Command**:
```bash
npx eslint src/ --ext .ts,.tsx 2>&1
```

**Example output**:
```
src/content/extractors/gemini.ts
  45:3  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  89:1  warning  Missing return type on function  @typescript-eslint/explicit-function-return-type
```

**Parsing rules**:
- Format: `filepath line:col severity message rule-name`
- Severity mapping: error → HIGH, warning → MEDIUM

### Prettier

**Command**:
```bash
npx prettier --check "src/**/*.{ts,tsx,json,css,html}" 2>&1
```

**Example output**:
```
Checking formatting...
[warn] src/content/ui.ts
[warn] src/lib/types.ts
[warn] Code style issues found in the above file(s). Forgot to run Prettier?
```

**Parsing rules**:
- Lines with `[warn]` followed by a file path indicate formatting violations
- Severity: always LOW (auto-fixable with `--write`)

### TypeScript Type Check

**Command**:
```bash
npx tsc --noEmit 2>&1
```

**Example output**:
```
src/content/extractors/claude.ts(23,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
```

**Parsing rules**:
- Format: `filepath(line,col): error TSxxxx: message`
- Severity: always HIGH (type errors mean compilation failure)

### Vitest

**Command**:
```bash
npx vitest run 2>&1
```

**Example output**:
```
 FAIL  src/__tests__/markdown.test.ts > Markdown Conversion > should handle code blocks
AssertionError: expected '<pre>code</pre>' to equal '```code```'
 ❯ src/__tests__/markdown.test.ts:42:18
```

**Parsing rules**:
- Extract test file and test name from `FAIL` lines
- Extract failure reason from the error message
- Severity: always HIGH (test failure = regression bug)

### Build Verification

**Command**:
```bash
npm run build 2>&1
```

**Example output (failure)**:
```
error TS2307: Cannot find module './missing-module' or its corresponding type declarations.
error during build:
[vite]: Rollup failed to resolve import "missing-module" from "src/content/index.ts".
```

**Parsing rules**:
- Build failure = CRITICAL severity (extension cannot ship)
- Extract error messages and file paths
- Check for both TypeScript and Vite/Rollup errors

### Playwright E2E (optional)

**Command** (via playwright MCP or CLI):
```bash
npx playwright test 2>&1
```

**Example output**:
```
  1) [chromium] › e2e/export.spec.ts:5:3 › Export Flow › should export Gemini conversation
     Timeout of 30000ms exceeded.
```

**Parsing rules**:
- Lines starting with `number)` indicate failing tests
- Extract browser name, test file, test name, and error reason
- Severity: always HIGH

### Claude Code Review (with /sc:analyze + serena)

**Review target selection**:

Round 1 (by focus scope):
- `content` → `src/content/extractors/*.ts`, `src/content/markdown*.ts`, `src/content/ui.ts`
- `background` → `src/background/*.ts`
- `popup` → `src/popup/*.ts`
- `lib` → `src/lib/*.ts`
- `all` → Start with extractors and background service worker

Round 2+:
1. Files modified in the previous round
2. Files not yet reviewed (rotate each round)

**Review checklist** (Chrome extension specific):
- [ ] No unjustified use of `any` type
- [ ] Async functions have try-catch or error handling
- [ ] Chrome API usage follows Manifest V3 patterns
- [ ] Content script does not leak data across origins
- [ ] DOMPurify is used before injecting user/page content
- [ ] Turndown rules are properly registered and don't conflict
- [ ] Message passing between content/background is type-safe
- [ ] No hardcoded magic numbers or strings
- [ ] Functions are within 50 lines
- [ ] Files are within 300 lines
- [ ] No circular imports
- [ ] i18n keys in `_locales/` are used consistently
- [ ] SSRF protection (if fetching external URLs)
- [ ] Storage API usage (`chrome.storage.local`) follows best practices

**Severity classification**:
- CRITICAL: Security vulnerability (XSS, data leak across origins, unsafe DOM injection)
- HIGH: Likely bug, lack of type safety, test failure, Chrome API misuse
- MEDIUM: Coding convention violation, readability issue, missing error handling
- LOW: Style improvement suggestion, performance hint, formatting

## Issue Aggregation Template

```markdown
# Issues - Round N

**Date**: YYYY-MM-DD HH:MM
**Found**: X issues | **Severity**: CRITICAL=0, HIGH=0, MEDIUM=0, LOW=0
**Sources**: eslint=a, prettier=b, typecheck=c, vitest=d, build=e, playwright=f, review=g

## Issues

### [HIGH] Missing error handling in background service worker
- **File**: `src/background/index.ts:45`
- **Source**: review
- **Detail**: sendToObsidian() calls REST API without try-catch
- **Suggestion**: Add try-catch + send error response to content script
- **Status**: open

### [MEDIUM] Unused import
- **File**: `src/content/extractors/gemini.ts:3`
- **Source**: eslint
- **Detail**: 'DOMPurify' is imported but never used
- **Suggestion**: Remove import (auto-fixable with --fix)
- **Status**: open

### [LOW] Formatting violation
- **File**: `src/lib/types.ts`
- **Source**: prettier
- **Detail**: Code style issues
- **Suggestion**: Run prettier --write (auto-fixable)
- **Status**: open
```
