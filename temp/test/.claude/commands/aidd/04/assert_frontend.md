---
name: 'aidd:04:assert_frontend'
description: 'Assert a frontend feature works as intended.'
argument-hint: 'The frontend behavior you need to assert and validate.'
---

# Goal

Assert that this frontend feature works as intended:

```text
$ARGUMENTS
```

## Rules

- Use an existing browsing tool (or MCP) when navigating URL based on our context.
  - Screenshots MUST be used to validate UI.
- Use task template to track your progress
- Suppose all servers are already started
- Minor visual discrepancies (1-2px differences, slight color variations) are acceptable unless explicitly specified in the initial request.

## Ressources

### Tracking issue template

```markdown
@aidd_docs/templates/aidd/task.md
```

## Steps

Iterate over those steps until the feature work as intended.

1. Parse the user's initial request to extract expected requirements (visual, functional, technical), summarize them.
   1. List action paths (e.g. user clicks button -> calls function in file1 -> updates state in file2...).
2. Open the provided URL using an existing browsing MCP.
   1. Inspect the page visually and technically to identify what was actually implemented.
   2. Confirm the issue
3. Explore the codebase to find relevant files and code snippets related to this issue.
4. Fill the template
   1. List 3 best potential causes with small description + confidence level.
5. Looping to fix the issue:
   1. Take first potential cause.
   2. Try to fix it.
   3. Validate the fix.
   4. If not fixed, check the box and go to next potential cause.
   5. When no more potential causes left, reevaluate and rething, then put 3 new potential causes in task template.
   6. Retry this phase.
