# 05 - Validate recipes

Check one or all recipes against their structure and writing rules.

## Input

The recipe name, title, path, or `all`.

## Output

A report filled from [validation-report-template.md](../assets/validation-report-template.md).

## Process

1. **Resolve.** Resolve one recipe with [recipe-locations.md](../references/recipe-locations.md), or keep `all` as the full project-plus-bundled scope.
   - Keep validation read-only; never repair, reformat, or rewrite a recipe during this action.
2. **Check structure.** Resolve `../scripts/validate-recipe.mjs` from this loaded action file's directory and invoke `node <resolved-script-path> <resolved-recipe-path>` or `node <resolved-script-path> --all` from the project root, preserving its exit code and findings.
3. **Check semantics.** Record one line-specific finding per violation of the Writing, Steps, and Evidence rules in [recipe-contract.md](../references/recipe-contract.md).
   - For non-JSON snippets, use available native YAML, TOML, and shell parsers and record which languages could not be checked mechanically.
4. **Report.** Fill the report template with merged deterministic and semantic findings, or the success summary.
   - An unavailable optional parser is disclosed but does not fail an otherwise valid recipe.
   - Do not suppress a finding because it requires editorial judgment.

## Test

| Case | Pass |
| --- | --- |
| One valid recipe or `all` | PASS is returned without changing tracked files |
| Structural failure | The table includes file, line, rule, and fix, with a non-zero exit code |
| Semantic failure after deterministic PASS | The finding appears in the same table |
| Snippet syntax | JSON is parsed mechanically; available YAML, TOML, and shell tools are used, and unavailable parsers are disclosed |
