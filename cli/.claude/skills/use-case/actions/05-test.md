# 05 - Test

Write unit tests for the use-case using in-memory port implementations.

## Inputs

- `use-case-name` (required) - string, PascalCase name with `UseCase` suffix
- `use-case-file` (required) - string, path to the source file from 04

## Outputs

```
Test file: tests/application/use-cases/<kebab-name>-use-case.unit.test.ts
```

## Depends on

- `04-wire-errors-and-pipeline`

## Process

1. Create `tests/application/use-cases/<kebab-name>-use-case.unit.test.ts`. Use `*.unit.test.ts` suffix per `references/test-pyramid.md` in the `test` skill.
2. Mock all ports via in-memory implementations from `tests/helpers/ports/` — no real filesystem, no real I/O.
3. Cover: happy path returns the expected `*Result`, skipped/no-op path returns early with correct flags, each typed error is thrown when its condition is met.
4. Name `it()` blocks as behavior sentences: "returns skipped result when widget already exists and force is false" not "calls repo.find".
5. Group with `describe('<UseCaseName>')` block — see memory `feedback_test_naming.md`.
6. Use `describe.concurrent()` only for E2E tests — unit tests must NOT use it per `references/test-pyramid.md` in the `test` skill.
7. For bug fixes: write the failing test FIRST, confirm it fails, then fix the use-case — see `references/bug-empirical-reproduction.md`.

## Test

Run `pnpm test:unit` — exits 0 with all new `it()` blocks passing.
