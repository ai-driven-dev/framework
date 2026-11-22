# 03 - Change a business rule inside a context

Change a rule in the folder that owns it, proven first by a failing test.

## Input

The rule to change and its context.

## Output

The rule changed in its owning folder, its tests and mutation survivors dealt with.

## Process

1. **Load.** Read [architecture.md](../references/architecture.md) and the `references/contexts/<ctx>.md`. The context's language is `src/contexts/<ctx>/glossary.md`: use its words, add one when a concept is new.
2. **Place.** Find the folder that owns the concept, per `architecture.md`, Context shape.
3. **Test first.** Write the failing test at the lowest level that proves the rule ([05-test.md](05-test.md)).
   - A characterization test comes first when no test covers the behaviour you are about to move.
4. **Decide.** The aggregate decides, the use case orchestrates. What the domain may not hold is in `architecture.md`, Context shape.
5. **Shape.** Value objects are immutable, one repository per aggregate. A shape another context needs is a type in `contract/`, never reached through `domain/` or a re-export.
6. **Input.** A rule that needs a new input from another context declares the narrow input in this context's own `ports/`; the composition root hands in the real object.
7. **Fail.** A rule that can fail throws a typed error ([04-failure.md](04-failure.md)).
8. **Respect the freeze.** Read the context page's "Never" list before touching what it freezes: its use-case tests, contract kits, e2e and goldens pin the output.
9. **Mutate.** Run `pnpm test:mutation:<ctx>` when you changed a rule, and kill the survivors with tests.

## Test

| Case | Pass |
| --- | --- |
| the new test before the change | red for the reason its name gives |
| `pnpm test:mutation:<ctx>` | no surviving mutant on the changed rule |
| `pnpm test:arch` | green |
