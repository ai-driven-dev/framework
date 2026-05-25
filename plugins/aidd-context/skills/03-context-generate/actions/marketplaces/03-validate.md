# 03 - Validate marketplace

Run validation checks and install-time invariants before the marketplace is shared, per confirmed tool.

## Inputs

- `marketplace_files` (required) - from `@01-init-marketplace.md`.
- `confirmed_tools`, `blocked_tools` (from `@01-init-marketplace.md`).

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
    install_smoke:
      added: true | false
      installed_plugins:
        - <plugin_name>: ok | failed
```

## Depends on

- `01-init-marketplace`
- `02-add-plugin-entry` (at least one entry must be present per tool, otherwise skip install smoke and surface a warning)

## Validation commands per tool

| Tool           | Validator command                           | Fallback when no validator                                  |
| -------------- | ------------------------------------------- | ----------------------------------------------------------- |
| Claude Code    | `claude plugin validate <repo-root>`        | n/a (validator available)                                   |
| Cursor         | none                                        | JSON parse `.cursor-plugin/marketplace.json` + reserved-name check |
| Codex CLI      | none                                        | JSON parse `.agents/plugins/marketplace.json` + required-key check |
| OpenCode       | D2-blocked (O1) - no marketplace file      | n/a                                                         |
| GitHub Copilot | D2-blocked - settings-driven, no per-repo file | n/a                                                      |

## Process

For each confirmed (non-blocked) tool:

1. **Schema check.**
   - Claude Code: run `claude plugin validate <repo-root>`. Map every error/warning into `findings[]`. Block on any `error` severity.
   - Cursor / Codex CLI: JSON-parse the marketplace file; if invalid JSON, record an error finding. Check that required keys are present and non-empty per `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/marketplace.md` and `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Record error findings for missing keys.
2. **Reserved-name check.** Reload the marketplace JSON and re-confirm `name` is not on the reserved list in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/marketplace.md`.
3. **Source-shape check** (shape rules: `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/marketplace.md`):
   - relative path -> directory exists, contains the tool's expected manifest file, no `..` segments.
   - `github` -> `repo` is `owner/name` shape; `sha` (if present) is 40 hex chars.
   - `url` / `git-subdir` -> `url` is a valid git URL; `git-subdir` has a non-empty `path`.
   - `npm` -> `package` non-empty.
4. **Cross-source duplicates.** No two entries share `plugin_name`.
5. **Local install smoke (Claude Code only).** When safe (clean working tree, user opt-in), run:
   - `claude plugin marketplace add <repo-root>`
   - `claude plugin install <first-plugin>@<marketplace_name>`
   - Record success/failure per plugin in `install_smoke.installed_plugins`.
   - Always remove the test marketplace afterwards: `claude plugin marketplace remove <marketplace_name>`.
6. Set `validation_status = pass` iff all confirmed tools produced no `error` findings AND (smoke skipped OR every Claude Code install reported `ok`).

## Test

`validation_status == pass`; for Claude Code with at least one entry, `install_smoke.added == true` and every `installed_plugins` entry is `ok` (or explicitly skipped with a logged warning); Cursor and Codex CLI marketplace files parse as valid JSON with required keys present; each D2-blocked tool has `status: blocked`.
