# 01 - Wireframe

Parse the product input, draft low-fidelity wireframes per the template, validate with the user, then save the file under `aidd_docs/tasks/`.

## Inputs

```yaml
prd_path: aidd_docs/tasks/<...>-prd.md   # optional; preferred source when available
feature_description: <free text>         # required when no prd_path is given
user_flows: [<flow name or text>]        # optional; flows to anchor the screens
platform: web | mobile | responsive      # optional; asked during clarify when omitted
screen_types: [<page type>]              # optional; asked during clarify when omitted
```

## Outputs

```yaml
wireframe_path: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-wireframe.md
feature_name: <kebab-case slug>
sections_present:
  - screen-inventory
  - layouts
  - component-hierarchy
  - navigation-flow
  - states-and-annotations
  - responsive-notes
  - open-questions
```

## Process

1. **Read the source**. When `prd_path` is given, read the PRD and extract the screens from its user flows, information architecture, and acceptance criteria; reuse its `feature_name` so the wireframe sits next to the PRD. Otherwise work from `feature_description`. If neither is usable, ask the user to point to a PRD or describe the feature before continuing.
2. **Clarify before drawing**. Propose a screen inventory derived from the source and, for each screen, the screen type (form, list, detail, dashboard, ...). Confirm `platform` (web / mobile / responsive) and the user flows in scope. Surface assumptions and ask the user to confirm or adjust. Iterate until the inventory and screen types are agreed; never start layouts on an unconfirmed inventory.
3. **Draft**. Fill `assets/wireframe-template.md`: list every agreed screen, draw an ASCII layout and component hierarchy per screen, express the navigation flow as a Mermaid `flowchart`, annotate empty, loading, and error states, and note responsive behavior. Mark unknowns as `TBD: <question>`.
4. **Validate**. Show the full draft to the user. Wait for explicit approval. Apply revisions and re-show on each iteration.
5. **Save**. Write the approved wireframe to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-wireframe.md`. Create the month directory when missing.
6. **Return** the structured Outputs block.

Do not self-validate. When a caller needs a quality gate, it spawns a reviewer with `@assets/wireframe-validator.yml`; findings come back for the next revision.

## Test

- **File saved**: `wireframe_path` exists on disk after the action completes.
- **No orphan screens**: every screen in the file traces to a user flow, information-architecture entry, or acceptance criterion in the source.
- **Traceable to source**: when `prd_path` was given, `feature_name` matches the PRD's and every user flow in scope maps to at least one screen.
- **All sections**: the file contains every heading listed in `sections_present`.
- **Navigation flow**: the file contains at least one Mermaid `flowchart` block.
- **No code**: the file has no executable code blocks (no ```html, ```css, ```js) and no component markup describing how to build the UI.
