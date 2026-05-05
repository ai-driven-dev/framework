---
name: commit
description: Create git commit with proper message format. Supports both interactive (human-driven) and auto (agent-driven) flows.
argument-hint: mode=auto|interactive (default interactive), message=<imposed text>, push=true|false (default false), files=<list>
model: sonnet
---

# Commit Prompt

## Goal

Generate git commit with standardized message. Two modes: `interactive` (asks for approval, may split commits) and `auto` (no approval, single commit, message can be imposed). The `auto` path is what SDLC and the implementer agent rely on.

## Inputs

```yaml
mode: interactive | auto       # default: interactive
message: <imposed commit message>   # optional — when set, use as-is, no generation
push: true | false             # default: false (decoupled from mode)
files: [<paths>]               # optional — restrict staging to these paths
```

## Outputs

```yaml
commit_sha: <full sha>
branch: <branch name>
pushed: true | false
```

## Rules

- **`auto` mode never asks for confirmation.** No WAIT APPROVAL gates apply.
- **When `message` is provided, use it verbatim** — skip change-type detection and splitting.
- Keep commits atomic and focused.
- Clear and concise change description; imperative mood ("Add feature" not "Added feature"); explain "why" not "what".
- Follow project commit conventions (see template).
- Reference issues if applicable.
- Never `--force` push.

## Context

### Commit rules

Follow the commit conventions defined here:

```markdown
@assets/commit-template.md
```

### Previous commits

```text
! git log -5 --pretty=%B
```

## Process steps

1. **Branch resolution**
   - If branch already exists → use it.
   - Else `auto` mode → generate a sensible name from the change (no approval).
   - Else `interactive` mode → propose a name and **WAIT FOR USER APPROVAL**.
2. **Staging**
   - If `files` provided → `git add` exactly those.
   - Else → use already-staged changes (do not add unstaged files implicitly).
3. **Message**
   - If `message` arg provided → use as-is. Skip steps 4–5.
   - Else (`interactive` only) → determine change type (feat, fix, docs, etc) and draft a message.
4. **(Interactive only)** Suggest splitting commits for different concerns:
   1. List functional changes with clear commit messages.
   2. **WAIT FOR USER APPROVAL** before committing.
5. **(Interactive only)** `git add -p` for each split.
6. **Commit** — `git commit` with the chosen message.
7. If pre-commit hook errors → fix and retry. Loop here until commit succeeds.
8. Capture the resulting sha.
9. **Push** — only if `push: true`. Push with lease (`--force-with-lease`) is OK; never `--force`.
10. **Return** structured output (`commit_sha`, `branch`, `pushed`). In interactive mode, also notify the user.
