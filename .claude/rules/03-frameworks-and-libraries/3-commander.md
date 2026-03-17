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

## Options

- Camel-case option names in code, kebab-case in CLI flags
- Provide defaults in `.option()` declarations
- Validate inputs via `output.error()` + `process.exit(1)` — never throw
