---
status: done
---

# Instruction: Records and history

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-ui/hooks/lib/
│   ├── markdown.cjs ✅
│   ├── project.cjs ✅
│   ├── records.cjs ✅
│   └── history.cjs ✅
└── scripts/__tests__/
    ├── aidd-ui-records.test.js ✅
    └── fixtures/
        ├── README.md ✏️
        └── aidd-ui/
            └── project.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `writeProject(tmp)` from `fixtures/aidd-ui/project.js` | a complete valid project: every record kind, tokens, renders, code under `src/ui/` | system |
| Happy path   | `records.check(load(tmp))` and `history.check(load(tmp))` | both return `[]` | system |
| Edge case    | R1: a record without front matter, or a line that is neither `key: value` nor `key: [a, b]` | one problem naming the file and the line | system |
| Edge case    | R2: `kind: widget`, or an atom under `screens/` | one problem: unknown kind, or kind outside its folder | system |
| Edge case    | R3: a required key removed, per kind; `status: done`; `interactive: maybe`; asset `type: photo` | one problem naming the missing key or the bad value | system |
| Edge case    | R4: `id` differs from the file name; two records with the same `id` | one problem each | system |
| Edge case    | R5: `version: 0` or `v2` on an element; `version: 1.0` on `system.md` | one problem each: element integer from 1, system semver | system |
| Edge case    | R6: `uses` names an absent id; an atom uses an atom; a molecule uses a composition; a screen uses a screen | one problem each | system |
| Edge case    | R7: an interactive component without `hover`, `focus` or `disabled`; a component without `default`; a screen without `default`; an interactive component without `## Keyboard` | one problem each | system |
| Edge case    | R8: `status: coded` without `code` | one problem | system |
| Edge case    | R9: `deprecated` without `replaced-by`; `replaced-by` absent or deprecated; `replaced-by: none` without `## Deprecation` | one problem each | system |
| Edge case    | R10: a non-deprecated record uses a deprecated one | one problem naming both | system |
| Edge case    | R11: a screen breakpoint missing from `system.md` | one problem | system |
| Edge case    | R12: a journey step naming an absent screen | one problem | system |
| Edge case    | R13: a review missing a row for one screen state; `Verdict` not `ok`, `ko` or `pending` | one problem each | system |
| Edge case    | R14: `brand.md` without one of its seven headings | one problem naming the heading | system |
| Edge case    | R16: `system.md`, `brand.md` or a review with `status: coded` or `deprecated` | one problem: only `proposed` or `validated` | system |
| Edge case    | R15: an asset whose `file` is absent | one problem | system |
| Edge case    | H1: a versioned record without `## History` | one problem | system |
| Edge case    | H2: two rows for version 2, as after a merge of two branches | one problem: two changes claim version 2, renumber | system |
| Edge case    | H3: front matter `version` not the highest row; a gap from 1 to 3 | one problem each | system |
| Edge case    | H4: `Breaking` neither `yes` nor `no` | one problem | system |
| Edge case    | H5: a task with a breaking element row and no major bump in `system.md`; a task with only non-breaking rows whose `system.md` row raises nothing; a task in an element history with no `system.md` row | one problem each, naming the task | system |
| Edge case    | H6: a `deprecated` record whose last history row says `Breaking: no` | one problem | system |
| Teardown     | remove `tmp` | no file left | system |

## Tasks to do

### `1)` Fixture project

> One complete valid project every phase mutates.

