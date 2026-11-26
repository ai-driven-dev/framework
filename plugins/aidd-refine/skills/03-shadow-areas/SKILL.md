---
name: 03-shadow-areas
description: Scans a written idea, story, PRD or spec for blind spots into a shadow report, when the user wants to find what it leaves unsaid.
argument-hint: file | text
---

# Shadow Areas

```mermaid
flowchart LR
  source([file or text]) --> detect["actions/01-detect.md"]
  detect -->|"outside the workspace or a shadow report"| rejected((rejected))
  detect -->|"no prior report"| render["actions/03-render-report.md"]
  detect -->|"prior report"| diff["actions/02-diff.md"]
  diff --> render
  render --> report([report next to the source])
```

## Transversal rules

- Never modify the source artifact.
- A gap is identified by its category and snippet, else by its category and severity, never by its question's wording.
- The report sits next to its source, named by dropping the source's last extension and appending `-shadow-report.md`: `feature-v2.draft.md` gives `feature-v2.draft-shadow-report.md`, `Makefile` gives `Makefile-shadow-report.md`.
