# Tracking file template

Canonical format for task files in `{{DOCS}}/tasks/<task-name>.<status>.md`. Used by SA-01 to create files. Autonomous agents don't read this — they read the task file itself.

## File naming

| Status | Example | Meaning |
|--------|---------|---------|
| `pending` | `fix-auth.pending.md` | Created, not started |
| `in-progress` | `fix-auth.in-progress.md` | Loop running |
| `done` | `fix-auth.done.md` | Success verified |

Status = filename. Rename to change status.

## File format

```markdown
---
name: <task-slug>
objective: "<What must be true when done. One sentence.>"
success_condition: "<Command that proves done. Example: 'npm test exits 0 AND coverage > 80%'>"
rules:
  - "<Constraint for every iteration>"
iteration: 0
created_at: "2026-04-07T14:32:15Z"
---

# <Feature Name>

<Full description. Everything a new agent needs without asking questions.>

## Journey Map

<ASCII diagram. Steps, dependencies, tools needed.>

## Steps

- [ ] <Step 1>
- [ ] <Step 2>
- [ ] <Step 3>

## Log

<!-- APPEND ONLY. One entry per step attempt. -->
<!-- ### #N — YYYY-MM-DDTHH:MM:SSZ -->
<!-- > step — what worker tried -->
<!-- = ✓|✗ verification result -->
<!-- → next step or RETRY: why -->
```

## Log examples

**Step verified ✓ :**
```markdown
### #1 — 2026-04-07T14:32:15Z
> Install plugin — /plugin marketplace add mvanhorn/last30days-skill
= ✓ plugin registered in installed_plugins.json, /last30days command available
→ next: generate API key
```

**Step failed, retry :**
```markdown
### #2 — 2026-04-07T14:35:00Z
> Generate API key — navigated to scrapecreators.com, created account
= ✗ sign-up form returned 500 error on submit
→ RETRY: try again, check if site is back up
```

**Step failed, different approach :**
```markdown
### #3 — 2026-04-07T14:38:00Z
> Generate API key — retry sign-up on scrapecreators.com
= ✗ site still down
→ RETRY: use alternative — check if free tier exists on RapidAPI
```

## Rules

- Files in `{{DOCS}}/tasks/`, named `<task-slug>.<status>.md` (kebab-case).
- Files are committed — they are a decision record.
- Log is append-only. Never rewrite history.
- One Log entry per step attempt. One agent per step.
- `success_condition` must be a runnable command.
- The agent auto-accepts everything and acts as the user.
- Loop never stops — runs until success_condition is met.
