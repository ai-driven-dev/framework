# Extraction

Read the code roots and the token source, even outside them. Invent nothing.

When several design systems coexist, ask which is the norm. Follow that one.

| In the code | In `aidd_docs/ui/` |
| --- | --- |
| token file the code consumes | in `code-tokens`, before `extract` runs |
| token file outside its platform's code root | in `code-tokens`, as `platform=path` |
| UI folder | in `code-roots` |
| apps the code roots serve | in `platforms`, one per app |
| UI folder, with several platforms in `system.md` | in `code-roots`, as `platform=path` |
| theme switched by `[data-theme]` | in `themes`, the one `:root` holds first |
| what `extract` leaves: a component-scoped property, a script-written one, `color-scheme` | nothing: named to the user |
| media query matching no breakpoint | a `## Breakpoints` row of `system.md`, settled, then `extract --force` |
| generated output under a code root | `ignore` |
| file no record links (C3), not a component | `ignore` |
| colour literal in the code | debt recorded by `bump --created system`. Never `ignore`. Never a narrower code root |
