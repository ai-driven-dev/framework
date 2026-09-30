# 05 - Validate recipes

## Input

The recipe name, title, path, or `all`.

## Output

A report filled from [validation-report-template.md](../assets/validation-report-template.md).

Validation is read-only. Never repair, reformat, or rewrite a recipe during this action.

## Process

1. **Resolve.** Resolve one recipe with [recipe-locations.md](../references/recipe-locations.md), or keep `all` as the full project-plus-bundled scope.
2. **Check structure.** Resolve `../scripts/validate-recipe.mjs` from this loaded action file's directory and invoke `node <resolved-script-path> <resolved-recipe-path>` or `node <resolved-script-path> --all` from the project root, preserving its exit code and findings.
3. **Check semantics.** Apply the Writing, Steps, and Evidence rules from [recipe-contract.md](../references/recipe-contract.md); record one line-specific finding per violated rule. For non-JSON snippets, use available native YAML, TOML, and shell parsers and record which languages could not be checked mechanically.
4. **Report.** Fill the report template with merged deterministic and semantic findings, or the success summary.
   - An unavailable optional parser is disclosed but does not fail an otherwise valid recipe.
   - Do not suppress a finding because it requires editorial judgment.

## Test

- One valid recipe and `all` return PASS without changing tracked files.
- A structural failure returns the validator table with file, line, rule, fix, and a non-zero exit code.
- A semantic failure appears in the same table even when the deterministic script passes.
- JSON is parsed mechanically; YAML, TOML, and shell use available tools, and unavailable parsers appear in the success summary or a relevant failure.
