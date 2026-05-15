# State matrix

Two-stage decision used by `actions/01-detect-state.md` and `actions/02-recommend-next.md`.

## Stage 1 - filesystem rows

Evaluated top-down by `01-detect-state`. First match wins. These rows are decidable from filesystem probes alone.

| #   | State signal                                                                                              | Next aidd-context skill        | Why                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| 1   | Greenfield: empty repo, no `aidd_docs/`, no source code, no `INSTALL.md`                                  | `aidd-context:01:bootstrap`    | Architect the stack and produce `aidd_docs/INSTALL.md` before any other context work |
| 2   | `aidd_docs/` missing OR memory bank missing OR no `<aidd_project_memory>` block in any AI context file    | `aidd-context:02:project-init` | The memory bank and context block are prerequisites for every other aidd-context skill |
| 3   | `aidd_docs/memory/` exists but one or more files still match the unedited template (placeholder content)  | `aidd-context:02:project-init` | Re-run `generate-memory` and `review-memory` to fill placeholders                    |
| 4   | Setup complete: memory bank populated, context block present, no obvious gap                              | `ask`                          | Filesystem cannot decide next step; defer to Stage 2                                 |

When `recommended_skill == ask`, action 02 jumps to Stage 2 instead of rendering the run/explain/handoff menu.

## Stage 2 - intent menu

Rendered by `02-recommend-next` only when Stage 1 returns `ask`. The user picks the situation that matches them. Each option maps to one aidd-context skill (or stop).

| Option | Situation                                                                  | Maps to                          |
| ------ | -------------------------------------------------------------------------- | -------------------------------- |
| 1      | I need to capture a learning, decision, or new convention                  | `aidd-context:05:learn`          |
| 2      | I want to add or update a Mermaid diagram                                  | `aidd-context:04:mermaid`        |
| 3      | I want to generate a new skill, agent, or rule                             | `aidd-context:03:context-generate` |
| 4      | I want to see every installed skill across plugins, not just aidd-context  | `aidd-context:06:discovery`      |
| 5      | I'm just exploring, nothing to do right now                                | stop                             |

Stage 2 is the only place where `06-discovery` is ever proposed by onboard, and only because the user explicitly asked for a cross-plugin lister.

## Conflict rules

- Stage 1 rows are evaluated top-down. First match wins.
- If the user picks an option from Stage 2 that conflicts with Stage 1 (e.g. invokes onboard before memory exists, then picks "I want to add a diagram"), Stage 1 wins; surface the conflict in one sentence before letting the user override.
- Stop (Stage 2 option 5) is the only outcome that terminates the loop. Every other outcome loops back to `01-detect-state` after execution or handoff.

## State signals reference

Used by `01-detect-state` to decide which Stage 1 row matches.

| Signal                       | Check                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `aidd_docs_present`          | `aidd_docs/` directory exists at project root                                                    |
| `memory_dir_present`         | `aidd_docs/memory/` exists                                                                       |
| `memory_files_count`         | Number of `.md` files in `aidd_docs/memory/`                                                     |
| `memory_files_filled`        | At least one memory file has more than the template's placeholder content                        |
| `context_block_present`      | `grep -l '<aidd_project_memory>' CLAUDE.md AGENTS.md .github/copilot-instructions.md` returns 1+ |
| `install_md_present`         | `aidd_docs/INSTALL.md` exists                                                                    |
| `repo_is_empty`              | No source files outside `aidd_docs/`, `.git/`, lockfiles, and dotfiles                           |