1. Export `writeProject(dir)` writing:
   - Every record holds `id`, `kind`, `status`, `version` and a `## History` table (Version, Change, Breaking, Task); every element's first row is task `ds-init`.
   - `aidd_docs/ui/system.md`: `id: system`, `kind: system`, `status: validated`, `version: 2.0.0`, `platforms: [web]`, `breakpoints: [mobile, desktop]`, `themes: [light, dark]`, `locales: [fr, ar]`, `directions: [ltr, rtl]`, `code-roots: [src/ui]`, `ignore: [src/ui/tokens.css]`, `libraries: [@radix-ui/react-dialog]`; a `## Breakpoints` table; `## History` rows `1.0.0` for task `ds-init`, `2.0.0` for task `retire-old-button`.
   - `aidd_docs/ui/brand.md`: `id: brand`, `kind: brand`, `status: validated`, `version: 1`; headings `## Project`, `## Users`, `## Domain`, `## Platforms`, `## Personality and tone`, `## References`, `## Anti-references`, optional `## Imposed charter`.
   - `aidd_docs/ui/tokens.json`: `color.brand.primary` (srgb, dark theme extension), `color.text.default` aliasing it, `space.md` (rem), `border.thin` (`0.0625rem`), `motion.fast` (ms), `font.body` (family list), `font.weight.bold` (700).
   - `aidd_docs/ui/assets/icon-search.md` with `icon-search.svg`.
   - `aidd_docs/ui/components/`, each with `tokens`, `variants`, `states`, `role` and its `.html` render carrying a `data-variant` per variant, a `data-state` per state, tokens through `var(--...)` only, logical properties only:
     - atom `button`: interactive, `role: button`, coded `src/ui/Button.tsx#Button`, variants `primary`, `secondary`, states `default`, `hover`, `focus`, `disabled`, `## Keyboard`.
     - molecule `search-field`: interactive, `role: search`, validated, uses `button`, `icon-search`, no code, variants `default`, states `default`, `hover`, `focus`, `disabled`, `## Keyboard`.
     - composition `dialog`: interactive, `role: dialog`, coded `package:@radix-ui/react-dialog#Root`, uses `button`, variants `default`, states `default`, `hover`, `focus`, `disabled`, `## Keyboard`.
     - atom `old-button`: not interactive, `role: button`, variants `default`, states `default`, deprecated, `replaced-by: button`, history row 2 `Breaking: yes` for task `retire-old-button`.
   - `aidd_docs/ui/screens/home.md` (coded, `src/ui/HomePage.tsx#HomePage`, states `default`, `empty`, `loading`, `error`, breakpoints `mobile`, `desktop`, route `/`) with `home.html`.
   - `aidd_docs/ui/journeys/onboarding.md` (`## Steps` table: Screen, Action).
   - `aidd_docs/ui/reviews/first-pass.md` (`status: proposed`, `scope: system`, `screens: [home]`, `## Verdicts` table: Screen, State, Verdict, Comment, one row per state, one `pending`: the remaining screens are the `pending` rows).
   - `src/ui/Button.tsx`, `src/ui/HomePage.tsx`, `src/ui/tokens.css` (ignored, holds hex values).
2. Add the fixture to `scripts/__tests__/fixtures/README.md`.

### `2)` Markdown reading

> Records read the same way everywhere.

1. `markdown.cjs`: front matter between the first two `---` lines into `{key: string | string[]}`, a problem per malformed line; `## ` headings into sections; a section's first table into rows keyed by header.

### `3)` Project loading

> One read of the tree every check shares.

1. `project.cjs`: `load(root)` returns `null` without `aidd_docs/ui/`, else every record with its file, folder, front matter and sections, the raw `tokens.json` text, and the render paths.

### `4)` Record rules

> R1 to R16 hold.

1. `records.cjs`: `check(project)` returns `{file, message}` per broken rule, in rule order.
2. Required keys: every record `id`, `kind`, `status`, `version`; `system.md` `platforms`, `breakpoints`, `themes`, `locales`, `directions`, `code-roots`, `ignore`, `libraries`; component `uses`, `tokens`, `variants`, `states`, `interactive`, `role`; screen `uses`, `states`, `breakpoints`, `route`; journey `persona`; asset `type`, `file`, `alt`; review `scope`, `screens`; `code` only when `coded`; `replaced-by` only when `deprecated`.
3. Folders: `components/` holds atom, molecule, composition; `screens/` screen; `journeys/` journey; `assets/` asset; `reviews/` review; the root holds `system.md`, `brand.md`.

### `5)` History rules

> H1 to H6 hold.

1. `history.cjs`: `check(project)` reads each `## History` table (Version, Change, Breaking, Task) and returns `{file, message}` per broken rule.
2. Bumps: the system row of a task raises the major version over the previous row when any element row of that task says `yes`, else at least the minor.
3. A `deprecated` record's last row says `Breaking: yes`.

### `6)` Tests

> Each rule has the mutation that turns its test red.

1. `aidd-ui-records.test.js`: the Happy path, then one test per Edge case row, each asserting its own message.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `writeProject` output passes both checks; the fixture README lists it |
| 2 | a malformed front matter line comes back as a problem with its line |
| 3 | `load` returns `null` without `aidd_docs/ui/` and every record otherwise |
| 4 | each of R1 to R16 has its own message |
| 5 | each of H1 to H6 has its own message, H2 naming the claimed version |
| 6 | reverting any one rule turns exactly its test red |
