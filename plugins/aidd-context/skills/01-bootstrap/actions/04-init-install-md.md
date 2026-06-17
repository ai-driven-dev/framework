# 04 - Init INSTALL.md

Write the project's `INSTALL.md` (and project-root `README.md`) from the chosen stack, needs, and architecture. **This is where `INSTALL.md` is born** - every build action reads it.

## Inputs

- Chosen stack + architecture pattern + Mermaid diagram (from `03-choose-stack`).
- Gathered needs + building blocks (from `02-gather-needs`).
- `@../assets/INSTALL.md`, `@../assets/README.md` - the skeletons.

## Process

1. Fill the `INSTALL.md` skeleton: vision, decisions (+ a one-line *why* each), stack summary, building-blocks table, architecture (paste the Mermaid diagram + module boundaries), and install / configure / run / test steps.
2. Write `INSTALL.md` at the project root. If it already exists, ask before overwriting.
3. Fill and write the project-root `README.md` from its template; leave no raw `{{...}}`.
4. Print the written paths.

## Test

- [ ] `INSTALL.md` exists and is filled (vision, decisions, stack, building blocks, architecture with a Mermaid block, steps).
- [ ] `README.md` exists with no raw placeholders.
