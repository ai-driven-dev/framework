---
id: system
kind: system
status: proposed
version: 1.0.0
format: 1
platforms: [{{platforms}}]
breakpoints: [{{breakpoints, the winning query last}}]
themes: [{{themes, the base first}}]
locales: [{{locales}}]
directions: [{{ltr, rtl}}]
primitives: [{{primitive token groups}}]
code-roots: [{{UI folders of the code}}]
code-tokens: {{token file of the code, or one per app}}
ignore: [{{paths no record links}}]
libraries: [{{component packages used}}]
---

# Design system

## Breakpoints

| Name | Width |
| --- | --- |
| {{breakpoint name}} | {{the widths it covers}} |

## History

| Version | Change | Breaking | Task |
| --- | --- | --- | --- |
| 1.0.0 | first system | no | {{task folder}} |

<!--
- Replace every `{{...}}` and delete every comment.
- A list with no answer is `[]`; only `code-tokens` may go.
- One `## Breakpoints` row per breakpoint.
-->
