# Journey evidence

Nothing here evaluates the validator, and no gate reads prose. So each run is a fresh context
given the skill text and the task. Criteria fixed before running. No run repeated.

## Placement - pass

Three drafts, two requests. No marker outside the open questions section in any of them, with
no file naming that heading but the template.

## Which gaps - pass after the text was cut

Request answering target, retention and cap, stating no non-goals, suppressing nothing:

> Finance users need to export their invoices as CSV. A user picks a date range and gets a
> downloadable file. An export stays downloadable for 7 days after it is generated. An export
> covering more than 50,000 rows is refused.

Criterion: no run asks about implementation or presentation detail.

| Text | Entries | Over-ask |
| --- | --- | --- |
| before the cut | 5, 4, 6 | CSV field list in 2 of 3, refusal wording and post-window message in 2 of 3 |
| after the cut | 2, 4, 2 | none in 3 of 3 |

Every surviving entry is a decision a required section depends on: which date the range
filters on, what counts as a row against the cap, who may export. The rule did not change
between the two rows of that table. Only its length did.

## The measured case - pass

Retention and the row cap left open, the two #626 measured: both listed.

## The validator - pass

Fresh context, the yml and one spec, both cases `phase-1.md` named and nobody had run. They
stand in for the gate #625 brings.

A spec carrying one residual entry:

```
VERDICT: invalid

- Hard threshold `open_questions_unresolved`: the Open Questions section holds an unresolved "TBD" item (which invoice date the range filters on).
```

A `None` section with a marker under `## Context`, the second placement #626 measured:

```
VERDICT: invalid

- `open_questions` fails: the spec says "None" but has a `TBD:` marker in Context. The criterion forbids any TBD marker outside the open questions section. Hard threshold `open_questions_unresolved` forces invalid.
```
