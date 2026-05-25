# 03 - Seed first skill

Generate one starter skill inside the new plugin by delegating to the skill-generation flow.

## Inputs

- `plugin_name` (required) - from action 01.
- `seed_skill.name` (optional) - from action 01.
- `seed_skill.description` (optional) - from action 01.
- `<plugins-root>/<plugin_name>/skills/` directory created by action 02.

## Outputs

```yaml
seed_skill_path: <plugins-root>/<plugin_name>/skills/01-<seed_skill.name>/
seed_skill_status: created | skipped
```

## Depends on

- `02-scaffold-tree`

## Process

1. Self-skip when `seed_skill.name` is empty. Set `seed_skill_status = skipped` and return.
2. Set working location to `<plugins-root>/<plugin_name>/skills/` with skill prefix pinned to `01-`.
3. Run the skill-generation flow against that location, in order, passing `skill_name = seed_skill.name` and `expected_output = seed_skill.description`:
   - `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/01-capture-intent.md`
   - `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/02-design-evals.md`
   - `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/03-decompose-actions.md`
   - `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/04-draft-skill.md`
   - `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/05-write-actions.md`
   - `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/06-validate.md`
4. Each upstream action's `## Test` must pass before the next is invoked, per the skill flow's own contract.
5. Record `seed_skill_status = created` once `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/06-validate.md` returns a green table.

## Test

When `seed_skill.name` was provided, `<plugins-root>/<plugin_name>/skills/01-<seed_skill.name>/SKILL.md` exists and its frontmatter `name:` equals `<plugin_name>:01:<seed_skill.name>`; the validate step from the skill flow reports every action ✅. When skipped, no `skills/01-*` folder is created and `seed_skill_status = skipped` is returned.
