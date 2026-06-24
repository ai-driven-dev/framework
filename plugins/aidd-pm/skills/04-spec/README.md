← [aidd-framework](../../../../README.md) / [aidd-pm](../../README.md)

# 04 - Spec

Generate or refine the immutable contract for a feature: its target, hard
constraints, non-goals, and done-when. The spec stays free of implementation
detail and is locked once validated.

## When to use

- "draft spec", "spec for X", "generate spec from prd".
- "refine the spec" when review findings come back.
- Invoking `/spec`.

## When NOT to use

- To write source code.
- To draft a full PRD → use `03-prd`.
- To modify a spec that has already been validated and locked - the spec
  is immutable past that point; open a new spec instead.

## How to invoke

Build a fresh spec from a request or an existing PRD:

```
Use skill aidd-pm:04-spec build for <request or PRD path>
```

Refine an existing spec from review findings:

```
Use skill aidd-pm:04-spec refine on <spec path> with <findings>
```

The router picks the action from the inputs: presence of `existing_spec`
and `findings` triggers `refine`; otherwise `build` runs.

## Outputs

- A spec file structured per [`assets/spec-template.md`](assets/spec-template.md),
  with explicit non-goals, bulleted acceptance criteria, and `TBD: <precise
  question>` markers wherever information is missing.
- On `refine`: the same file rewritten to address the supplied findings.
- The skill never self-validates. A spec is checked against
  [`assets/spec-validator.yml`](assets/spec-validator.yml); the findings come
  back through `refine` for the next iteration.

## Prerequisites

- A free-form request, an existing PRD path, or an existing spec plus a
  set of review findings.
- Write access to the spec target path in the current repo.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract,
[`actions/01-build.md`](actions/01-build.md) and
[`actions/02-refine.md`](actions/02-refine.md) for the two actions,
and [`assets/`](assets/) for the spec template plus the validator checklist.
