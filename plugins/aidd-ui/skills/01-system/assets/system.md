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
- With several platforms, each `code-roots` item is `platform=path`, and so is a `code-tokens` item outside every code root.
- One `## Breakpoints` row per breakpoint, the only place they are declared, the winning query last; the query is a media query such as `(min-width: 64rem)`, and the first breakpoint, held by `tokens.json`, has none.
-->
