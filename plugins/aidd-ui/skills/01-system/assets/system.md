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

| Name | Query |
| --- | --- |
| {{breakpoint name}} | {{its media query, empty for the first}} |

## History

| Version | Change | Breaking | Task |
| --- | --- | --- | --- |
| 1.0.0 | first system | no | {{task folder}} |

<!--
- Replace every `{{...}}` and delete every comment.
- A list with no answer is `[]`; only `code-tokens` may go.
- With several platforms, each `code-roots` item is `platform=path`, and so is a `code-tokens` item outside every code root.
- One `## Breakpoints` row per breakpoint; the query is a media query such as `(min-width: 64rem)`, and the first breakpoint, held by `tokens.json`, has none.
-->
