# 09 - Init quality gate

Wire static quality as one cohesive gate: typecheck + format + lint + commit-message linter + a pre-commit hook that runs them. Names no tool of its own - they follow the project's stack.

## Inputs

- The materialized project's language and stack (from `06-init-dependencies`) - they determine the concrete tools.

## Process

1. Configure typecheck, formatter, and linter for the project's stack.
2. Configure the commit-message linter.
3. Wire a pre-commit hook running format + lint + typecheck (and unit tests once `10-init-tests` exists).
4. Prove the hook blocks a deliberately bad commit.

## Test

- [ ] Typecheck, format, lint each run clean on the stub tree.
- [ ] Commit-message linter rejects a malformed message.
- [ ] Pre-commit hook blocks a bad commit and passes a clean one.
- [ ] *(frontend)* Accessibility tooling and a performance budget are configured.
