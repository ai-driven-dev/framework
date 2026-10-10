# Persistence

| File | Path |
| --- | --- |
| team roadmap | `aidd_docs/product/roadmaps/<quarter-slug>.md` |
| stakeholder view | `aidd_docs/product/roadmaps/<quarter-slug>-stakeholders.md` |

`<quarter-slug>` is the quarter label in kebab-case, for example `2026-q4` or `fy27-q1`. Several products in one project: prefix it with the product slug.

| Situation | Result |
| --- | --- |
| explicit target | use it |
| no roadmap for the quarter | create both files |
| a roadmap for the quarter exists | update both in place; never create a second one |
| no target and no `aidd_docs/` | ask session or Markdown |

Updating keeps the file identity and appends to the change log; a past entry is never rewritten.

Relation values are project-relative paths or ticket ids.
