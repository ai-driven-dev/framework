# Sub-agent verification

Current state, 2026-10-21, merged with next. Behavior and sources are in [the agent guide](../../../../docs/SUBAGENTS.md).

## Scope

- **Agents:** explorer, executor, validator and reviewer ship with the CLI, outside plugins. `aidd agents install --provider --ide` writes them per project; `--scope user` writes them to the IDE's user directory (Claude Code, Codex, OpenCode). Ownership hashes guard every write; retired roles are removed when unmodified.
- **Models:** [agent-models.json](../../../../cli/src/contexts/tools/domain/formats/agent-models.json) maps roles to `main`, `standard` and `light` profiles per provider.
- **Main model:** opt-in with `--main`. The prior value is recorded and restored on removal; a value changed since, or TOML that cannot be edited line by line, is refused. OpenCode's root model takes no variant.
- **Reload:** `make reload` runs `agents install --scope user` for each IDE listed in the gitignored `scripts/reload-agents.json`, before any plugin change.

## Checks

- **CLI:** 7,070 tests pass, one skipped. Typecheck, lint, architecture rules, knip and duplication (1.44%) pass. Bundle 733.5 KB against 742 KB.
- **Smoke:** 140 checks pass, one remote check skipped; 34/34 leaf commands exercised.
- **Reload:** 539 script tests pass, including reload opt-in order, skips with a reason, and refusal before plugin changes.
- **Edge cases:** unit cases cover multi-line strings, quoted and dotted keys, nested arrays, inline comments, CRLF and a JSON BOM; integration cases cover user scope, restore on removal, retired roles and rollback of both registries.

## Earlier runtime probes

Native probes on 2026-10-14 and 2026-10-15 confirmed that Claude Code, Codex, OpenCode, Copilot and Cursor dispatch the four roles in fresh contexts. They predate the current agent bodies and model profiles. One delegated-versus-direct observation per task gave no general cost or speed claim.

## Limits

Headers and files do not prove account access or the model and effort a host applies at runtime.
