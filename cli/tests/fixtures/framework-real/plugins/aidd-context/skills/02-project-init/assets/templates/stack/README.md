# stack/ - Technology Stack Documentation

## What is stack/?

`stack/` contains one file per technology or tool used in the project. Each file documents conventions, configuration choices, and known gotchas for that technology.

## File naming

Use the technology name, lowercase, hyphenated:

- `typescript.md`
- `react.md`
- `postgres.md`
- `docker.md`

## What to put in each file?

- Version pinned and why
- Key configuration decisions (e.g. strict mode on, ESM vs CJS)
- Conventions the team follows (e.g. naming patterns, preferred APIs)
- Known limitations or workarounds
- Links to official docs or ADRs

## What NOT to put?

- Setup instructions (those go in `INSTALL.md`)
- Full API reference (link to official docs instead)
- Code examples longer than 20 lines
