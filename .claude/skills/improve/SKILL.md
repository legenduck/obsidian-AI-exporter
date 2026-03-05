---
name: improve
description: |
  Autonomous improvement loop for obsidian-AI-exporter (Chrome extension).
  Repeatedly runs QA, Fix, and Refactor cycles to continuously improve code quality.
  Each round runs E2E tests and auto-reverts refactoring commits that break tests.
  Multiple safety nets (test baseline comparison, savepoint tags, SHA-based revert,
  retry limits, regression detection, refactor blocklist, abort conditions) prevent runaway changes.
  Leverages SuperClaude commands and MCP servers (serena, sequential-thinking, context7, playwright, tavily).
arguments:
  - name: rounds
    description: Maximum number of improvement rounds (early termination if 0 issues found)
    default: "5"
  - name: focus
    description: "Scope of improvement: content | background | popup | lib | all"
    default: all
  - name: dry-run
    description: If true, run QA only without fixes or refactoring
    default: "false"
---

# Autonomous Improvement Loop — obsidian-AI-exporter

Repeats QA → Fix → Regression Check → Refactor → E2E Safety → Reflection → Self-Learning for up to {{rounds}} rounds.
Terminates early when open issues reach 0 or an abort condition triggers.

## Project Context

**obsidian-AI-exporter** is a Chrome extension that exports AI conversations (Gemini, Claude, ChatGPT, Perplexity) to Obsidian via its Local REST API.

**Tech stack**: TypeScript, Vite + @crxjs/vite-plugin, Vitest, ESLint + Prettier, DOMPurify, Turndown, Chrome Extension Manifest V3

**Source layout**:
```
src/
├── _locales/          — i18n (en, ja)
├── background/        — Service worker (Obsidian REST API communication)
├── content/           — Content scripts (DOM extraction, UI)
│   └── extractors/    — Platform-specific parsers (gemini, claude, chatgpt, perplexity)
├── lib/               — Shared types and utilities
├── offscreen/         — Offscreen document scripts
├── popup/             — Extension popup (settings UI)
└── manifest.json      — Extension manifest
```

## Toolchain

**SuperClaude commands:**
- `/sc:analyze` — Phase 1: Code and architecture structural analysis
- `/sc:troubleshoot` — Phase 2: Debug and root-cause test failures
- `/sc:cleanup` — Phase 3: Structured refactoring
- `/sc:reflect` — Phase 5: Structured retrospective

**MCP servers:**
- `serena` — Phase 0/1/3: Semantic code understanding, dependency graph analysis
- `sequential-thinking` — Phase 1/6: Multi-step reasoning for complex problems
- `context7` — Phase 2: Official documentation for Vitest, Chrome Extension APIs, DOMPurify, Turndown
- `playwright` — Phase 4: Browser-based E2E test execution
- `tavily` — Phase 6: Web research for best practices

**CLI tools:** `npx eslint`, `npx prettier`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm run test:coverage`

---

## Command Execution Rules (MANDATORY)

Claude Code's permission system blocks automatic approval of commands containing shell operators.
To ensure the improvement loop runs without stopping for permission prompts, follow these rules strictly:

### Prohibited Shell Operators

**NEVER use these operators in any Bash command:**

| Operator | Example (PROHIBITED) | Why |
|----------|---------------------|-----|
| `\|` (pipe) | `npx vitest run \| tee file.txt` | Introduces second command |
| `&&` (chain) | `git add -A && git commit -m "..."` | Introduces second command |
| `\|\|` (or-chain) | `cmd1 \|\| cmd2` | Introduces second command |
| `;` (sequence) | `cmd1; cmd2` | Introduces second command |
| `>` / `>>` (redirect) | `echo "0" > file.txt` | Shell redirect operator |
| `<` (input redirect) | `while read line; do ... done < file` | Shell redirect operator |
| `$()` (subshell) | `echo "$(git rev-parse HEAD)"` | Subshell expansion |
| `` ` `` (backtick) | `` echo `date` `` | Legacy subshell expansion |
| `2>&1` | `npx vitest run 2>&1` | File descriptor redirect |
| `2>/dev/null` | `git tag -d foo 2>/dev/null` | File descriptor redirect |

