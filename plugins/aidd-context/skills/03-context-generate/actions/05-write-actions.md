# 05 — Write action files

One file per action in the plan. Follow `assets/action-template.md`.

## Inputs
- `action_plan` (from 03)
- `<skill>/SKILL.md` (from 04, validated)

## Outputs

Directory state after this action, for a hypothetical `slack` skill:

```
slack/
├── actions/
│   ├── post-message.md
│   ├── get-history.md
│   └── create-channel.md
├── assets/              ← optional: structured data / templates
│   └── channel-ids.json
├── references/          ← optional: human-readable docs
│   └── slack-api-cheatsheet.md
├── scripts/             ← optional: skill-specific JS helpers
│   └── test-post-message.js
├── .env.local           ← optional: instructions for obtaining secrets
└── SKILL.md
```

## Process

1. For each action in the plan, copy `assets/action-template.md` and fill each `<placeholder>` per its inline annotation. The template is the single source for what goes in each section.
2. File count in `actions/` must match the SKILL.md action table — no missing, no extra.
3. Place data per R7/R8:
   - Cross-skill → point to a shared folder at repo root (your project decides the path, e.g. `shared-assets/`, `05_assets/`, `design-system/`); never duplicate.
   - Skill-specific data/templates → `<skill>/assets/*.json`.
   - Skill-specific docs → `<skill>/references/*.md`.
   - Secrets → `.env` + `.env.local`.
4. For each action whose `## Test` picked Pattern A (script), write the corresponding JS file in `scripts/` — ONLY if the script is functionally specific to this skill. Never copy the structural validators (`validate-*.js`); call them directly from this skill's `scripts/` directory with a path argument.

## Test

```bash
node scripts/validate-actions.js <target-skill-path>
```
