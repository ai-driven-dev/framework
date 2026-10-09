# Tool paths (rules)

The per-tool rules path and write targets. Rule slice only, nothing about skills, agents, commands, hooks, plugins, or marketplaces.

## Rules path per tool

| Tool           | Path                                               | Supported  |
| -------------- | -------------------------------------------------- | ---------- |
| Claude Code    | `.claude/rules/<category>/<slug>.md`               | yes        |
| Cursor         | `.cursor/rules/<category>/<slug>.mdc`              | yes        |
| GitHub Copilot | `.github/instructions/<NN>-<name>.instructions.md` | yes (flat) |
| OpenCode V2 | `.opencode/rules/<category>/<slug>.md` (editable source), published text in `AGENTS.md` | yes, through safe CLI publication |
| Codex CLI      | `.codex/rules/<category>/<slug>.md`                 | yes        |

`<slug>` is the file name `#-slug` from `rule-authoring.md` (e.g. `2-python-fstrings`). `<name>` is that slug with its leading category digit dropped (`python-fstrings`). `<category>` is the folder `<NN>-<name-of-category>`, the zero-padded category index plus the category name from the taxonomy, e.g. `01-standards`. `<NN>` is that same two-digit index.

Copilot is flat: no category folder. Its file is `<NN>-<name>`, e.g. `2-python-fstrings` becomes `02-python-fstrings` (one category prefix, no folder).

`aidd framework rules` inventories installed rule sources. An inventory entry alone does not prove that a host loads the content. Codex sources use Claude Code's `paths` array, omitted for all-files rules.

OpenCode V2 reads active guidance from `AGENTS.md`; it ignores `instructions` in JSON/JSONC configuration. Modular sources and links to them are insufficient. This generator supports V2 only; V1 discovery is not covered. See [V2 instructions](https://opencode.ai/v2/docs/instructions#configuration).

## Scope frontmatter per tool

The file-scope field is named differently per tool. Set the right one.

| Tool           | Fields                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Claude Code    | `paths` (array of globs). Omit `paths` for an all-files rule; no `paths` means it applies everywhere.  |
| Cursor         | `description` (one line, what the rule governs), `globs` (comma-separated; omit for all-files), `alwaysApply` (false; true for all-files). |
| GitHub Copilot | `applyTo` (single glob string; `**` for an all-files rule).                                          |

A multi-glob `paths` becomes a comma-joined string for Cursor and Copilot, or the most-encompassing glob.

OpenCode V2 sources retain `paths` or `globs` predicates. Publication expresses those predicates as instructions to the model; V2 provides no native per-rule glob filter.

## Detect (which tools are installed)

| Signal                            | Tool(s)        |
| --------------------------------- | -------------- |
| `.claude/` or `CLAUDE.md`         | Claude Code    |
| `.cursor/`                        | Cursor         |
| `.github/copilot-instructions.md` | GitHub Copilot |

Also detect OpenCode from `.opencode/`, `opencode.json`, or `opencode.jsonc`; each identifies an OpenCode project with V2 as this generator's target contract.

## Write targets

- **Host project**: one file per supported confirmed tool, at the paths above.
- **Plugin source**: one canonical `.md` rule under `plugins/<plugin>/rules/<category>/<slug>.md`. No per-tool fan-out. Carry a `paths` array for a scoped rule, or no frontmatter block for all-files. Per-tool frontmatter is reconciled at install.

The mode is chosen in the capture action. Never pick one silently.

For an OpenCode V2 host target, first check `aidd framework rules --help` exposes `--write` and `--from`. Stage canonical content outside project rule paths, then invoke `aidd framework rules --tool opencode --write .opencode/rules/<category>/<slug>.md --from <staged-file>` from the workspace root. The CLI validates every prospective source and the existing signed `aidd_opencode_rules` contribution before writing either source or active instructions. A second invocation replaces the same contribution. Use `--publish` to synchronize existing sources, or `--delete <rule-path>` to remove a source and its active text safely. Never write `AGENTS.md` as a whole or register it as a CLI-owned file. Preserve user guidance and the separate `aidd_project_memory` block.

If the CLI is missing, lacks these options, or refuses an edited, duplicate or incomplete block, stop and report that exact obstacle. Do not write the OpenCode source first, add `instructions` entries, or fall back to manual block replacement. Ask the user to restore the intact contribution and move desired rule edits into its modular sources. Flat archive distribution remains outside this generator's publication contract.

## Safety checks

- **Asset-access precheck**: before writing, confirm this reference is readable. If not, stop: the plugin is not installed in this host.
- **Write-target validation**: before mutation, verify relative paths remain inside the workspace at the chosen scope, including existing symlink ancestors. Recheck resulting paths after publication. Unsafe OpenCode targets must be rejected through the CLI preflight without writing either file.