### Correct Patterns

| Task | WRONG | RIGHT |
|------|-------|-------|
| Save command output to file | `cmd > file.txt` | Run `cmd`, then use **Write tool** to save output |
| Append to file | `echo "x" >> file.txt` | Use **Read tool** to get current content, then **Write tool** to save updated content |
| Chain commands | `git add -A && git commit` | Run `git add -A` first, then run `git commit` separately |
| Pipe output | `cmd1 \| cmd2` | Run `cmd1`, process output in agent logic, then run `cmd2` if needed |
| Redirect stderr | `cmd 2>&1` | Just run `cmd` — Claude Code captures both stdout and stderr automatically |
| Subshell | `echo "$(git rev-parse HEAD)"` | Run `git rev-parse HEAD` first, store result, use in next command |
| Suppress errors | `cmd 2>/dev/null` | Just run `cmd` — handle errors in agent logic |

### Key Principle

**Each Bash tool call = exactly ONE atomic command with ZERO shell operators.**
All file I/O through Read/Write/Edit tools. All logic in the agent's reasoning.

---

## Abort Conditions (IMMEDIATE TERMINATION)

The improvement loop MUST abort immediately if ANY of these conditions occur:

| # | Condition | Detection | Action |
|---|-----------|-----------|--------|
| 1 | **Git Conflict** | revert/merge produces conflict | Stop. Show conflicts. Wait for manual resolution. |
| 2 | **Test Count Dropped** | Current test count < baseline | Abort. A test file was likely deleted. Investigate. |
| 3 | **Net Regression (2 consecutive rounds)** | Issue count increased 2 rounds in a row | Stop. Loop is making things worse. |
| 4 | **Phase 4 Revert (2 consecutive rounds)** | Full refactoring rollback 2 rounds running | Stop. Refactoring strategy is failing systemically. |
| 5 | **All Fix Attempts Exhausted** | Every open issue attempted 3+ times with no progress | Mark all UNFIXABLE. Escalate in Phase 5. |
| 6 | **Infrastructure Failure** | Timeout (exit 124), Docker down, port conflict, disk full | Stop. Not a code quality issue. Report infra problem. |
| 7 | **User-Requested Stop** | ^C or explicit command | Clean up gracefully. Preserve state for resume. |

These conditions are checked at the start of each Phase and within each phase's error handling.

---

## Standardized Test Output Reading

All phases that run tests MUST use this standardized procedure:

### Step 1: Execute Tests

Run as a single atomic command (default timeout: 120 seconds):

```bash
timeout 120 npx vitest run
```

Claude Code automatically captures both stdout and stderr. No `2>&1` needed.

### Step 2: Save Output

Use the **Write tool** to save the captured output to `.improvement-state/test-output-latest.txt`.

### Step 3: Interpret Exit Code

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | All tests passed | Continue |
| 1 | Test failure(s) | Parse failures (Step 4) |
| 124 | Timeout | **Abort condition #6**: Infrastructure failure |
| Other | Infrastructure issue | **Abort condition #6**: Report and stop |

If exit code is 124 or > 1, this is an infrastructure failure. Abort the loop.

### Step 4: Parse Failures

If exit code is 1, extract each `FAIL` line with file name, test name, error message, and line number from the captured output.

### Step 5: Verify Test Count Against Baseline

1. Use **Read tool** to read `.improvement-state/baseline-test-count.txt` → get BASELINE_COUNT.
2. Parse the total test count from the captured output.
3. If current count < BASELINE_COUNT → **Abort condition #2** (test count dropped).

---

## Phase 0: Setup (first round only)

### 0-1. Git State Recovery Check

Check for stale git state files:

```bash
ls .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/REVERT_HEAD
```

If ANY of these exist, log `[CRITICAL] Git in inconsistent state. Resolve manually, then restart.` and abort.

### 0-2. Working Tree Check

```bash
git status --porcelain
```

If non-empty, warn and abort. Working tree must be clean.

### 0-3. Branch Setup

First get the timestamp:

```bash
date +%Y%m%d-%H%M%S
```

Then create the branch using the captured timestamp:

```bash
git checkout -b improve/YYYYMMDD-HHMMSS
```

