# Extraction

Read the code roots and the token source, even outside them. Invent nothing.

A design system already in the code, of any techno, is matter for extraction, then only an implementation checked against `aidd_docs/ui/`, never a second source. When several coexist, ask which is the norm and follow that one.

| In the code | In `aidd_docs/ui/` |
| --- | --- |
| document-level custom property | a token, its structure kept |
| value overridden in a media query | the value outside it in `tokens.json`, the override in a breakpoint file |
| property scoped to a component or written by a script, `color-scheme` | nothing: named to the user |
| token file of another app | in `code-tokens`; its drift named to the user |
| token file the code consumes | read for the tokens, and listed in `code-tokens` |
| component file | a record with a `code` link: its version equal to the record's `version`, its platform its code root's |
| component on only some platforms | `platforms` lists them |
| variant or state one platform's code lacks | kept in the record, named to the user as that platform's gap |
| same component on several platforms | one record, a link per platform |
| CSS-only component | a record without `code` |
| prop varying on its own | an axis, `size=sm`; a prop named `variant` gives bare items |
| icon, image, illustration | an asset record, never `code` |
| file no record links (C3) | a record, `ignore`, or a backlog left listed |
| generated output under a code root | `ignore` |
| colour literal in committed code | a warning listed; never `ignore`, never a narrower code root |
