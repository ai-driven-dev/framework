# Tools

The AI tools a project can use.

| Tool     | Detected when                                                                        | Context file                      |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                       |
| codex    | `.codex/`                                                                            | `AGENTS.md`                       |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                       |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                       |
| kilo     | `.kilo/` or `kilo.json` or `kilo.jsonc` or `.kilo/kilo.json` or `.kilo/kilo.jsonc` or `.kilocode/` | `AGENTS.md`             |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md` |

- A shared `AGENTS.md` is a wiring target, never a detection signal.
- Tools sharing a context file wire it once; the block serves them all.
- A context file carries the block under a `## Memory Management` section, shaped like `assets/templates/AGENTS.md`.
- An existing context file keeps everything else: add only what is missing.
- Touch no context file a picked tool does not resolve to.

Kilo: `.kilocode/` is a legacy detection signal only; selected Kilo memory goes to the shared root `AGENTS.md`. Neither `opencode.json` nor `opencode.jsonc` identifies Kilo; OpenCode detection remains the row above.

Kilo sources: [project configuration](https://kilo.ai/docs/getting-started/settings), [legacy directory fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md), and [root `AGENTS.md`](https://kilo.ai/docs/customize/agents-md).

## Explicit sync safety

Before Upsert and Fill, inspect all selected destinations and the memory README if it carries standalone `files` markers. An absent or blockless regular file is valid for Upsert. Refuse symlink destinations or ancestors, non-regular or non-writable destinations (and non-writable creation parents), and ambiguous blocks before any write: duplicate, nested, reversed, unmatched, or mixed legacy/current marker pairs. Count only standalone marker lines outside fenced code; quoted examples are user content. Preserve bytes outside the owned block, including line endings, and leave unselected files unchanged.

The automatic hook remains best-effort. Explicit preflight prevents writes on detected configuration errors; it does not promise a multi-file transaction against a crash or a filesystem change after validation.

The hook's `--check` is a destination preflight: it checks the selected context destinations and an opted-in README for safe file types, access, and unambiguous markers. It accepts absent or blockless context files, then exits before scanning the memory bank. It does not verify that references in the context files match the bank.
