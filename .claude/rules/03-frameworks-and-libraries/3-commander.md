---
paths:
  - "src/application/commands/**/*.ts"
  - "src/cli.ts"
---

# Commander.js

## Command registration

- One `register*Command(program)` function per file
- Command files live in `src/application/commands/`
- All commands registered in `cli.ts` — no business logic there
- Deps created inside the action handler, not in `register*Command`

## Action handler contract

- Wiring only: create deps → call use-case → display result
- No helper functions (formatters, counters, predicates) inside command files
- No business logic inside action handlers — extract to use-cases or domain models

## Options

- Camel-case option names in code, kebab-case in CLI flags
- Provide defaults in `.option()` declarations
- Validate inputs via `output.error()` + `process.exit(1)` — never throw
