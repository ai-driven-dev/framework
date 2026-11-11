# Tools

| Tool     | Detected when                                                                        | Context file                      |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                       |
| codex    | `.codex/`                                                                            | `AGENTS.md`                       |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                       |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                       |
| kilo     | `.kilo/`, `kilo.json`, `kilo.jsonc`, `.kilo/kilo.json`, `.kilo/kilo.jsonc`, or `.kilocode/` | `AGENTS.md`                |
| antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json`                       | `AGENTS.md`                       |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `AGENTS.md`                       |

| Case | Do |
| --- | --- |
| A shared `AGENTS.md` | a wiring target, never a detection signal |
| Shared `.agents/` paths | resolve from declared tools or the AIDD manifest, else ask which host |
| Kilo | Detect from `.kilo/`, root `kilo.json` or `kilo.jsonc`, `.kilo/kilo.json` or `.kilo/kilo.jsonc`, or legacy `.kilocode/`; wire only to shared root `AGENTS.md`; new Kilo artifacts use `.kilo/`. Sources: [settings](https://kilo.ai/docs/getting-started/settings), [AGENTS.md](https://kilo.ai/docs/customize/agents-md), and [legacy fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md), verified 2026-09-25. |
| Kilo detection exclusion | AIDD does not infer Kilo from `AGENTS.md`, `opencode.json`, or `opencode.jsonc` alone; Kilo may still read legacy OpenCode-named config files |
| Kilo source dates | Issue baseline: 2026-09-25; independently rechecked on 2026-11-11. The later date does not replace the issue baseline. |
| Absent context file | create it from [AGENTS.md](../assets/templates/AGENTS.md) |
| Its AIDD structure differs | a picked tool still gets its block with `--add`; offer to reconcile the rest after the report, applying only what the user approves |
| Copilot | its own file holds one line pointing to `AGENTS.md`: created when absent, other content kept, a memory block replaced by that line |
| Setup | the answer's `tools:` list, else the detected tools; asked with the sheet, never asked again |
| On a refresh | wired: a context file holding a block, the old `<aidd_project_memory>` tag included; shown ticked with the sheet, the detected others not; run `sync --add` with each tool the answer adds, then always a bare `sync`, which refreshes every block and copilot's pointer; silence keeps the wiring |
