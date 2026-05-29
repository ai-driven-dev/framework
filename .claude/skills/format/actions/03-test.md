# 03 - Test

Write exhaustive unit tests for both the forward and inverse functions, covering all branches
and meaningful edge cases.

## Inputs

- `forward-function` (required) - string, name of the forward function from 01
- `inverse-function` (required) - string, name of the inverse function from 02 (or `null` if lossy)
- `source-file` (required) - string, path to the format module being tested

## Outputs

```
Test file: tests/domain/formats/<kebab-name>.unit.test.ts
```

## Depends on

- `02-round-trip`

## Process

1. Create `tests/domain/formats/<kebab-name>.unit.test.ts`. Use `*.unit.test.ts` suffix — no I/O, no mocks, no filesystem.
2. Import only the functions under test and their types. No test helpers that do I/O.
3. Cover the following for the forward function:
   - Happy path: valid input produces the expected output string.
   - Each optional field: omitting it produces correct output; including it produces correct output.
   - Invalid input: if the function throws on bad input, confirm the thrown error.
4. Cover the following for the inverse function (when present):
   - Happy path: valid serialized form parses back correctly.
   - Missing required fields: throws a typed error.
   - Round-trip identity: `reverse(forward(validInput))` deeply equals `validInput`.
5. Name `it()` blocks as behavior sentences: "serializes optional version field when provided" not "calls lines.push".
6. Group tests with `describe('<functionName>')` by function name — see memory `feedback_test_naming.md`.
7. No mocks — format functions are pure; call them directly with literal inputs.

## Test

Run `pnpm test:unit` — exits 0 with all new `it()` blocks passing.
