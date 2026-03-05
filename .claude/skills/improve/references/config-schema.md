# Configuration File Spec (.improvement-config.json)

Place `.improvement-config.json` in the project root to customize improvement loop behavior.
If the file does not exist, all defaults are used.

## Schema

```json
{
  "rounds": 5,
  "focus": "all",
  "qa": {
    "eslint": true,
    "prettier": true,
    "typecheck": true,
    "vitest": true,
    "playwright": false,
    "build": true,
    "claude_review": true,
    "severity_filter": ["critical", "high", "medium"],
    "parallel_teams": true
  },
  "fix": {
    "max_attempts_per_test": 3,
    "full_suite_after_each_fix": true
  },
  "refactor": {
    "enabled": true,
    "max_per_round": 3,
    "max_consecutive_failures": 2,
    "max_files_per_refactor": 5,
    "min_branch_coverage_pct": 60,
    "strategies": [...]
  },
  "safety": {
    "auto_revert_on_failure": true,
    "savepoint_tags": true,
    "sha_based_revert": true,
    "cleanup_new_files_on_revert": true,
    "test_timeout_ms": 120000,
    "regression_detection": true,
    "refactor_blocklist": true,
    "manual_push_gate": true
  },
  "abort": {
    "net_regression_rounds": 2,
    "consecutive_phase4_reverts": 2
  },
  "self_learning": {
    "enabled": true
  }
}
```

## Field Descriptions

### Top Level

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `rounds` | number | 5 | Maximum round count. Overridable via `--rounds` |
| `focus` | string | "all" | Target scope: "content", "background", "popup", "lib", "all" |

### qa

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `eslint` | boolean | true | Run ESLint static analysis |
| `prettier` | boolean | true | Run Prettier format check |
| `typecheck` | boolean | true | Run tsc --noEmit |
| `vitest` | boolean | true | Run Vitest tests |
| `playwright` | boolean | false | Run Playwright E2E |
| `build` | boolean | true | Run Vite production build verification |
| `claude_review` | boolean | true | Run /sc:analyze + serena code review |
| `severity_filter` | string[] | ["critical","high","medium"] | Severity levels to address |
| `parallel_teams` | boolean | true | Use Agent Teams for parallel QA (requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1) |

### fix

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_attempts_per_test` | number | 3 | Max fix attempts per failing test before UNFIXABLE |
| `full_suite_after_each_fix` | boolean | true | Re-run full test suite after each fix |

### refactor

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | true | Run the refactoring phase |
| `max_per_round` | number | 3 | Maximum refactorings per round |
| `max_consecutive_failures` | number | 2 | Stop Phase 3 after N consecutive failures |
| `max_files_per_refactor` | number | 5 | Skip refactoring if blast radius exceeds this |
| `min_branch_coverage_pct` | number | 60 | Warn if target branch coverage below this % |
| `strategies` | string[] | (all) | Allowed refactoring strategies |

### safety

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `auto_revert_on_failure` | boolean | true | Auto-revert on test failure after refactoring |
| `savepoint_tags` | boolean | true | Use git tags for savepoints (more durable than SHA files) |
| `sha_based_revert` | boolean | true | Record SHAs at commit time for precise revert |
| `cleanup_new_files_on_revert` | boolean | true | Delete new files after revert |
| `test_timeout_ms` | number | 120000 | Test execution timeout in milliseconds |
| `regression_detection` | boolean | true | Phase 2-5: Check for NEW failures introduced by fixes |
| `refactor_blocklist` | boolean | true | Track and skip failed {file, strategy} combinations |
| `manual_push_gate` | boolean | true | Phase 7: Require user confirmation before git push |

### abort

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `net_regression_rounds` | number | 2 | Abort if issue count increased this many consecutive rounds |
| `consecutive_phase4_reverts` | number | 2 | Abort if Phase 4 revert occurred this many consecutive rounds |

### self_learning

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | true | Run the self-learning phase |

## Recommended .gitignore additions

```
.improvement-state/
# .improvement-config.json  # optional: commit to share with team
```
