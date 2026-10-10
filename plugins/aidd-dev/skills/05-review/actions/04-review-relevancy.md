# 04 - Review Relevancy

Judge whether the change belongs.

## Input

The diff prepare resolved, and the need it serves: the plan or the ticket.

## Output

The round's misfit findings, each with its lens as kind.

## Process

1. **Gather.** Capture the need, and read the project's declared rules, never assuming one.
2. **Flag.** Record each misfit under its lens, tied to a rule, a site or the need; a bare opinion is no finding.
   - `fit`: drift from the real intent, end to end, not only the literal criteria.
   - `conform`: a violation of a declared rule, naming it.
   - `rot`: duplication, over-engineering or incoherence, citing the site.

## Test

| Case | Pass |
| --- | --- |
| A misfit is found | one finding, its lens as kind, tied to a rule, a site or the need |
| The change fits | no finding |
