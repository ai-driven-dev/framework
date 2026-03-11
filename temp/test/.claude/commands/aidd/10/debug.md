---
name: 'aidd:10:debug'
description: 'Debug issue to find root cause.'
---

# Goal

Debug an issue in the codebase to eliminate not-valid assumptions.

## Rules

- Draw a quick fix plan.
- Use task system to track hypothesis validation.

## Context

### Mermaid rules

```md
@.claude/rules/01-standards/1-mermaid.md
```

### Task template

```md
@aidd_docs/templates/aidd/task.md
```

## Steps

You will create a list of potential causes for the issue, for each of them, keep trace in a todo list of the actions you took to validate or invalidate the cause.

1. Summarize the issue with your own words.
2. List action paths using mermaid flowchart. (e.g. user clicks button -> calls function in file1 -> updates state in file2...).
3. Apply the 5 Whys technique to find root cause:
   - Start from the symptom/error
   - Ask "Why?" iteratively (minimum 3, up to 5 times)
   - Document each level with numbered list
4. Find relevant tools to inspect the issue (e.g. MCP, cli commands, logs, etc.).
5. Find relevant files to find bug in codebase based on issue description.
6. List 3-5 best potential causes in a table with:
   1. Analysis
   2. Evidences
   3. Confidence level (1 out of 10)
7. Create a task for each hypothesis:
   - [ ] Hypothesis 1: <description>
   - [ ] Hypothesis 2: <description>
   - [ ] Hypothesis 3: <description>
8. Validate each hypothesis one by one:
   - Check the task when validated or invalidated
   - Add evidence in the task description
   - Stop when root cause is found
9. Your conclusions and next steps.
10. **Wait for user validation.**
11. If all hypotheses invalidated → use `/reflect_issue` for new sources.
