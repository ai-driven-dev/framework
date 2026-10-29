---
status: done
---

# Instruction: Clarify browser session lifecycle

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-qa/skills/01-acceptance-qa/references/interface-browser-playwright-cli.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Read the Playwright CLI reference | Existing per-scenario session and teardown guidance is present | system |
| Happy path | Review scenario guidance | It says to reuse one tab or tab group throughout the scenario and close its session after teardown | system |
| Edge case | A scenario contains multiple steps | Each step uses the existing tab or tab group rather than opening another | system |

## Tasks to do

### `1)` Add browser tab reuse guidance

> Keep each QA scenario in the same tab or tab group and close it when done.

1. Add a concise instruction to reuse the same tab or tab group for every step in a scenario, then close the session after teardown and verification.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | The active QA reference explicitly requires tab reuse within a scenario and session closure after teardown. |
