# Extraction

Read the code roots and the token source, even outside them. Invent nothing.

| In the code | In `aidd_docs/ui/` |
| --- | --- |
| document-level custom property | a token, its structure kept |
| value overridden in a media query | the value outside it in `tokens.json`, the override in a breakpoint file |
| property scoped to a component or written by a script, `color-scheme` | nothing: named to the user |
| token file of another app | in `code-tokens`; its drift named to the user |
| component file | a record with `code`, and `implemented-version` equal to its `version` |
| CSS-only component | a record without `code` or `implemented-version` |
| prop varying on its own | an axis, `size=sm`; a prop named `variant` gives bare items |
| icon, image, illustration | an asset record, never `code` |
| file no record links (C3) | a record, `ignore`, or a backlog left listed |
| generated output under a code root | `ignore` |
| colour literal in committed code | a warning listed; never `ignore`, never a narrower code root |
