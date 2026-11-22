# Change a business rule inside a context

Load `references/architecture.md` and `references/contexts/<ctx>.md`. The context's language is `src/contexts/<ctx>/glossary.md`: use its words, add one when a concept is new.

1. Find the folder that owns the concept: `domain/` for rules and order, `application/` for the command that orchestrates, `ports/` for what the context needs, `infrastructure/` for I/O. Layout: `references/architecture.md`, Context shape.
2. Write the failing test first, at the lowest level that proves the rule: `actions/05-test.md`. A characterization test comes first when no test covers the behaviour you are about to move.
3. The aggregate decides, the use case orchestrates. The domain holds rules and order only: no memoization, logging, clock or `process`. Those sit in `application/`, with the clock or environment handed in through a port.
4. Value objects are immutable, one repository per aggregate. A shape another context needs is a type in `contract/`, never reached through `domain/` or a re-export.
5. A rule that needs a new input from another context declares the narrow input in this context's own `ports/`; the composition root hands in the real object.
6. A rule that can fail throws a typed error: `actions/04-failure.md`.
7. Read the context page's "Never" list before touching anything it freezes: its use-case tests, contract kits, e2e and goldens pin the output, so a change to what a command prints or writes is a product change.
8. Run the context's mutation scope (`pnpm test:mutation:<ctx>`) when you changed a rule, and kill the survivors with tests.
