---
id: system
kind: system
format: 1
platforms: [{{platforms}}]
themes: [{{themes, the base first}}]
locales: [{{locales}}]
primitives: [{{primitive token groups}}]
code-roots: [{{UI folders of the code}}]
code-tokens: {{token file of the code, or one per app}}
ignore: [{{paths no record links}}]
---

# Design system

## Breakpoints

| Name | Query |
| --- | --- |
| {{breakpoint name}} | {{its media query, empty for the first}} |

<!--
- Replace every `{{...}}` and delete every comment.
- A list with no answer is `[]`; only `code-tokens` may go.
- A locale whose language is `ar`, `he`, `fa` or `ur` is written right to left.
-->
