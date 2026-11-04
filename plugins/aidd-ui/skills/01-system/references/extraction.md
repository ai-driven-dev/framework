# Extraction

Read the code roots and the token source, even outside them; invent nothing. When several design systems coexist, ask which is the norm and follow that one.

| In the code | In `aidd_docs/ui/` |
| --- | --- |
| token file the code consumes | in `code-tokens`, before `extract` runs, as `platform=path` when it sits outside the code root of its platform |
| UI folder | in `code-roots`, as `platform=path` when `system.md` lists several platforms |
| theme switched by `[data-theme]` | in `themes`, the one `:root` holds first |
| what `extract` leaves, a property scoped to a component, one written by a script or `color-scheme` among it | nothing: named to the user; a media query matching no breakpoint is a `## Breakpoints` row of `system.md` to settle, then `extract --force` |
| component file | a record with a `code` link: its version equal to the record's `version`, its platform its code root's |
| component on only some platforms | `platforms` lists them |
| variant or state one platform's code lacks | kept in the record, named to the user as that platform's gap |
| same component on several platforms | one record, a link per platform |
| CSS-only component | a record without `code` |
| prop varying on its own | an axis, `size=sm`; a prop named `variant` gives bare items |
| icon, image, illustration | an asset record, never `code` |
| file no record links (C3) | a record, `ignore`, or a backlog left listed |
| generated output under a code root | `ignore` |
| colour literal in the code | debt that `bump --created system` records, a warning listed; never `ignore`, never a narrower code root |
