# 01 - Wireframe

Parse the product input, draft low-fidelity wireframes per the template, validate with the user, then save the file under `aidd_docs/tasks/`.

## Inputs

```yaml
feature_description: <free text>         # required; the feature to wireframe
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

1. **Gather any available context**. The skill is callable at any stage. Load related documents from `aidd_docs/` (a PRD, user stories) when they exist, and on an existing or legacy project take cues from the current screens or behavior the user points to. Treat all of it as optional context, never a precondition: with nothing available, derive everything from `feature_description` and the clarify dialogue.
2. **Clarify before drawing**. Propose a screen inventory and, for each screen, the screen type (form, list, detail, dashboard, ...). Confirm `platform` (web / mobile / responsive) and the user flows in scope. Surface assumptions and ask the user to confirm or adjust. Iterate until the inventory and screen types are agreed; never start layouts on an unconfirmed inventory.
3. **Draft**. Fill `assets/wireframe-template.md`: list every agreed screen, draw an ASCII layout and component hierarchy per screen, express the navigation flow as a Mermaid `flowchart`, annotate empty, loading, and error states, and note responsive behavior. Mark unknowns as `TBD: <question>`.
4. **Validate**. Show the full draft to the user. Wait for explicit approval. Apply revisions and re-show on each iteration.
5. **Save**. Write the approved wireframe to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-wireframe.md`. Create the month directory when missing.
6. **Return** the structured Outputs block.

Do not self-validate. When a caller needs a quality gate, it spawns a reviewer with `@assets/wireframe-validator.yml`; findings come back for the next revision.

## Test

- **File saved**: `wireframe_path` exists on disk after the action completes.
- **No orphan screens**: every screen in the file traces to a user flow or a screen the user agreed during clarify.
- **Aligned with loaded context**: when a related document was found in `aidd_docs/`, `feature_name` matches it and every user flow it describes maps to at least one screen.
- **All sections**: the file contains every heading listed in `sections_present`.
- **Navigation flow**: the file contains at least one Mermaid `flowchart` block.
- **No code**: the file has no executable code blocks (no ```html, ```css, ```js) and no component markup describing how to build the UI.
