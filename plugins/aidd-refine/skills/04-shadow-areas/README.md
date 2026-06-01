← [aidd-framework](../../../../README.md) / [aidd-refine](../../README.md)

# 04 - Shadow Areas

Analytically scans a written artifact (idea, user stories, PRD, or spec) for
blind spots: unstated assumptions, missing actors, missing failure modes,
ambiguous terms, missing acceptance criteria, missing edge cases, and missing
dependencies. Each gap is classified by category and severity, paired with a
direct-question probe the author can act on, and written to a structured
`<source>-shadow-report.md` next to the source.

## When to use

- The user asks to "find blind spots", "scan for gaps", "shadow report", or
  "what's missing" in a written artifact.
- A PRD, spec, idea note, or user-story set needs an analytical pass before
  planning or implementation starts.
- A prior shadow report exists and the user re-runs after editing the source,
  wanting to see which gaps are closed, still open, or newly introduced.

## When NOT to use

- The artifact does not yet exist and the user needs to clarify a vague intent
  through iterative questioning - use the `aidd-refine:01-brainstorm` skill.
- The request is to review code style or check implementation correctness.
- The user needs a general chat about what to do next, not a gap analysis.

## How to invoke

```
Use skill aidd-refine:04-shadow-areas
```

Provide either a file path or inline text as the source:

```
Use skill aidd-refine:04-shadow-areas with <path-to-artifact>
```

The router dispatches based on whether a prior report is already present:

1. `detect` - parse the source, extract gaps, assign category and severity,
   write a direct-question probe per gap.
2. `diff` (only when a prior report exists) - load the prior report and
   classify each gap as closed, still open, or newly introduced.
3. `render-report` - write `<source>-shadow-report.md` grouped by category
   and sorted by severity (blockers first).

## Outputs

- A markdown report `<source>-shadow-report.md` written next to the source.
- Each gap entry: `category`, `severity`, `probe`, optional quoted `snippet`.
- Report header carries `status: clean` when zero blockers and zero majors remain.
- On re-runs: three labeled sections (Closed, Still Open, Newly Introduced).

## Prerequisites

- A written artifact in markdown (or plain text) the skill can read.
- The file must be inside the working directory; outside-tree relative paths
  are rejected.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract and transversal rules.
Action implementations are under [`actions/`](actions/).
The locked taxonomy and severity rubric live in [`references/`](references/);
[`references/locked-sets.json`](references/locked-sets.json) is the single
source of truth reused by both docs and the validator.
The report skeleton is at [`assets/report-template.md`](assets/report-template.md).
