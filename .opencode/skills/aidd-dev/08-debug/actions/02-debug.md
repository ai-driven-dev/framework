# 02 - Debug

Debug an issue in the codebase by enumerating hypotheses, validating each one, and arriving at a root cause that the user signs off on.

## Inputs

```yaml
issue: <free-form description of the symptom or error>
```

## Outputs

```yaml
root_cause: <one-line statement>
hypotheses:
  - { id: 1, description: <text>, confidence: 1-10, status: validated|invalidated, evidence: <text> }
flowchart_path: <inline mermaid block or saved file>
next_steps:
  - <action>
```

## Process

1. **Summarize the issue** in your own words.
2. **Map action paths** with a Mermaid flowchart (e.g. user clicks button -> calls function in file1 -> updates state in file2). Apply `@../references/mermaid-conventions.md`.
3. **Apply 5 Whys.** Start from the symptom and ask "why" iteratively (minimum 3, up to 5). Document each level in a numbered list.
4. **Identify inspection tools** (MCP, CLI commands, logs, traces).
5. **Locate relevant files** in the codebase based on the issue.
6. **List 3-5 potential causes** in a table with columns: Analysis, Evidence, Confidence (1-10).
7. **Track hypotheses** using the project task system and `@../assets/task-template.md`. One task per hypothesis.
8. **Validate one by one.** Tick each task when validated or invalidated. Add evidence inside the task. Stop when the root cause is found.
9. **State conclusions and next steps.**
10. **Wait for user validation** before moving on.
11. **Fallback.** If all hypotheses are invalidated, invoke the `reflect_issue` action of this skill for new sources.

## Test

The hypotheses list contains 3-5 entries; every entry has a `validated` or `invalidated` status; if any is `validated`, its evidence is non-empty and `root_cause` is a one-line statement consistent with that evidence; if every hypothesis is `invalidated`, `next_steps` cites the `reflect_issue` action.