### 0-4. State Directory

```bash
mkdir -p .improvement-state
```

### 0-5. Load Configuration

Use **Read tool** to load `.improvement-config.json` if it exists. Otherwise use defaults.

### 0-6. Load Refactor Blocklist

Use **Read tool** to check if `.improvement-state/refactor-blocklist.json` exists.
- If it exists, read and load it.
- If not, use **Write tool** to create it with initial content: `{"blocked": []}`

### 0-7. Project Structure Analysis

**Use serena MCP** to understand module structure, dependency graph, and key entry points:
- `src/manifest.json` (extension entry points, permissions)
- `src/content/extractors/` (platform-specific parsers)
- `src/background/` (service worker)
- `src/lib/` (shared types)
- Message passing interfaces between content scripts and background

### 0-8. Test Baseline (MANDATORY)

Run the full test suite BEFORE any changes to establish baseline metrics:

```bash
timeout 120 npx vitest run
```

From the captured output, extract:
- **BASELINE_TEST_COUNT**: total tests from summary line
- **BASELINE_FAILURE_COUNT**: failed tests from summary line (0 if none)

Use **Write tool** to save:
- `.improvement-state/baseline-test-count.txt` → the test count number
- `.improvement-state/baseline-failure-count.txt` → the failure count number
- `.improvement-state/baseline-test-output.txt` → the full test output

Log: `[Baseline] Tests: {BASELINE_TEST_COUNT} | Failures: {BASELINE_FAILURE_COUNT}`

**Abort if test count is 0 or baseline extraction fails.**

Also run build to establish build health:

```bash
npm run build
```

Use **Write tool** to save build output to `.improvement-state/baseline-build-output.txt`.

### 0-9. Initial Issue Count Record

Use **Write tool** to create these state files:
- `.improvement-state/prev-issue-count.txt` → `0`
- `.improvement-state/prev-prev-issue-count.txt` → `0`
- `.improvement-state/consecutive-phase4-reverts.txt` → `0`

---

## Main Loop: Round 1 ~ {{rounds}}

Log `[Round N/{{rounds}}]` at the start of each round.

### Round Start: Savepoint + State Validation

Create a savepoint tag:

```bash
git tag -f savepoint-round-N -m "Round N start"
```

Get current HEAD for logging:

```bash
git rev-parse HEAD
```

Log: `[Savepoint] Round N tagged: savepoint-round-N ({HEAD SHA})`

Validate state consistency:

```bash
git status --porcelain
```

If output is non-empty (uncommitted changes exist), run:

```bash
git stash
```

### Net Regression Check (Abort Condition #3)

1. Use **Read tool** to read `.improvement-state/prev-issue-count.txt` → PREV_ISSUES
2. Use **Read tool** to read `.improvement-state/prev-prev-issue-count.txt` → PREV_PREV_ISSUES
3. If round ≥ 3 and PREV_ISSUES > PREV_PREV_ISSUES, log warning that abort condition #3 may trigger.

---

### Phase 1: QA (Issue Detection)

Scope: {{focus}}

#### 1-0. Parallel QA Teams (optional)

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, split into parallel teams:

| Team | Tasks |
|------|-------|
| **Team A** (Lint + Types) | 1-1 ESLint, 1-2 Prettier, 1-3 TypeScript |
| **Team B** (Tests) | 1-4 Vitest, 1-5 Build Verification |
| **Team C** (Review) | 1-6 Playwright, 1-7 /sc:analyze + serena |

Otherwise, run sequentially as documented below.

#### 1-1. ESLint Check

```bash
npx eslint src/ --ext .ts,.tsx
```

Narrow scope when {{focus}} is not `all`: `content` → `src/content/`, `background` → `src/background/`, `popup` → `src/popup/`, `lib` → `src/lib/`

#### 1-2. Prettier Format Check

```bash
npx prettier --check "src/**/*.{ts,tsx,json,css,html}"
```

#### 1-3. TypeScript Type Check

```bash
npx tsc --noEmit
```

#### 1-4. Vitest Tests

Use the **Standardized Test Output Reading** procedure. Record each `FAIL` as a separate HIGH severity issue.

#### 1-5. Build Verification

