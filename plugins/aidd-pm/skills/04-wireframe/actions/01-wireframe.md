# 01 - Wireframe

Gather context, clarify the screens, copy the template into `aidd_docs/tasks/`, then fill that copy in place and validate it with the user.

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
3. **Scaffold the file**. Copy `assets/wireframe-template.md` verbatim to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-wireframe.md`, creating the month directory when missing. This is the only copy step; from here on, edit that file in place.
4. **Fill the copy**. Edit the copied file: replace each placeholder with the agreed screens (an ASCII layout and component hierarchy per screen), the navigation flow as a Mermaid `flowchart`, the empty / loading / error states, and the responsive notes. Mark unknowns as `TBD: <question>`.
5. **Validate**. Show the filled file to the user. Apply revisions directly in the file and re-show on each iteration until explicit approval.
6. **Return** the structured Outputs block.

Do not self-validate. When a caller needs a quality gate, it spawns a reviewer with `@assets/wireframe-validator.yml`; findings come back for the next revision.

## Test

- **File saved**: `wireframe_path` exists on disk after the action completes.
- **Scaffolded from template**: the file carries the section headings of `assets/wireframe-template.md`.
- **Filled, not just copied**: no template placeholder text (for example `[Screen name]`, `[Region]`) remains for the in-scope screens.
- **No orphan screens**: every screen in the file traces to a user flow or a screen the user agreed during clarify.
- **Aligned with loaded context**: when a related document was found in `aidd_docs/`, `feature_name` matches it and every user flow it describes maps to at least one screen.
- **All sections**: the file contains every heading listed in `sections_present`.
- **Navigation flow**: the file contains at least one Mermaid `flowchart` block.
- **No code**: the file has no executable code blocks (no ```html, ```css, ```js) and no component markup describing how to build the UI.
