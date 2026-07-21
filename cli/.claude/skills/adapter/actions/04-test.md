# 04 - Test

Write infrastructure integration tests for the adapter covering error translation, format transformation, and retry/fallback logic.

## Inputs

- `adapter-name` (required) - string, PascalCase name with `Adapter` suffix
- `adapter-file` (required) - string, path to the source file from 02

## Outputs

```
Test file: tests/infrastructure/adapters/<kebab-name>-adapter.integration.test.ts
```

## Depends on

- `03-wire-deps`

## Process

1. Create `tests/infrastructure/adapters/<kebab-name>-adapter.integration.test.ts`. Use `*.integration.test.ts` suffix per `references/test-pyramid.md` in the `test` skill.
2. Use mock server responses or file fixtures — never real network, never real machine state outside temp directories.
3. Cover: error parsing (third-party error → typed domain exception), retry logic if present, format transformation not visible in E2E.
4. Name `it()` blocks as behavior sentences describing observable outcomes, not internal method calls.
5. Group tests with `describe('<AdapterName>')` block — see memory `feedback_test_naming.md`.
6. One test file per adapter — do not mix adapter tests.

## Test

Run `pnpm test:integration` — exits 0 with all new `it()` blocks passing.
