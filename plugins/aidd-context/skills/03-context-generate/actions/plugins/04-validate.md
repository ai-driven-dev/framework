# 04 - Validate

Verify the new plugin loads cleanly and matches the framework's conventions
before declaring success, using the appropriate per-tool validation path.

## Inputs

- `plugin_name`, `confirmed_tools`, `blocked_tools` from action 01.

## Outputs

```yaml
validation_status: pass | fail
per_tool:
  - tool: <id>
    status: pass | fail | blocked
    findings:
      - path: <file>
        severity: error | warning
        rule: <rule id>
        detail: <one-line>
```

## Depends on

- `02-scaffold-tree`

## Validation commands per tool

| Tool           | Validator command                             | Fallback when no validator                                     |
| -------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Claude Code    | `claude plugin validate <manifest-dir>`       | n/a (validator available)                                      |
| Cursor         | none                                          | JSON parse `.cursor-plugin/plugin.json` + required-key check (`name`) |
| GitHub Copilot | none                                          | JSON parse `plugin.json` + required-key check (`name`, max 64 chars, kebab-case) |
| Codex CLI      | none                                          | JSON parse `.codex-plugin/plugin.json` + required-key check (`name`, `version`, `description`) |
| OpenCode       | D2-blocked (O1) — no manifest, no validator  | n/a                                                            |

Required keys per tool are sourced from `@../../references/ai-mapping.md` (each tool's Plugins section).

## Process

1. For each confirmed (non-blocked) tool, resolve the manifest directory from `@../../references/ai-mapping.md`.
2. **Schema check.**
   - Claude Code: run `claude plugin validate <plugins-root>/<plugin_name>`. Map every error/warning into `findings[]`.
   - All other tools: JSON-parse the manifest file; if invalid JSON, record an error finding. Then check that every required key for that tool (per `ai-mapping.md`) is present and non-empty; record an error finding for each missing required key.
3. **Name parity.** For each tool: `plugin.json` `name` matches the directory name and matches the `<plugin>` segment used in every nested skill frontmatter `name:`.
4. **Artifact-set parity.** For each slot enabled in `artifact_set`, at least one artifact file exists (or a `.gitkeep` is present and intentional). For each slot disabled, the corresponding subdir is absent.
5. **Seed-skill structure.** If a seed skill was created, run `@../skills/06-validate.md` against `<plugins-root>/<plugin_name>/skills/01-<seed_skill.name>/`; any `❌` row downgrades `validation_status` to `fail`.
6. **Plugin reload smoke.** For Claude Code only: when the host runtime supports it, invoke `/reload-plugins` and confirm the new plugin appears in the load report. Skip with a warning otherwise.
7. Set `validation_status = pass` iff no `error`-severity finding was recorded across all confirmed tools.

## Test

`validation_status == pass`; for Claude Code: `claude plugin validate` reports zero errors; for other confirmed tools: JSON parse succeeds and all required keys are present; name parity holds for every confirmed tool; each D2-blocked tool has `status: blocked` and is not validated.
