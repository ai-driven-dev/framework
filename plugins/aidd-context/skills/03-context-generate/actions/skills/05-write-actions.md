# 05 - Write action files

One file per action in the plan, written under each confirmed tool's skills root.

## Inputs

- `action_plan` (from 03)
- `files_written`, `blocked_tools` (from 04)
- `target_base` (from 01). Empty string means project root; `plugins/<plugin-name>/` means write under that plugin. Received via conversation context alongside `files_written`.

## Outputs

Action files written under each confirmed tool's skills root. Example layout for a hypothetical `slack` skill for two confirmed tools (shown here with `target_base = ""` i.e. project root; when `target_base = "plugins/my-plugin/"`, every path is prefixed with that value):

```
<target_base>.claude/skills/slack/
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

<target_base>.cursor/skills/slack/
├── actions/
│   └── ...
└── SKILL.md
```

## Process

1. For each confirmed tool from `files_written`, resolve the skill root `<tool skills root>/<skill_name>/` from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Prepend `target_base` to every write path (e.g. when `target_base = ""`: `.claude/skills/<skill_name>/actions/`; when `target_base = "plugins/my-plugin/"`: `plugins/my-plugin/.claude/skills/<skill_name>/actions/`). Paths are CWD-relative; write them directly under the workspace root. Never resolve paths relative to the plugin install directory. Skip any tool in `blocked_tools`.
2. For each action in the plan: copy `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/action-template.md`, fill each `<placeholder>` per its inline annotation. Transcribe the `test` cell from 03 **verbatim** into the `## Test` section. Write the file to `<target_base><tool skills root>/<skill_name>/actions/<NN>-<slug>.md`.
3. Secrets are **per-skill, never at repo root**. Each skill owns `<skill>/.env` (gitignored, real keys, one `KEY=value` per line) and `<skill>/.env.local` (gitignored, for each key: generation URL + one-line how-to with scopes / plan tier / dashboard path). Add the `<target_base><skill>/.env` and `<target_base><skill>/.env.local` patterns to `.gitignore`. Non-secret data follows R7 (see `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/generated-skill-rules.md`): cross-skill -> shared root folder; skill-specific -> `<target_base><skill>/assets/` or `<target_base><skill>/references/`.

   Under Model Y (multi-tool fan-out), secrets fan out with the rest of the skill content: one `.env` per confirmed tool's skill root (e.g. `<target_base>.claude/skills/<name>/.env`, `<target_base>.cursor/skills/<name>/.env`, `<target_base>.github/skills/<name>/.env`). Add a `.gitignore` pattern for each location to `.gitignore`. The user is responsible for populating and protecting each file at its target location; this action only creates the file and records the `.gitignore` entry.
4. API calls → reusable Node.js script at `<skill>/scripts/<slug>.js`. The script loads `<skill>/.env` at startup before any API call (e.g. `dotenv.config({ path: path.join(__dirname, '../.env') })`) and fails fast with an explicit error if a required key is missing. The action invokes `node scripts/<slug>.js <args>`. No inline `curl` or fetch logic in `## Process`. Bash only for CLI-native tools (`gh`, `pdftotext`).
5. Skill-specific helpers go in `<skill>/scripts/`. Never duplicate generic validators.
6. Composition is mandatory. Any template, reference, or script consumed by the action is included via `@<path>` (e.g. `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/action-template.md`, `@scripts/get-weather.js`). Never write "read X then apply" - emit the `@<path>` directly so the resolver injects the file at runtime.
7. **Post-write path check (MANDATORY).** After writing, MUST verify that every file in `files_written` satisfies ALL of:
   - the path is RELATIVE (no leading `/`), so it lives under the host's CWD (= workspace root); and
   - the path does NOT contain `${CLAUDE_PLUGIN_ROOT}` (would mean we wrote into the plugin install dir, which is read-only); and
   - when `target_base != ""`, the path starts with `target_base`.
   If any path violates any invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected a CWD-relative path under the workspace root prefixed with <target_base>`.

## Test

```bash
# Test: each written action file exists, contains the four required sections,
# and (when target_base is non-empty) lives under target_base
for path in "${files_written[@]}"; do
  test -f "$path" || exit 1
  grep -q "^## Inputs" "$path" || exit 1
  grep -q "^## Outputs" "$path" || exit 1
  grep -q "^## Process" "$path" || exit 1
  grep -q "^## Test" "$path" || exit 1
  if [ -n "${target_base}" ]; then
    [[ "$path" == "${target_base}"* ]] || exit 1
  fi
done
echo ok
```
