# 05 - Write action files

One file per action in the plan.

## Inputs

- `action_plan` (from 03)
- `<skill>/SKILL.md` (from 04)

## Outputs

Directory state for a hypothetical `slack` skill:

```
slack/
├── actions/
│   ├── post-message.md
│   ├── get-history.md
│   └── create-channel.md
├── assets/                ← optional
├── references/            ← optional
├── scripts/               ← optional, skill-specific helpers
├── .env                   ← gitignored, real keys
├── .env.local             ← gitignored, per-key generation URL + 1-line how-to
└── SKILL.md
```

## Process

1. For each action in the plan: copy `@assets/skills/action-template.md`, fill each `<placeholder>` per its inline annotation. Transcribe the `test` cell from 03 **verbatim** into the `## Test` section.
2. Secrets are **per-skill, never at repo root**. Each skill owns `<skill>/.env` (gitignored, real keys, one `KEY=value` per line) and `<skill>/.env.local` (gitignored, for each key: generation URL + one-line how-to with scopes / plan tier / dashboard path). Add the `<skill>/.env` and `<skill>/.env.local` patterns to root `.gitignore`. Non-secret data follows R7: cross-skill → shared root folder; skill-specific → `<skill>/assets/` or `<skill>/references/`.
3. API calls → reusable Node.js script at `<skill>/scripts/<slug>.js`. The script loads `<skill>/.env` at startup before any API call (e.g. `dotenv.config({ path: path.join(__dirname, '../.env') })`) and fails fast with an explicit error if a required key is missing. The action invokes `node scripts/<slug>.js <args>`. No inline `curl` or fetch logic in `## Process`. Bash only for CLI-native tools (`gh`, `pdftotext`).
4. Skill-specific helpers go in `<skill>/scripts/`. Never duplicate generic validators.
5. Composition is mandatory. Any template, reference, or script consumed by the action is included via `@<path>` (e.g. `@assets/skills/action-template.md`, `@scripts/get-weather.js`). Never write "read X then apply" - emit the `@<path>` directly so the resolver injects the file at runtime.

## Test

For each slug in the action_plan, `<skill>/actions/<NN>-<slug>.md` exists and contains `## Inputs`, `## Outputs`, `## Process`, `## Test`; the slugs in the SKILL.md action table match the filenames in `<skill>/actions/`.
