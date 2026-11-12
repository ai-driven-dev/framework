---
id: system
kind: system
format: 1
platforms: [{{platforms}}]
themes: [{{themes, the base first}}]
locales: [{{locales}}]
primitives: [{{palette and scale groups, never the semantic ones}}]
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
- A list with no answer is `[]`.
- Only `code-tokens` may go.
- The right to left languages are `ar`, `he`, `fa` and `ur`.
- A locale in one of them is written right to left.
-->
