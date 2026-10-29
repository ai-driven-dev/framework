---
name: 05-review
description: Reviews a change or a diff and says whether it is ready to ship, naming every problem with its fix, or answers the review comments left on a pull request. Use when the user wants a change checked before it ships, or a pull request's comments answered. Not for fixing what the review finds, and not for auditing a whole codebase.
argument-hint: diff | plan | pull request
---

# Review

```mermaid
flowchart LR
  all([all axes]) --> prepare
  one([selected axes]) --> prepare
  prepare -->|selected only| review-code & review-functional & review-relevancy --> finalize
  finalize --> approve([approve])
  finalize --> changes([changes-requested])
  finalize --> blocked([blocked])
  changes -.->|a later run| all
  blocked -.->|a later run| all
  pr([pull request comments]) --> answer-comments --> propose-learnings --> summary([summary posted])
```

## Actions

Run the flow above, reading only the next action file.

| Action | Does |
| --- | --- |
| prepare | resolve the diff and open the round |
| review-code | grade the changed lines on clean code |
| review-functional | trace the diff against the plan's criteria |
| review-relevancy | judge whether the change belongs |
| finalize | judge the round and check its shape |
| answer-comments | reply to each open comment in one line, resolve the settled ones |
| propose-learnings | propose the feedback worth keeping, and post the summary |

## Transversal rules

- Ask which entry the caller wants when the request does not say.
- Review statically: never run the app.
