# Extraction

Read the code roots and the token source, even outside them; invent nothing. When several design systems coexist, ask which is the norm and follow that one.

| In the code | In `aidd_docs/ui/` |
| --- | --- |
| token file the code consumes | in `code-tokens`, before `extract` runs, as `platform=path` when it sits outside the code root of its platform |
| UI folder | in `code-roots`, as `platform=path` when `system.md` lists several platforms |
| theme switched by `[data-theme]` | in `themes`, the one `:root` holds first |
| what `extract` leaves, a property scoped to a component, one written by a script or `color-scheme` among it | nothing: named to the user; a media query matching no breakpoint is a `## Breakpoints` row of `system.md` to settle, then `extract --force` |
| generated output under a code root | `ignore` |
| colour literal in the code | debt that `bump --created system` records, a warning listed; never `ignore`, never a narrower code root |
