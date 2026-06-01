# State matrix

Decision model for `actions/01-detect-state.md` and `actions/02-recommend-next.md`.

Onboard is a **hub**, not a linear track. After detecting the project state it shows a short briefing and a menu of project actions, marks the natural starting point, and lets the user choose. It never forces a single next step, and it never assumes the user is "done" or "not done" with a phase.

Onboard never hard-codes a skill from another plugin. It works in **categories**. A category is a function ("technical planning", "shipping"), not a skill id. Each category resolves to a real installed skill at runtime by matching skill descriptions. A category with no matching installed skill is a gap, reported by function, never invented.

## The hub menu

Rendered by `02-recommend-next` on every pass, after a three-line briefing header.

| Option | Action                       | Drill-down                                                        |
| ------ | ---------------------------- | ----------------------------------------------------------------- |
| 1      | Understand this project      | Print the full project briefing, then re-show the hub             |
| 2      | Memory bank                  | Resolve `bootstrap` (greenfield), `context-setup` (init), or `memory-upkeep` (refresh) |
| 3      | Continue the SDLC            | Show the SDLC sub-menu of journey legs                            |
| 4      | List every installed surface | Resolve `discovery`                                               |
| 5      | Stop                         | End the loop                                                      |

## Suggested option

Detection marks ONE hub option as the natural starting point. A suggestion, never a forced run - the user may pick any option.

| Detected state                                                       | Suggested option                       |
| -------------------------------------------------------------------- | -------------------------------------- |
| Greenfield empty repo                                                | 2 (memory bank, resolves to `bootstrap`) |
| `aidd_docs/`, memory bank, or `<aidd_project_memory>` block missing  | 2 (memory bank, resolves to `context-setup`) |
| Memory files still match the unedited template                       | 2 (memory bank, resolves to `context-setup`) |
| Setup complete                                                       | 3 (continue the SDLC)                  |

Option 1 is always available and never marked "suggested" - it is read-only orientation the user picks when they want it.

## The SDLC sub-menu

Rendered by `02-recommend-next` when the user picks hub option 3. The detected `sdlc_phase` is shown as a one-line **hint** above the menu, never as a forced choice.

| Option | Situation                                          | Category    |
| ------ | -------------------------------------------------- | ----------- |
| 1      | Clarify a raw idea                                 | `refine`    |
| 2      | Write user stories, a PRD, or a spec               | `specify`   |
| 3      | Produce a technical implementation plan            | `plan`      |
| 4      | Implement a feature                                | `implement` |
| 5      | Review code or feature behavior                    | `review`    |
| 6      | Commit, open a pull request, or release            | `ship`      |
| 7      | Back to the hub menu                               | -           |

## The AIDD journey

The backbone the hub and the SDLC sub-menu walk together. Legs 0 and 1 (`bootstrap`, `context-setup`) are reached through hub option 2; legs 2 to 7 (`refine` through `ship`) through the SDLC sub-menu. Leg 0 (`bootstrap`) fires only on a greenfield empty repo.

| Leg | Category        | Function                                          |
| --- | --------------- | ------------------------------------------------- |
| 0   | `bootstrap`     | Architect a greenfield stack and produce `INSTALL.md` |
| 1   | `context-setup` | Project memory bank and AI context block          |
| 2   | `refine`        | Clarify and challenge a raw idea                  |
| 3   | `specify`       | User stories, a PRD, or a spec                    |
| 4   | `plan`          | Produce a technical implementation plan           |
| 5   | `implement`     | Write the code against the plan                   |
| 6   | `review`        | Review code quality and feature behavior          |
| 7   | `ship`          | Commit, open a pull request, release              |

Cross-cutting categories (reachable from the hub, not journey legs): `memory-upkeep`, `diagram`, `generate`, `discovery`.

`memory-upkeep` resolves to one of two skills depending on scope:

- **Capture a specific learning or convention** (default) -> resolve to the installed skill whose description covers capturing or recording individual project learnings, rules, or conventions.
- **Rebuild the full memory bank** -> resolve to the installed skill whose description covers initializing or refreshing the entire project memory bank.

