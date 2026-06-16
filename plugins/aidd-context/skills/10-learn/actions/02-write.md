# 02 - Write

Create or update files for each approved item from action 01, using the matching template when applicable.

## Inputs

- Approved plan emitted by action 01 (numbered items with `category` + `destination`).

## Outputs

```
One or more files created or updated across:
  aidd_docs/memory/<file>.md
  aidd_docs/internal/decisions/<id>-<title>.md
  ADR.md
  <project rules location>/<file>.md
```

A summary table: `item | destination | action taken (created | updated)`.

## Process

1. **For each approved item**, apply by category:
   - **Decision** → create `aidd_docs/internal/decisions/XXX-<title>.md` from `@../assets/decision-template.md`; assign the next `DEC-XXX` id.
   - **ADR row** → update `ADR.md` using `@../assets/adr-template.md` shape (one new row referencing the decision file).
   - **Memory** → update the matching `aidd_docs/memory/<file>.md`. Append or revise the relevant section; preserve user customizations.
   - **Rule** → create or update the file under the project rules location.
   - **Skill / Template** → create or update under the project skills or assets location.

2. **Apply content rules** (from the skill-level rules in `SKILL.md`):
   - Concise, focused, no filler.
   - Reference only the section that the new info affects; do not rewrite entire files.

3. **Print the summary table** listing every item, its destination, and whether it was `created` or `updated`.

## Test

Every item from the approved plan has a corresponding entry in the summary table with `created` or `updated`; for `created` entries, the destination file exists on disk; for `updated` entries, the destination file contains the new content.
