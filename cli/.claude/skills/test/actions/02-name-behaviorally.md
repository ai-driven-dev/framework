# 02 - Name Behaviorally

Draft `describe` and `it` block names that describe observable outcomes, not method calls.

## Inputs

- `scenarios` (required) - list of behaviors or edge cases to cover

## Outputs

```
describe('ApplyWidgetUseCase') {
  it('returns skipped result when widget already exists and force is false')
  it('writes output files and returns file count on first apply')
  it('overwrites existing files when force is true')
  it('throws WidgetNotFoundError when widgetId is not recognized')
}
```

## Depends on

- `01-pick-tier`

## Process

1. For each scenario, write a sentence that completes: "it <observable outcome under given condition>".
2. Avoid method names in `it()` blocks: NOT "calls hasTool", NOT "invokes execute" — describe what happens FROM THE CALLER'S perspective.
3. Group related scenarios under a parent `describe('<ClassName>')` block. Use nested `describe` for sub-groups (e.g. `describe('when force is true')`) — NOT prefix separators like "ClassName — behavior".
4. Follow the memory note on `describe()` grouping: `feedback_test_naming.md`.
5. Do not write the actual test code yet — names only in this action.

## Test

Names are evaluated when the test file created in 03 runs and every `it()` produces a meaningful vitest output line — readable without looking at the source.
