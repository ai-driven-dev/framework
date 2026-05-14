---
objective: Add file `aidd_docs/hello-async.txt` containing exactly the string `hello`.
success_condition: File `aidd_docs/hello-async.txt` exists at the repository root under `aidd_docs/` and its visible content is exactly `hello` (a single trailing newline is acceptable; no other characters).
iteration: 0
created_at: 2026-05-14
---

# Plan - Issue #99 - Add `aidd_docs/hello-async.txt`

## Context

This is a minimal smoke-test issue used to exercise the async-dev pipeline end-to-end. The change is a single new text file with fixed content. No source code, no dependencies, no build/test impact.

## Rules

| # | Rule | Rationale |
|---|------|-----------|
| R1 | Touch only `aidd_docs/hello-async.txt` and the plan/run artifacts. | Keep the diff minimal and the smoke-test signal clean. |
| R2 | File content must be exactly the visible string `hello`. A single trailing newline (`hello\n`) is acceptable; nothing else is. | Matches the acceptance criteria verbatim. |
| R3 | Do not modify `CLAUDE.md`, memory files, skills, plugins, or any existing code. | This is a non-functional smoke test; unrelated edits would pollute the run. |
| R4 | Do not install packages, run formatters, or run build commands. | None are needed; avoid noise and side effects. |
| R5 | Commit on a feature branch, never directly to `main`. | Repo policy; async-dev pipeline opens a PR. |
| R6 | Use a conventional commit message such as `chore(async-dev): add hello-async smoke-test file (#99)`. | Matches recent commit style in the repo. |

## Milestones / Phases (M / C / D)

Format key: **M** = Make (do the work) - **C** = Check (validate) - **D** = Done-when (acceptance).

### Phase 1 - Create the file

- **M1.1** Create `aidd_docs/hello-async.txt` at the repository root path `/home/runner/work/aidd-framework/aidd-framework/aidd_docs/hello-async.txt`.
- **M1.2** Write the exact content `hello` to that file. A single trailing newline is permitted (most editors add one); no other whitespace, no BOM, no extra lines.
- **C1.1** Run `test -f aidd_docs/hello-async.txt` - must exit 0.
- **C1.2** Run `cat aidd_docs/hello-async.txt` - output must be `hello` (optionally followed by a single newline).
- **C1.3** Run `wc -c aidd_docs/hello-async.txt` - byte count must be either `5` (no newline) or `6` (with trailing newline).
- **C1.4** Run `git status --porcelain aidd_docs/hello-async.txt` - must show the file as added/untracked.
- **D1** File exists with exact visible content `hello` and is staged for commit.

### Phase 2 - Commit on a feature branch

- **M2.1** Ensure the working branch is the async-dev feature branch for issue #99 (the pipeline orchestrator creates/uses one; do not branch from a dirty tree).
- **M2.2** Stage only `aidd_docs/hello-async.txt` (use the explicit path, not `git add -A`).
- **M2.3** Commit with a message like `chore(async-dev): add hello-async smoke-test file (#99)`.
- **C2.1** `git log -1 --name-only` - the commit must list exactly one changed file: `aidd_docs/hello-async.txt`.
- **C2.2** `git diff main...HEAD -- aidd_docs/hello-async.txt` - shows the new file with content `hello`.
- **C2.3** `git status` - clean working tree after commit.
- **D2** A single commit on the feature branch introduces the file and nothing else.

### Phase 3 - Hand off to PR

- **M3.1** Allow the async-dev orchestrator to push the branch and open the PR; the planner/implementer does not push.
- **C3.1** Branch is pushed to origin and a PR is opened linking issue #99.
- **C3.2** PR diff contains exactly one added file: `aidd_docs/hello-async.txt` with content `hello`.
- **D3** PR is open, linked to issue #99, ready for review by the async-review skill.

## Validation commands (full set)

Run from the repo root:

```bash
test -f aidd_docs/hello-async.txt && echo "exists"
cat aidd_docs/hello-async.txt
wc -c aidd_docs/hello-async.txt
git status --porcelain
git log -1 --name-only
```

Expected: file exists; content is `hello` (optionally with one trailing newline); byte count is 5 or 6; only `aidd_docs/hello-async.txt` is changed; the latest commit on the feature branch touches only that file.

## Out of scope

- Any change to memory, skills, plugins, CI, hooks, or existing docs.
- Adding tests, lint configs, or formatters.
- Modifying the issue/PR templates or labels (those are managed by the orchestrator).

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Editor inserts a final newline, producing `hello\n` (6 bytes). | Acceptance criteria explicitly permits this - no action needed. |
| `git add -A` sweeps in unrelated files. | R1 + M2.2: stage the explicit path only. |
| Wrong base branch. | M2.1: rely on the orchestrator's feature branch; do not commit on `main`. |

## Done

The plan is satisfied when Phase 1, Phase 2, and Phase 3 all reach their D-state and the validation commands above produce the expected outputs.
