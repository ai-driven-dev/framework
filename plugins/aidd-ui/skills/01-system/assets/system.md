---
id: system
kind: system
status: proposed
version: 1.0.0
format: 1
platforms: [{{platforms}}]
breakpoints: [{{breakpoints, smallest first}}]
themes: [{{themes, the base first}}]
locales: [{{locales}}]
directions: [{{directions, ltr or rtl}}]
primitives: [{{token groups components never cite}}]
code-roots: [{{UI folders of the code}}]
code-tokens: {{file where the code consumes the tokens}}
ignore: [{{paths under a code root no record links}}]
libraries: [{{component packages the code uses}}]
---

<!-- Replace every `{{...}}` with its answer, delete a front matter line whose answer is none, give `## Breakpoints` one row per breakpoint, and delete every comment. -->

# Design system

## Breakpoints

| Name | From |
| --- | --- |
| {{breakpoint name}} | {{its width}} |

## History

| Version | Change | Breaking | Task |
| --- | --- | --- | --- |
| 1.0.0 | first system | no | {{task folder}} |