When the user picks hub option 2 on a filled memory bank, default to the capture-specific-learning skill unless they explicitly ask for a full refresh. If only one skill matches either scope, use it for both. `context-setup` covers the initial creation of the memory bank and is distinct from both upkeep variants.

## Category resolution

For every category that needs a skill, `02-recommend-next` resolves it:

1. Take the installed AIDD skill list captured by `01-detect-state`.
2. Match the category function against each installed skill's `description`.
3. Exactly one fit -> use that skill.
4. No fit -> the category is a **gap**: report that this action needs an AIDD plugin that is not installed, described by function only. Never invent a skill id, never name a plugin id.
5. Several fit -> resolve inline, before showing any menu. Replace the single `Next: <skill>` line with a numbered pick: `Several skills match - which do you want? 1. <skill A> - <purpose> / 2. <skill B> - <purpose>`. Wait for a digit, then continue with the chosen skill. Do not show the SDLC sub-menu until this pick is resolved.

## aidd-context-installed-alone

When `only_aidd_context` is true, the categories `refine`, `specify`, `plan`, `implement`, `review`, `ship` all resolve to gaps. Onboard then:

- Keeps the hub fully usable: options 1, 2, 4 and the cross-cutting categories all resolve inside the context layer.
- When the user opens the SDLC sub-menu, states once that those legs unlock when their AIDD plugins are installed, naming the legs by function, never by plugin id.

## `sdlc_phase` - a hint only

`sdlc_phase` is derived best-effort and shown to orient the user. It NEVER selects a step on its own. "Source code present" cannot distinguish mid-build from build-finished, so onboard always lets the user pick the SDLC leg from the sub-menu.

Derivation, ambiguity always resolving to `unknown`:

- No `specs_present`, no `has_source_code` -> `idea`
- `specs_present`, little/no `has_source_code` -> `specified`
- `plan_present`, little/no `has_source_code` -> `planned`
- `has_source_code`, no `open_pr` -> `in-progress`
- `open_pr` -> `in-review`
- Signals contradict each other, or none are present -> `unknown`

## Conflict rules

- The suggested option is advisory. The user may pick any hub option.
- If the user picks an SDLC leg that needs setup not yet done (e.g. implement before the memory bank exists), surface the conflict in one sentence before complying.
- Stop (hub option 5) is the only outcome that ends the loop. Every other outcome loops back to `01-detect-state`.

## State signals reference

| Signal                   | Check                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `aidd_docs_present`       | `aidd_docs/` directory exists at project root                                                    |
| `memory_dir_present`      | `aidd_docs/memory/` exists                                                                       |
| `memory_files_filled`    | At least one memory file has more than the template's placeholder content                        |
| `memory_state`           | Derived: `absent`, `placeholder`, or `filled`                                                    |
| `context_block_present`  | `grep -l '<aidd_project_memory>' CLAUDE.md AGENTS.md .github/copilot-instructions.md` returns 1+ |
| `repo_is_empty`          | No source files outside `aidd_docs/`, `.git/`, lockfiles, and dotfiles                            |
| `has_source_code`        | Source files exist outside `aidd_docs/`                                                           |
| `detected_stack`         | A stack manifest is present (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`) |
| `specs_present`          | `aidd_docs/specs/` directory exists, OR at least one file matching `*-spec.md`, `*-prd.md`, or `*-stories.md` exists anywhere in `aidd_docs/` except `aidd_docs/tasks/` |
| `plan_present`           | A technical plan doc exists in `aidd_docs/`                                                       |
| `open_pr`                | The current branch has an open pull or merge request                                             |
| `installed_aidd_plugins` | AIDD plugins enabled in the AI tool                                                              |
| `installed_aidd_skills`  | Skills exposed by those plugins, with their `description`                                         |
| `only_aidd_context`      | `aidd-context` is the sole installed AIDD plugin                                                  |
| `sdlc_phase`             | Derived hint: `idea`, `specified`, `planned`, `in-progress`, `in-review`, or `unknown`            |

### `memory_state` derivation

- No `aidd_docs/memory/` -> `absent`
- `aidd_docs/memory/` exists but `memory_files_filled` is false -> `placeholder`
- `memory_files_filled` is true -> `filled`
