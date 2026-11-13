---
objective: "Choose between variants inside the showcase: one site, one review drawer, one copy. The separate compare page goes away."
status: in-progress
---

# Plan: compare variants inside the showcase

Decided with the person:

- A set with problems: `showcase` writes every page, shows the problems on that set's page, prints them and exits 1.
- Sections identical across variants: one line names them, only the differing sections are shown in full.

## Today

- `compare` is wired at `aidd-ui.cjs` (`compareSet`, `COMPARE_USAGE`) and `cli.cjs`. It calls `drafts.compare`, which checks D1 to D5, writes `drafts/.gitignore`, and writes `compare.html` through `page.cjs`'s `pageOf`.
- The copy of the compare page is `{set, variants:[{name, verdict, comment}]}`, `null` when undecided (`page.cjs`, documented in `help.cjs`). It is kept in localStorage under `aidd-ui:<set>:<sha>`.
- `keep` parses no copy; it takes `<set> <variant>`. The copy is read by the choose steps of 02, 03, 04, 05, and by 06.
- The showcase copy is `{record, version, verdicts}`, unwrapped when single, stored under `aidd-ui-review` keyed `id@version`, filtered by `keptOf`.
- The showcase cannot see drafts: `project.cjs` `load` skips them, and so does `capturesOf`.
- `showcase.cjs` imports `escaped`, `documentOf`, `inlined`, `STYLESHEET_LINK` from `page.cjs`.
- The hook needs no change: `ENGINE_WRITES` holds neither `compare` nor `showcase`.

## Phases

Each phase: write the test, see it red, implement, see it green, apply the listed mutation and see that guard go red, restore. One commit per phase.

1. **Shared helpers.** Move `escaped`, `documentOf`, `inlined`, `STYLESHEET_LINK`, `FONT_FLOOR`, `fingerprintOf` to a new `hooks/lib/html.cjs`; `showcase.cjs` imports from it. Mutation: drop `fingerprintOf` from the exports.
2. **The showcase reads the sets.** `drafts.cjs` exports `setsOf(root)` returning `[{id, rows, axes, variants, problems, fingerprint}]`. `writeShowcase` passes `sets` to the pure `showcaseOf`, and writes `drafts/.gitignore` when drafts exist. Mutations: skip the `.gitignore` write; `setsOf` returns `[]`.
3. **The set page.**
   - Sidebar: a first group `data-group="choose"`, "À choisir" / "To choose", one link per set.
   - File `_set-<set>.html`, so a set `brand` never overwrites the record page `brand.html`. Guard with a set and a record both named `brand`. Mutation: drop the prefix.
   - One column per variant: name, intent, axis table.
   - Each variant's HTML in two fixed frames, desktop 1280 and mobile 390, scaled to the column. No toggle, no "1 up / 2 up", no shift-click. Tokens inlined.
   - A markdown path shared by the variants shows only the `##` sections that differ, plus one line naming the identical ones. Mutation: keep identical sections.
   - D1 to D5 problems shown on the set page in place of the frames; `showcase` exits 1 and prints them.
   - Every label in `LABELS.en` and `LABELS.fr`, plain words.
   - Mutation: render one frame size only.
4. **Swatches.** In an axis cell, each `#rrggbb` becomes a swatch plus its code; the rest stays escaped. Mutations: case-sensitive regex; drop the code.
5. **Drawer and copy.**
   - A "À choisir" group in the drawer, one row per variant: Garder / À revoir / Écarter (`keep`/`revise`/`discard`) and a comment. Own selector: record entries never read sets.
   - Storage `aidd-ui-review`, key `set:<id>@<fingerprint>`.
   - A set entry keeps today's compare copy shape exactly, emitted once any variant is decided. A lone set copy is byte-identical to today's compare copy.
   - Guards: a set alone gives the old copy (mutation: wrap single entries); records and sets mixed give a list (mutation: filter sets out); "all OK" never marks a variant (mutation: count set rows as remaining); revise without comment blocks the copy (mutation: drop the set check).
6. **Delete compare.** Remove `drafts.compare`, `page.cjs`, `compareSet`, `COMPARE_USAGE`, compare's help; messages say "run showcase"; the set and copy format move to `help showcase`, with exit 1. Move or drop the compare tests; keep `keep` and D1 to D5 tests. Guard: `compare` exits 2 as an unknown command. Mutation: put it back in the command list.
7. **Skills.** Engine references of 02 to 05 call `showcase --lang <code>`. Propose and write steps: "Write the showcase per engine. Fix what it reports." Choose steps read the entry with `set` and leave record entries; 06 leaves entries with `set`. 02's variants reference: palette values as hex, axes named in the user's plain words, no jargon. Guard on the hex rule. README drops `compare`.

## Lost

- Verdicts not yet copied from an open `compare.html`.
- Stale `drafts/<set>/compare.html` files, removed by `keep` with the set.
- The K/R/D/C and arrow keyboard shortcuts of the compare page.
- Frame scaling needs one check in a real browser.
