# Refactoring Patterns — obsidian-AI-exporter

This document defines safe refactoring patterns for Phase 3 (Refactor) of the autonomous improvement loop.

## Core Principles

1. **Preserve behavior**: Refactoring MUST NOT change externally observable behavior.
2. **One commit per change**: Each refactoring is an independent commit with recorded SHA.
3. **Verify with tests**: Always run FULL test suite after each refactoring (not just affected tests).
4. **Keep reversible**: Keep changes small enough to safely `git revert` (max 5 files per refactoring).
5. **Blast radius check**: Use serena to analyze impact BEFORE refactoring. Skip if too many files affected.
6. **Coverage awareness**: Check branch coverage on target files. Warn if below 60%.
7. **Blocklist check**: Never retry a {file, strategy} pair that was previously reverted.

## Pre-Refactoring Safety Checklist

Before applying ANY refactoring:

- [ ] All tests pass (Phase 3 pre-condition)
- [ ] Savepoint tag created (`savepoint-phase3-round-N`)
- [ ] serena impact analysis completed (files affected, cross-boundary impacts)
- [ ] Blast radius ≤ 5 files
- [ ] Coverage check completed for target files
- [ ] **Blocklist check**: Verify {file, strategy} is NOT in `refactor-blocklist.json`

## Pattern 1: Extract Function (extract-function)

**When to apply**: Function exceeds 50 lines.

**Steps**:
1. Identify a cohesive block of logic within the function.
2. Extract it into a new private function.
3. Call the new function from the original location.
4. Carry over type information accurately.

**Warnings**:
- Be careful when extracting blocks with side effects (DOM manipulation, Chrome API calls).
- Pass closure-captured variables as explicit arguments.
- Name the extracted function to accurately describe its purpose.
- In content scripts, ensure extracted functions don't break the content script lifecycle.
- **Record new files** in `refactor-new-files-round-N.txt` if extracting to a new file.

**Commit**:
```bash
git add -A && git commit -m "refactor: extract {funcName} from {sourceFile} [round N]

[round=N][phase=3][type=refactor][target={sourceFile}]"
```

## Pattern 2: Simplify Conditional (simplify-conditional)

**When to apply**: Nesting 3+ levels deep, or complex boolean expressions.

**Steps**:
1. Reduce nesting with guard clauses (early return).
2. Extract complex conditions into named boolean variables.
3. Replace switch statements with object maps (when appropriate).

**Warnings**:
- Ensure removing else clauses preserves the original logic exactly.
- Watch for side effects when reordering conditions.
- In extractors, platform-specific DOM checks often have intentional nesting — be careful with guard clause transformation.

**Commit**: Same format as Pattern 1 with `[target={file}]`.

## Pattern 3: Remove Duplication (remove-duplication)

**When to apply**: Same or very similar code blocks exist in 2+ locations.

**Steps**:
1. Identify duplicate sections and clarify their differences.
2. Parameterize differences and create a shared function.
3. Replace original locations with calls to the shared function.
4. Place the shared function in `src/lib/` (avoid dumping into generic utils/helpers).

**Common duplication targets in this project**:
- Extractor logic shared across `gemini.ts`, `claude.ts`, `chatgpt.ts`, `perplexity.ts`
- Markdown conversion patterns in `markdown*.ts` files
- Chrome message passing boilerplate
- Error handling patterns for Obsidian REST API calls

**Warnings**:
- Do NOT deduplicate coincidental duplication (looks the same but exists for different reasons).
- Each AI platform has unique DOM structures — verify that deduplication doesn't break platform-specific extraction.
- **This pattern often touches many files.** Check blast radius with serena. If > 5 files, skip.
- **Record all newly created files** for cleanup on revert.

## Pattern 4: Split File (split-file)

**When to apply**: File exceeds 300 lines.

**Steps**:
1. Classify responsibilities within the file.
2. Create new files and move related code.
3. Update export/import statements.
4. Add re-exports in index.ts (if needed).

**Warnings**:
- MUST NOT create circular dependencies (especially between content/ and lib/).
- Update ALL existing import paths.
- Update test file imports as well.
- In Chrome extensions, ensure content script entry points remain correct in manifest.json.
- Verify Vite/CRXJS bundle configuration still includes all entry points.
- **CRITICAL**: Record ALL newly created files in `refactor-new-files-round-N.txt`.
  Git revert does NOT delete newly created files — they will remain as orphans if not cleaned up.

## Pattern 5: Strengthen Types (strengthen-types)

**When to apply**: Use of `any` type, excessive type assertions, insufficient type guards.

**Steps**:
1. Replace `any` with specific types.
2. Replace type assertions (`as Type`) with type guard functions.
3. Add exhaustive checks for union types.

**Common targets in this project**:
- Chrome message passing interfaces (define typed message/response pairs)
- Extractor return types (standardize conversation data structure)
- Obsidian REST API response types
- DOM element types from platform-specific queries (`querySelector` results)

**Warnings**:
- When Chrome API type definitions are insufficient, allow `any` with an `// eslint-disable-next-line` comment.
- DOM query results are inherently nullable — use proper null checks rather than non-null assertions.
- Verify that type changes do not break existing tests.

## Patterns NOT to Apply

The following refactorings are **NOT performed** in the autonomous improvement loop (too risky):

- Architecture changes (major directory structure reorganization)
- Manifest.json structural changes (permissions, content_scripts config)
- Chrome API migration (e.g., Manifest V2 → V3 patterns)
- Dependency library updates (DOMPurify, Turndown versions)
- Test framework or build tool changes
- Performance optimization (optimization without measurement is harmful)
- Changes to the Obsidian REST API communication protocol
- i18n structure changes (adding new locales, changing key format)

## Post-Refactoring Verification

After each individual refactoring commit:

1. **Run full test suite**: `npx vitest run 2>&1`
2. **If tests fail**: Immediately revert (`git revert --no-edit HEAD`)
3. **If 2 consecutive refactorings fail**: Stop Phase 3, proceed to Phase 4
4. **Record SHA**: Append to `refactor-shas-round-N.txt`
5. **Record new files**: Append to `refactor-new-files-round-N.txt`
