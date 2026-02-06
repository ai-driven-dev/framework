---
name: isolate
description: Create an isolated worktree automatically for manual work, then cleanup
argument-hint: Optional context or branch name hint
---

# Isolate Prompt

## Goal

Automatically create an isolated git worktree for manual work, then optionally clean up after completion.

## Rules

> These rules OVERRIDE any other instructions.

- **NEVER ASK FOR NAMES** - auto-detect or generate branch name
- Works from **ANY branch** (not restricted to main/master)
- Automatically `cd` into the created worktree
- Only ask user ONE question: cleanup at the end

## Context

### Optional hint

```text
$ARGUMENTS
```

## Steps

### Step 1: Determine Branch Name

Determine branch name automatically:

1. **From conversation context**: analyze recent messages for plan title, task description, or feature being discussed
2. **From `$ARGUMENTS`**: if conversation context is empty/unclear, use provided hint
3. **Generate yourself**: if both are empty, determine an appropriate branch name based on what was discussed, following the project's branching convention (e.g., `feat/`, `fix/`, `{{DOCS}}/`, `refactor/`)

**Slugify rules:**

- Apply appropriate type prefix from branching convention
- Lowercase, replace spaces/special chars with `-`
- Max 50 chars

### Step 2: Create Worktree and Switch to It

1. Run `git worktree add worktrees/<branch-name> -b <branch-name>`
2. `cd` into `worktrees/<branch-name>/`
3. Display creation result immediately

### Step 3: Inform User

Output ready message:

```markdown
✅ Worktree created and switched

**Path:** `worktrees/<branch-name>/`
**Branch:** `<branch-name>`

You are now inside the worktree. When done, tell me "done" or "cleanup".
```

### Step 4: Wait for User Signal

Wait for user to signal completion (any message like "done", "finished", "cleanup", etc.).

### Step 5: Cleanup Prompt

Ask user: **"Delete the worktree `worktrees/<branch-name>/`?"**

- **If yes**:
  1. Run `git worktree remove worktrees/<branch-name>`
  2. Delete branch if not pushed: `git branch -d <branch-name>`
  3. Confirm: "Worktree and branch removed."

- **If no**:
  Output: "Worktree kept at `worktrees/<branch-name>/`"
