---
objective: "Make what 01-journeys leaves behind readable: the showcase pages of journeys and wireframes, and what the assistant says along the way."
status: in-progress
---

# Plan: 01-journeys readable

Source: the manual walk on a blank project, rows marked `vierge | 01` in [findings](findings.md). The 01 output of that walk is committed in the walk copy and serves as the fixture to re-render after each engine change.

## Lot A: engine and showcase

TDD, each guard with the mutation that turns its own test red.

| # | Change | Where |
| --- | --- | --- |
| A1 | A wireframe state is drawn as a grey-box layout: each zone a bordered, labelled box, stacked in reading order. The record stays unstyled; the look belongs to the showcase. | `hooks/lib/showcase.cjs` |
| A2 | A journey is drawn as a chain of step cards joined by arrows, the action written on the arrow, each card linking to its screen or wireframe page. | `hooks/lib/showcase.cjs` |
| A3 | The wireframe group is labelled "Wireframes", not "Templates". | `hooks/lib/showcase.cjs` |
| A4 | The per-page engine checks leave out R18 (a component the design system does not hold yet): the final reply names those components. | `hooks/lib/showcase.cjs` |
| A5 | A missing `tokens.json` is an error only once a component or a screen exists. After journeys alone, nothing needs tokens yet. | `hooks/lib/tokens.cjs` |
| A6 | Two states of one wireframe with identical markup are reported: a state that shows nothing different is not a state. | `hooks/lib/records.cjs` |

Unchanged: the review of wireframes in the showcase (spec decision 4), `hooks.json` and the hook entry.

## Lot B: what the assistant says

| # | Change | Where |
| --- | --- | --- |
| B1 | Every question is a concrete proposal to accept or change, never an open field or an option that only says "type it". | `skills/01-journeys/SKILL.md` |
| B2 | Task folder: take a default, say which, never ask. | `actions/01-prepare.md` |
| B3 | Persona: draft it from the request, then confirm. | `actions/01-prepare.md` |
| B4 | Journeys from scratch: propose them, then wait for agreement. | `actions/01-prepare.md` |
| B5 | A state shows what changes in it: the empty message, the loading placeholder, the error and its way out. A step that is not a screen is left out; a second actor's screens belong to their own journey. | `references/wireframes.md`, render template |
| B6 | The final reply speaks plainly: what was made, where to look, what comes next. No rule codes; what a later skill owes is named as the next step, not as an error. | `actions/03-conclude.md` |

## Done when

- Lot A tests green, each guard shown failing under its mutation.
- The committed walk output, re-rendered, shows boxes, arrows, "Wireframes", no R18 block; `validate` exits 0 after journeys alone.
- Baptiste re-runs 01 on a fresh blank copy and finds the questions, the proposal and the reply clear.