```bash
npm run build
```

Use **Write tool** to save build output to `.improvement-state/build-output-round-N.txt`.

Build failure = CRITICAL. Build warnings = MEDIUM.

#### 1-6. Playwright E2E (optional)

Only if `qa.playwright` is `true` in config. Use **playwright MCP**.

#### 1-7. Code Analysis with /sc:analyze

```
/sc:analyze "Analyze {{focus}} codebase for code quality issues:
- Type safety problems, error handling gaps
- Chrome API anti-patterns (Manifest V3 violations)
- Content script security (DOMPurify, XSS)
- Message passing type safety (content ↔ background)
- Files >300 lines, functions >50 lines
- Duplicate logic across extractors
- Circular dependencies, i18n consistency"
```

**Use serena MCP** for dependency analysis. **Use sequential-thinking MCP** for complex architectural problems.

#### Issue Aggregation

Use **Write tool** to save issues to `.improvement-state/issues-round-N.md`.

**Net regression check**: Compare issue count with previous round:

1. Count issues from this round → CURRENT_ISSUE_COUNT.
2. Use **Read tool** to read `.improvement-state/prev-issue-count.txt` → PREV_ISSUES.
3. Use **Read tool** to read `.improvement-state/prev-prev-issue-count.txt` → PREV_PREV_ISSUES.
4. Use **Write tool** to update:
   - `.improvement-state/prev-prev-issue-count.txt` → PREV_ISSUES (the old previous)
   - `.improvement-state/prev-issue-count.txt` → CURRENT_ISSUE_COUNT (the new previous)
5. **Abort condition #3 check**: If round ≥ 3 AND CURRENT_ISSUE_COUNT > PREV_ISSUES AND PREV_ISSUES > PREV_PREV_ISSUES → abort. Log `[ABORT] Net regression. Loop is making things worse.` and proceed to Phase 7.

**Decision**: If issue count is 0 → exit the loop and proceed to Phase 7 (Finalize).

---

### Phase 2: Fix (Issue Resolution)

Skip if {{dry-run}} is true.

#### 2-0. Create Savepoint Before Fixing

```bash
git tag -f savepoint-phase2-round-N -m "Phase 2 start: round N"
```

Log: `[Savepoint] Phase 2 start: savepoint-phase2-round-N`

#### 2-1. Auto-fix with Tools

```bash
npx eslint src/ --ext .ts,.tsx --fix
```

```bash
npx prettier --write "src/**/*.{ts,tsx,json,css,html}"
```

Check if files changed with `git status --porcelain`. If changed:

```bash
git add -A
```

```bash
git commit -m "fix: auto-fix lint and formatting issues

[round=N][phase=2][type=autofix]"
```

#### 2-2. Fix Test Failures (HIGHEST PRIORITY)

**Retry limit: Max 3 attempts per failing test.**

For each failing test:

1. **Read** the test file and implementation under test using Read tool.
2. **Identify cause** using `/sc:troubleshoot` + context7 MCP.
3. **Fix strategy**: Bug → fix implementation (NEVER weaken tests). Mock issue → fix test. Outdated snapshot → update test.
4. **After each fix, re-run the ENTIRE test file** (not just the fixed test):
   ```bash
   npx vitest run {test file path}
   ```
   If fix broke other tests in the same file, revert and try differently.
5. **Then re-run FULL test suite** using Standardized Test Output Reading:
   ```bash
   timeout 120 npx vitest run
   ```
   If a previously passing test now fails, the fix caused a cross-file regression. Revert and try again.
6. After **3 failed attempts**: mark as `UNFIXABLE`, move to next issue.

#### 2-3. Fix /sc:analyze and serena Findings

Prioritize HIGH+. Use **context7 MCP** for Chrome Extension / DOMPurify / Turndown patterns.

#### 2-4. Commit Fixes

```bash
git add -A
```

```bash
git commit -m "fix: resolve N QA issues [round M]

[round=M][phase=2][type=fix]"
```

Record modified files:

```bash
git diff HEAD~1 HEAD --name-only
```

Use **Write tool** to save this output to `.improvement-state/phase2-modified-files-round-N.txt`.

