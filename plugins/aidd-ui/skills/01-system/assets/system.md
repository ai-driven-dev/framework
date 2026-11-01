---
id: system
kind: system
status: proposed
version: 1.0.0
format: 1
platforms: [{{platforms}}]
breakpoints: [{{breakpoints, the query that must win last: smallest first with min-width, largest first with max-width}}]
themes: [{{themes, the base first}}]
locales: [{{locales}}]
directions: [{{directions, ltr or rtl}}]
primitives: [{{token groups components never cite}}]
code-roots: [{{UI folders of the code}}]
code-tokens: {{file where the code consumes the tokens, or a list of them, one per app}}
ignore: [{{paths under a code root no record links}}]
libraries: [{{component packages the code uses}}]
---

<!-- Replace every `{{...}}` with its answer, write `[]` for a list whose answer is none and never delete a key that is required (only `code-tokens` may go), give `## Breakpoints` one row per breakpoint, and delete every comment. -->

# Design system

## Breakpoints

| Name | Width |
| --- | --- |
| {{breakpoint name}} | {{the widths it covers}} |

## History

| Version | Change | Breaking | Task |
| --- | --- | --- | --- |
| 1.0.0 | first system | no | {{task folder}} |
