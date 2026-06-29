# 02 - Assert Architecture

Report where the codebase breaks the documented architecture: C4 diagrams, ADRs, and the project tree.

## Input

The scope to check, a module, service, or layer, from the arguments; defaults to the whole project.

## Output

A conformance report listing each violation, grouped macro and micro, with severity, file, the constraint broken, and a one-line fix. Report only; it never fixes.

## Process

1. **Load.** Read the architecture sources: the architecture memory, the micro diagrams for an in-scope module, and the decision records. Extract the expected project tree.
2. **Macro.** Compare the code structure against the documented tree. Flag files outside their boundary and direct imports between independent services.
3. **Micro.** For each in-scope module, check import directions against the layer constraints. The domain layer imports nothing external. The application layer reaches the domain only through ports. No circular dependencies. Adapters implement their interfaces.
4. **Report.** One entry per violation, grouped macro and micro, each with severity (`critical` or `warning`), file, constraint, and a one-line fix. Never fix, only report.
5. **Summarize.** The total violations, the critical count, and the recommended next actions.

## Test

- On conformance, the report states "no violations" in both the macro and micro sections.
- On violations, every entry has a real file path, a constraint drawn from a loaded architecture source, and a non-empty fix.