#### 2-5. Regression Detection (CRITICAL SAFETY GATE)

After all fixes are committed, run FULL test suite and compare to baseline:

```bash
timeout 120 npx vitest run
```

Use **Write tool** to save output to `.improvement-state/post-fix-test-output.txt`.

Extract post-fix failure count from the output.

Compare with baseline:
1. Use **Read tool** to read `.improvement-state/baseline-failure-count.txt` → BASELINE_FAILURE_COUNT.
2. If POST_FIX_FAILURE_COUNT > BASELINE_FAILURE_COUNT:
   - Log `[REGRESSION] Phase 2 fixes introduced NEW test failures!`
   - Revert last fix commit:
     ```bash
     git revert --no-edit HEAD
     ```
   - Re-run tests to confirm regression is resolved:
     ```bash
     timeout 120 npx vitest run
     ```
   - If still failing, reset to savepoint:
     ```bash
     git reset --hard savepoint-phase2-round-N
     ```
     Log: `Round N Phase 2 marked as FAILED.`

Also verify test count hasn't dropped (abort condition #2).

---

### Phase 3: Refactor (Quality Improvement)

Skip if {{dry-run}} is true.

#### 3-0. Pre-condition: ALL Tests Must Pass

```bash
timeout 120 npx vitest run
```

If ANY test fails, attempt fix (Phase 2-2 procedure, max 3 retries).
If still failing after 3 retries, **skip Phase 3 entirely**.

#### 3-1. Create Savepoint Before Refactoring

```bash
git tag -f savepoint-phase3-round-N -m "Phase 3 start: round N"
```

Use **Write tool** to create empty files:
- `.improvement-state/refactor-shas-round-N.txt` → empty string
- `.improvement-state/refactor-new-files-round-N.txt` → empty string

#### 3-2. Coverage Check for Refactor Targets

```bash
npm run test:coverage
```

If target file has **branch coverage below 60%**:
```
[WARNING] {file} has low coverage (Branches: XX%). Regressions may go undetected.
Consider adding tests first, or skip this target.
```

#### 3-3. Blast Radius Check with serena

Use **serena MCP** to analyze impact:
- How many files affected?
- Cross-boundary impacts (content ↔ background ↔ lib)?
- New files created or deleted?

**If > 5 files affected, skip this refactoring.**

#### 3-4. Check Refactor Blocklist

Use **Read tool** to read `.improvement-state/refactor-blocklist.json`.
Parse the JSON and check if `{target, strategy}` combination exists in the `blocked` array.
If found in blocklist, skip and try next candidate.

#### 3-5. Apply Refactoring

**Use `/sc:cleanup`:**
```
/sc:cleanup "{target file path} — strategy: {refactoring strategy}"
```

Refer to `references/refactor-patterns.md`. Max refactorings per round: `refactor.max_per_round` (default: 3).

Candidate selection: files with Phase 1 issues, files >300 lines, functions >50 lines, duplicate code across extractors, shared logic for `src/lib/`.

#### 3-6. Commit and Record SHA

Step 1: Stage and commit.

```bash
git add -A
```

```bash
git commit -m "refactor: {specific description} [round N]

[round=N][phase=3][type=refactor][target={filename}]"
```

Step 2: Record the commit SHA.

```bash
git rev-parse HEAD
```

```bash
git log -1 --format=%s
```

Use **Read tool** to get current content of `.improvement-state/refactor-shas-round-N.txt`.
Use **Write tool** to append the new line: `{SHA} {commit message}`.

