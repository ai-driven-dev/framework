# Codebase Map

CLI tree and where to add code: [`internal/cli/codebase-map.md`](internal/cli/codebase-map.md).

## Areas

| Path | Holds |
| --- | --- |
| `plugins/` | the product: one folder per plugin, with `plugins/<plugin>/.claude-plugin/plugin.json`, `skills/`, and optionally `agents/`, `commands/`, `hooks/`, `rules/` |
| `cli/` | the `aidd` binary |
| `kanban/` | the task board, a private package unwired from the CLI |
| `scripts/` | repository checks and generators run by lefthook and CI; tests in `scripts/__tests__/` |
| `docs/` | human docs: architecture, plugin authoring, glossary, maintainer guide |
| `aidd_docs/` | this memory bank, plus `tasks/`, `product/`, `specs/`, `recipes/`, `brainstorm/`, `release-video/` |
| `.claude-plugin/` | `marketplace.json`, the plugin manifest |
| `.claude/` | registers this checkout as a local marketplace; holds the `working-on-cli` skill |
| `.github/` | workflows, issue templates, rulesets |

## Entry points

| Entry | Path |
| --- | --- |
| Binary | `cli/src/cli.ts`, built to `dist/cli.js`, bin `aidd` |
| Workflow | `plugins/<plugin>/skills/<NN>-<name>/SKILL.md` |
| Memory hook | `plugins/aidd-context/hooks/memory.cjs`: `load` on `SessionStart`, `sync` on `Stop` |
