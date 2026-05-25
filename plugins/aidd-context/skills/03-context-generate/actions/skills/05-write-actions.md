# 05 - Write action files

One file per action in the plan, written under each confirmed tool's skills root.

## Inputs

- `action_plan` (from 03)
- `files_written`, `blocked_tools` (from 04)
- `project_root` (required) - absolute path of the user's VS Code workspace (NOT the plugin install location). Resolve from `${workspaceFolder}` in Copilot, `${CLAUDE_PROJECT_DIR}` in Claude Code, or the equivalent host variable.

## Outputs

Action files written under each confirmed tool's skills root. Example layout for a hypothetical `slack` skill for two confirmed tools:

```
.claude/skills/slack/
├── actions/
│   ├── 01-post-message.md
│   ├── 02-get-history.md
│   └── 03-create-channel.md
├── assets/                ← optional
├── references/            ← optional
├── scripts/               ← optional, skill-specific helpers
├── .env                   ← gitignored, real keys
├── .env.local             ← gitignored, per-key generation URL + 1-line how-to
└── SKILL.md

.cursor/skills/slack/
├── actions/
│   └── ...
└── SKILL.md
```

## Process

1. For each confirmed tool from `files_written`, resolve the skill root `<project_root>/<tool skills root>/<skill_name>/` from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Prepend `<project_root>/` to every path derived from the mapping. Never resolve paths relative to the plugin install directory. Skip any tool in `blocked_tools`.
2. For each action in the plan: copy `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/action-template.md`, fill each `<placeholder>` per its inline annotation. Transcribe the `test` cell from 03 **verbatim** into the `## Test` section. Write the file to `<project_root>/<tool skills root>/<skill_name>/actions/<NN>-<slug>.md`.
3. Secrets are **per-skill, never at repo root**. Each skill owns `<skill>/.env` (gitignored, real keys, one `KEY=value` per line) and `<skill>/.env.local` (gitignored, for each key: generation URL + one-line how-to with scopes / plan tier / dashboard path). Add the `<skill>/.env` and `<skill>/.env.local` patterns to `<project_root>/.gitignore`. Non-secret data follows R7: cross-skill → shared root folder; skill-specific → `<skill>/assets/` or `<skill>/references/`.

   Under Model Y (multi-tool fan-out), secrets fan out with the rest of the skill content: one `.env` per confirmed tool's skill root (e.g. `<project_root>/.claude/skills/<name>/.env`, `<project_root>/.cursor/skills/<name>/.env`, `<project_root>/.github/skills/<name>/.env`). Add a `.gitignore` pattern for each location to `<project_root>/.gitignore`. The user is responsible for populating and protecting each file at its target location; this action only creates the file and records the `.gitignore` entry.
4. API calls → reusable Node.js script at `<skill>/scripts/<slug>.js`. The script loads `<skill>/.env` at startup before any API call (e.g. `dotenv.config({ path: path.join(__dirname, '../.env') })`) and fails fast with an explicit error if a required key is missing. The action invokes `node scripts/<slug>.js <args>`. No inline `curl` or fetch logic in `## Process`. Bash only for CLI-native tools (`gh`, `pdftotext`).
5. Skill-specific helpers go in `<skill>/scripts/`. Never duplicate generic validators.
6. Composition is mandatory. Any template, reference, or script consumed by the action is included via `@<path>` (e.g. `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/action-template.md`, `@scripts/get-weather.js`). Never write "read X then apply" - emit the `@<path>` directly so the resolver injects the file at runtime.

## Test

For each confirmed tool and for each slug in the `action_plan`, `<tool skills root>/<skill_name>/actions/<NN>-<slug>.md` exists and contains `## Inputs`, `## Outputs`, `## Process`, `## Test`; the slugs in each tool's `SKILL.md` action table match the filenames in that tool's `actions/` directory. No action files are written for D2-blocked tools.
