# 05 - Validate recipes

Check one or all recipes against their structure and writing rules.

## Input

The recipe name, title, path, or `all`.

## Output

A report filled from [validation-report-template.md](../assets/validation-report-template.md).

## Process

1. **Require the CLI.** Confirm `aidd framework validate-recipes --help` shows `Usage: aidd framework validate-recipes`.
   - If absent or unsupported, stop and report that `aidd` must be installed or updated with `npm install -g @ai-driven-dev/cli`; never report PASS without running validation.
2. **Resolve.** Resolve one recipe with [recipe-locations.md](../references/recipe-locations.md), or keep `all` as the full project-plus-bundled scope.
   - Keep validation read-only; never repair, reformat, or rewrite a recipe during this action.
3. **Check structure.** Invoke `aidd framework validate-recipes` with the resolved recipe path, or with `--all --bundled` and the bundled recipe directory resolved from this loaded skill, preserving its exit code and findings.
4. **Check semantics.** Record one line-specific finding per violation of the Writing, Steps, and Evidence rules in [recipe-contract.md](../references/recipe-contract.md).
   - For non-JSON snippets, use available native YAML, TOML, and shell parsers and record which languages could not be checked mechanically.
5. **Report.** Fill the report template with merged deterministic and semantic findings, or the success summary.
   - An unavailable optional parser is disclosed but does not fail an otherwise valid recipe.
   - Do not suppress a finding because it requires editorial judgment.

## Test

| Case | Pass |
| --- | --- |
| One valid recipe or `all` | PASS is returned without changing tracked files |
| CLI absent or too old | Validation stops with installation or update guidance; no PASS is reported |
| Structural failure | The table includes file, line, rule, and fix, with a non-zero exit code |
| Semantic failure after deterministic PASS | The finding appears in the same table |
| Snippet syntax | JSON is parsed mechanically; available YAML, TOML, and shell tools are used, and unavailable parsers are disclosed |
