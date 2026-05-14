---
objective: Add file aidd_docs/async-test-marker-v2.txt containing exactly "hello from v2" and ship it via PR closing issue #96.
success_condition: |
  test "$(cat aidd_docs/async-test-marker-v2.txt)" = "hello from v2" \
  && gh pr list --head feat/issue-96-async-test-marker-v2 --base main --json body --jq '.[0].body' | grep -q "Closes #96" \
  && gh pr view --json comments --jq '.comments[].body' | grep -q "aidd-orchestrator:run-complete"
iteration: 0
created_at: 2026-05-14
issue: 96
branch: feat/issue-96-async-test-marker-v2
---

# Plan: Issue #96 - Self-Verifying Async-Dev Smoke Test

## Context

This is a smoke test of the async-dev pipeline. It exercises the full A-to-Z flow:
spec -> plan -> implement -> commit -> push -> PR -> review-complete marker.
The actual code change is intentionally trivial (one file, one line) so any
failure surfaces a pipeline issue, not a logic issue.

## Hard Constraints

- File content MUST be exactly the string `hello from v2` (no leading/trailing whitespace, no surrounding quotes).
- Branch MUST be `feat/issue-96-async-test-marker-v2`.
- PR MUST target `main`.
- PR body MUST contain `Closes #96` so GitHub auto-closes the issue on merge.
- A PR comment with the literal marker `aidd-orchestrator:run-complete` MUST be posted.

## Non-Goals

- No changes to source code, tests, or framework files.
- No edits to other docs or memory.
- No tooling/config changes.

## Phase 1: Create marker file and ship

### Milestone 1.1 - Create the marker file

**Tasks**

- Create `aidd_docs/async-test-marker-v2.txt` with content exactly `hello from v2`.
  - Implementation note: write the literal 13-character string. If a trailing
    newline is added by the editor, that is acceptable per common Unix
    convention; the acceptance check uses `cat` which tolerates either form,
    but the file MUST NOT contain extra characters before/after.

**Acceptance criteria**

- `test -f aidd_docs/async-test-marker-v2.txt` succeeds.
- `cat aidd_docs/async-test-marker-v2.txt` outputs `hello from v2`.
- `wc -c aidd_docs/async-test-marker-v2.txt` returns 13 or 14 bytes (with optional trailing newline).

**Validation commands**

```bash
test -f aidd_docs/async-test-marker-v2.txt
[ "$(cat aidd_docs/async-test-marker-v2.txt)" = "hello from v2" ]
```

**Dependencies:** none.

**Commit boundary:** single commit `chore(async-test): add v2 marker file for issue #96`.

### Milestone 1.2 - Branch, push, and open PR

**Tasks**

- Ensure working branch is `feat/issue-96-async-test-marker-v2` (create from `main` if missing).
- Stage and commit only `aidd_docs/async-test-marker-v2.txt`.
- Push branch to `origin` with `-u`.
- Open a PR via `gh pr create` targeting `main` with a body that contains `Closes #96`.

**Acceptance criteria**

- `git rev-parse --abbrev-ref HEAD` returns `feat/issue-96-async-test-marker-v2`.
- `git log -1 --name-only` shows only `aidd_docs/async-test-marker-v2.txt` in the new commit.
- `gh pr view --json baseRefName --jq .baseRefName` returns `main`.
- `gh pr view --json body --jq .body | grep -q "Closes #96"` succeeds.

**Validation commands**

```bash
git rev-parse --abbrev-ref HEAD
gh pr view --json baseRefName,body --jq '.baseRefName, .body'
```

**Dependencies:** Milestone 1.1.

**Commit boundary:** no extra commit; reuse 1.1 commit.

### Milestone 1.3 - Post run-complete marker comment

**Tasks**

- Post a PR comment containing the literal text `aidd-orchestrator:run-complete`.
  - Use `gh pr comment <pr> --body "aidd-orchestrator:run-complete"`.

**Acceptance criteria**

- `gh pr view --json comments --jq '.comments[].body' | grep -q "aidd-orchestrator:run-complete"` succeeds.

**Validation commands**

```bash
gh pr view --json comments --jq '.comments[].body' | grep -q "aidd-orchestrator:run-complete"
```

**Dependencies:** Milestone 1.2.

**Commit boundary:** none (PR-level metadata only).

## Decisions Record

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Plan size | Single phase, three small milestones | Task is trivial (1 file, 1 line); over-decomposition would add noise. |
| 2 | Trailing newline | Allow optional single trailing newline | Most editors and `git` favor newline-terminated files; the spec's "no trailing newline issues" clause clarifies the *string content* is `hello from v2`, not that the file must be exactly 13 bytes. The acceptance check uses `cat` equality which is newline-tolerant. |
| 3 | Commit scope | One commit, only the marker file | Keeps PR diff minimal and reviewable; matches the smoke-test intent. |
| 4 | PR body format | Free-form body containing `Closes #96` | Spec only requires the closing keyword; no template needed. |
| 5 | Marker comment timing | Posted after PR is opened, as the final step | Marker signals run completion; posting it earlier would lie about state. |

## Out-of-scope / Escalations

- None. The spec is fully self-contained and unambiguous.
