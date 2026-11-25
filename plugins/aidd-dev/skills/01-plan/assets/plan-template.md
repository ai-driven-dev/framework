---
objective: "{{What must be true when done. One sentence.}}"
status: pending
---

<!-- Replace every `{{...}}` with its content, or omit the section, and delete every comment; never add, rename, or reorder one. -->

# Plan: {{title}}

Source: {{file, ticket, or text}}

## Phases

<!-- Depends on lists the earlier phase numbers whose output, written files, or shared validation resources this phase needs, or `none`. -->

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | {{phase-name}} | [`phase-1.md`](./phase-1.md) | none |
| 2   | {{phase-name}} | [`phase-2.md`](./phase-2.md) | {{earlier phase numbers, or `none`}} |

## External sources

<!-- URLs of the docs consulted, or a single `none` row. -->

| URL   | What it settled   |
| ----- | ----------------- |
| {{url}} | {{what it settled}} |

## Impact

<!-- Documentation always; the other categories when the findings say they apply. -->

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| {{runtime, regression, architecture, documentation}} | {{verdict and its evidence, or `none`}} | {{phase, or `none`}} |

## Rules

<!-- The project's own rules (memory, conventions) that govern this feature. Omit if none. -->

| Rule   | Why it applies |
| ------ | -------------- |
| {{rule}} | {{why}}          |

## Decisions

<!-- Architecture-magnitude, one you'd regret reversing, or one a project rule selected over a meaningful alternative. Rule reference: the rule's logical identifier (e.g. `architecture/ports`), optionally with its decisive instruction, or `none`. Affected files stay in the phase projection. Omit if none qualify. -->

| Decision   | Why   | Rule reference |
| ---------- | ----- | -------------- |
| {{decision}} | {{why}} | {{rule identifier, or `none`}} |

Rule references are model-reported when the plan is written, not proof of the model's reasoning.
