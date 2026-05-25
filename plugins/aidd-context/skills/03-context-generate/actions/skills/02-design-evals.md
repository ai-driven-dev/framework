# 02 - Design evaluations

Write `evals/scenarios.json` so we can probe trigger correctness later.

**Skip condition:** if `invocation_mode = manual` (from 01), skip - manual-only skills have no autonomous trigger. Jump to action 03.

## Inputs

- `invocation_mode` (from 01) - must be `auto`; otherwise skip this action
- `skill_name`, `expected_output` (from 01)
- `confirmed_tools`, `blocked_tools` (from 01)
- `target_base` (from 01). Empty string means project root; `plugins/<plugin-name>/` means write under that plugin.
- 3+ realistic user prompts

## Outputs

One `evals/scenarios.json` per confirmed tool, written to that tool's skill root - see `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/evals-template.md` for schema and example.

```yaml
files_written:
  - { tool: <id>, path: <target_base><tool skills root>/<skill_name>/evals/scenarios.json }
```

## Process

1. Ask the user for 3+ realistic prompts (verbatim, not invented).
2. For each prompt, map to an `expect_action` slug - or `null` if the skill must NOT trigger.
3. For each confirmed tool (skip any in `blocked_tools`), resolve the tool skills root from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Write `evals/scenarios.json` to `<target_base><tool skills root>/<skill_name>/evals/scenarios.json`. If `target_base` is empty, the path is CWD-relative (e.g. `.claude/skills/<skill_name>/evals/scenarios.json`); if non-empty, prepend it (e.g. `plugins/my-plugin/.claude/skills/<skill_name>/evals/scenarios.json`).
4. Read scenarios back to the user. Wait for written validation before action 03.
5. **Post-write path check (MANDATORY).** After writing, MUST verify that every file in `files_written` satisfies ALL of:
   - the path is RELATIVE (no leading `/`), so it lives under the host's CWD (= workspace root); and
   - the path does NOT contain `${CLAUDE_PLUGIN_ROOT}` (would mean we wrote into the plugin install dir, which is read-only); and
   - when `target_base != ""`, the path starts with `target_base`.
   If any path violates any invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected a CWD-relative path under the workspace root prefixed with <target_base>`.

## Test

```bash
# Test: each written evals/scenarios.json exists, parses as JSON array with >= 3 entries
# files_written is an array of paths emitted by Process step 3
for path in "${files_written[@]}"; do
  test -f "$path" || exit 1
  node -e "const a=require('./${path}'); if (!Array.isArray(a)||a.length<3) process.exit(1);" || exit 1
  node -e "const a=require('./${path}'); a.forEach(e=>{if(typeof e.prompt!=='string') process.exit(1);});" || exit 1
  # When target_base is non-empty, assert path starts with target_base
  if [ -n "${target_base}" ]; then
    [[ "$path" == "${target_base}"* ]] || exit 1
  fi
done
echo ok
```