Step 3: Record newly created files (git revert won't delete these).

```bash
git diff HEAD~1 HEAD --name-status
```

Parse the output for lines starting with `A` (added files). Extract the filenames.
Use **Read tool** to get current content of `.improvement-state/refactor-new-files-round-N.txt`.
Use **Write tool** to append the new filenames.

#### 3-7. Inline Test After Each Refactoring

Use **Standardized Test Output Reading**:

```bash
timeout 120 npx vitest run
```

**If tests fail:**

1. Immediately revert this refactoring:
   ```bash
   git revert --no-edit HEAD
   ```
2. **Add to refactor blocklist**: Use **Read tool** to load `.improvement-state/refactor-blocklist.json`, parse JSON, add `{"file": "{target}", "strategy": "{strategy}", "round": N}` to the `blocked` array, then use **Write tool** to save the updated JSON.
3. Increment consecutive failure counter.
4. **If 2 consecutive refactorings fail**, stop Phase 3:
   ```
   [STOP] 2 consecutive refactoring failures. Codebase may be unstable.
   ```

---

### Phase 4: E2E Safety Check

Only if refactoring was performed in Phase 3.

#### 4-1. Run Full Test Suite + Build

Use **Standardized Test Output Reading**:

```bash
timeout 120 npx vitest run
```

```bash
npm run build
```

#### 4-2. On Success → Phase 5

Use **Write tool** to write `0` to `.improvement-state/consecutive-phase4-reverts.txt`.

#### 4-3. On Failure — Safe Revert

**Use SHA-based revert. Never count commits or use HEAD offsets.**

Step 1: Read the SHA list.
Use **Read tool** to read `.improvement-state/refactor-shas-round-N.txt`.
Parse each line to extract SHA (first field). Reverse the order (last commit first).

Step 2: Revert each SHA in reverse order.

For each SHA:

a. Verify SHA exists:
```bash
git rev-parse --verify {SHA}
```
If the command fails, log error and fall back to savepoint (Step 3).

b. Attempt revert:
```bash
git revert --no-edit {SHA}
```
If the command fails (exit code ≠ 0), a conflict occurred:
```bash
git revert --abort
```
Log `[ERROR] Revert of {SHA} produced conflict. Abort condition #1.`
Fall back to savepoint (Step 3).

Step 3: Fallback — reset to savepoint (only if SHA-based revert failed):

```bash
git reset --hard savepoint-phase3-round-N
```

Step 4: Clean up newly created files (git revert doesn't delete new files):

Use **Read tool** to read `.improvement-state/refactor-new-files-round-N.txt`.
For each filename listed, check if the file still exists, and if so delete it:
```bash
rm {filepath}
```

Step 5: Post-revert verification:

```bash
timeout 120 npx vitest run
```

If tests STILL fail:
- Log `[CRITICAL] Tests STILL failing after reverting refactorings.`
- Reset to Phase 2 savepoint:
  ```bash
  git reset --hard savepoint-phase2-round-N
  ```
- Use **Write tool** to save `FAILED` to `.improvement-state/round-N-status.txt`.

Step 6: Add reverted refactorings to blocklist (prevent retry next round).
Use **Read tool** + **Write tool** to update `.improvement-state/refactor-blocklist.json`.

Step 7: Check abort condition #4.

Use **Read tool** to read `.improvement-state/consecutive-phase4-reverts.txt` → current count.
Increment by 1.
Use **Write tool** to save updated count.

If count ≥ 2:
- Log `[ABORT] Phase 4 revert occurred 2 consecutive rounds. Abort condition #4.`
- Proceed to Phase 7.

---

### Phase 5: Reflection (Record Results)

**Use `/sc:reflect`:**

```
/sc:reflect "Round N retrospective:
- QA found X issues (sources: eslint, prettier, typecheck, vitest, build, sc:analyze, serena)
- Fixed Y issues (auto: p, manual: q, UNFIXABLE: r)
- Regression detection: NEW_FAILURES found/reverted? yes/no
- Refactored Z files (succeeded: a, reverted: b, skipped-blast-radius: c, blocklisted: d)
- E2E Safety: PASSED / REVERTED / SAVEPOINT_RESET
- Consecutive refactor failures: D
Analyze what went well, what didn't, and patterns to watch."
```

Compose the reflection log entry as markdown:

```markdown
## Round N - YYYY-MM-DD HH:MM

| Phase | Result |
|-------|--------|
| QA | X issues found (H:a, M:b, L:c) |
| Fix | Y/X fixed (auto:p, manual:q, unfixable:r) |
| Regression Check | NEW_FAILURES: 0 / reverted: yes/no |
| Refactor | Z attempted (ok:a, reverted:b, skipped:c, blocklisted:d) |
| E2E Safety | PASSED / REVERTED / SAVEPOINT_RESET |
| Round Status | SUCCESS / PARTIAL / FAILED |
| Test Count | Baseline: B / Current: C (delta: ±D) |

### Safety Events
- Savepoint resets: 0
- Revert conflicts: 0
- Fix retry limit reached: 0
- Regression detection triggered: yes/no
- Refactor consecutive failure stop: yes/no
- Abort conditions checked: none triggered / #N triggered

### UNFIXABLE Issues (require user review)
- {test name}: {reason}

### Blocklist Additions
- {file} ({strategy}): reverted in round N

### Tool Usage
- serena: {analysis results}
- context7: {docs referenced}
- sequential-thinking: {problems analyzed}

### Observations
(1-3 sentence summary from /sc:reflect)

---
```

Use **Read tool** to get existing content of `.improvement-state/reflection-log.md` (create if not exists).
Use **Write tool** to append the new entry.

Record end-of-round SHA:

```bash
git rev-parse HEAD
```

Use **Write tool** to save SHA to `.improvement-state/round-N-end-sha.txt`.

---

### Phase 6: Self-Learning (final round only)

**Use sequential-thinking MCP** to analyze all rounds in reflection-log.md:
- Trends: issue count, fix count, revert rate
- Recurring patterns
- Safety event analysis (reverts, savepoint resets, unfixable tests)
- Blocklist growth analysis

**Use tavily MCP** for best practice research:
- "chrome extension manifest v3 best practices"
- "vitest chrome extension testing patterns"
- "turndown custom rules typescript"

Use **Write tool** to save to `.improvement-state/self-learning-suggestions.md`. **NOT auto-applied.**

---

## Phase 7: Finalize + Manual Gate

### 7-1. Summary Report

```
=== Improvement Loop Summary ===
Rounds completed: X / {{rounds}}
Total issues found: Y
Total issues fixed: Z
Unfixable issues: U (require user review)
Refactorings: applied=W, reverted=V, skipped=S, blocklisted=B
Safety events: savepoint resets=C, revert conflicts=R, regressions detected=G
Abort conditions triggered: none / #N
Test baseline: B tests → Current: C tests (delta: ±D)
Tools used: serena, context7, sequential-thinking, tavily, playwright
Branch: improve/YYYYMMDD-HHMMSS
```

### 7-2. Show Changes (Manual Gate)

**IMPORTANT: Do NOT auto-push. Show the user what will be pushed first.**

```bash
git log main..HEAD --oneline
```

```bash
git diff main..HEAD --stat
```

### 7-3. Ask User for Confirmation

```
All changes are ready on branch: improve/YYYYMMDD-HHMMSS

Review the commits and changes above.
Should I push to remote? (yes/no)
```

**Wait for explicit user confirmation.**

### 7-4. Push (Only After Confirmation)

If user confirms:
```bash
git push -u origin improve/YYYYMMDD-HHMMSS
```

If user declines:
```
Branch remains local. To push later:
  git push -u origin improve/YYYYMMDD-HHMMSS
```

### 7-5. Cleanup Savepoint Tags

Delete each savepoint tag individually (one command per tag):

```bash
git tag -d savepoint-round-1
```

```bash
git tag -d savepoint-phase2-round-1
```

```bash
git tag -d savepoint-phase3-round-1
```

(Repeat for each round. Ignore errors if tag doesn't exist.)

### 7-6. Suggest PR (Do Not Auto-Create)

Provide the URL for user to create PR manually.

---

## Error Handling

| Situation | Action |
|-----------|--------|
| Git in MERGING/REBASING state | Abort condition #1 |
| Test count < baseline | Abort condition #2 |
| Net regression 2 consecutive rounds | Abort condition #3 |
| Phase 4 revert 2 consecutive rounds | Abort condition #4 |
| Fix retry limit reached (3x) | Mark UNFIXABLE, continue to next issue |
| Infra failure (timeout, Docker, disk) | Abort condition #6 |
| ESLint/Prettier not found | Skip that check |
| Build failure | Record as CRITICAL issue |
| Refactor blast radius > 5 files | Skip that refactoring |
| Refactor in blocklist | Skip, try next candidate |
| MCP server not connected | Fall back without that MCP |
| /sc: command not installed | Fall back without SuperClaude |
