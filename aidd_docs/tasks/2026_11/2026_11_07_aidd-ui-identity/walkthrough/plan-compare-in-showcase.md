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
7. **Skills.** Engine references of 02 to 05 call `showcase --lang <code>`. Propose and write steps: "Write the showcase per engine. Fix what it reports." Choose steps read the entry with `set` and leave record entries; 06 leaves entries with `set`. 02's variants reference: palette values as hex, axes named in the user's plain words, no jargon. No test reads skill prose: checked by walking 02 on blank4. README drops `compare`.

## Lost

- Verdicts not yet copied from an open `compare.html`.
- Stale `drafts/<set>/compare.html` files, removed by `keep` with the set.
- The K/R/D/C and arrow keyboard shortcuts of the compare page.
- Frame scaling needs one check in a real browser.

## Next: choosing a brand as a funnel

Asked by the person after the fifth blank walkthrough: three directions, then nothing. Other tools go further after the first pick.

### What others do

| Product | Move we lack |
| --- | --- |
| Google Stitch | variants around a chosen screen; a range Refine, Explore, Reimagine; 1 to 5 options, 3 by default; every round kept side by side |
| Claude Design | builds the brand from a site, screenshots, a logo or the code, then shows it on the product's own prototypes |
| Figma Make | combines the best parts of several variations |
| Relume, Realtime Colors | lock one axis, shuffle the others; the palette shown on a real page, not as swatches |
| Midjourney | Vary subtle or strong from a pick; the remix changes the prompt while varying |

### What 02 does today

- Scratch: asks the person for references and anti-references, in words. Tested on blank4: Whoop, Oura, apnea gear.
- From the code: reads the README, manifest and visible copy. Run by the pilot on a Kairos copy, with no human answering.
- Missing: reading a site or screenshots, mixing directions, a second round, previews on the project's own screens.

### The journey, as the person lives it

1. **Start.** One question: "What do you start from?" Several answers combine.
   - Existing: the code, a site address, or screenshots.
   - References: two or three products liked, one or two disliked. For each, what to take or avoid.
   - Nothing: the current questions.
2. **Round 1, far apart.** Three directions by default, two to five on request.
   - Each column says which reference each choice comes from.
   - Each direction is shown on one or two of the project's own wireframes, not on a sample screen.
3. **Pick per axis.** The axis table is the control.
   - Click a cell to take that choice: palette of A, type of B.
   - A whole column can still be kept, revised or discarded as today.
   - The copy carries the picks.
4. **Round 2, close.** The mix, plus two variants around it.
   - Picked axes are locked; only the others move.
   - The cells that changed from round 1 are marked.
   - "Go further" asks for a wider range.
5. **Stop.** One direction kept with no revise. Earlier rounds stay on the set page, folded.

### Phases

8. **Previews on the project's screens.** The preview of a direction dresses one or two existing wireframes in its colours and type. Wireframes are bare semantic HTML (`h1`, `p`, `button`, `data-zone`), so element styles suffice; the structure stays as written. Without wireframes, today's sample screen. Guard: a set with wireframes shows a wireframe's title in each frame. Mutation: always render the sample.
9. **Pick per axis.** Set page cells are choosable; the drawer counts them; the copy gains `picks: {axis: variant}`, absent when none. A lone set copy without picks stays byte-identical. Guards: a pick reaches the copy (mutation: drop picks); two picks on one axis keep the last (mutation: keep the first).
10. **Rounds.** `variants.md` gains a `Round` column and a parent per variant. The set page shows the latest round open and earlier ones folded, and marks cells that differ from the parent. Guards: a round 2 variant marks its changed cells only (mutation: mark all); round 1 is folded (mutation: open all). `keep` removes every round.
11. **Skill 02.**
    - Prepare asks what the person starts from; a site is read with the host's fetch tool, screenshots by the model. No address is fetched without the person giving it.
    - Propose says, per axis, which reference it draws on; range far in round 1.
    - Choose reads picks, builds the mix, proposes round 2 close around it with picked axes locked; "go further" widens the range.
    - No test reads skill prose: checked by walking 02 on blank4.

### Limits

- A site behind a login or a script-only page reads as empty: ask for screenshots instead.
- Sources on the other tools are vendor pages and blogs, not tested by hand.

### Order

Phases 4 and 5 land, then 6 and 7. The person walks 02 again on blank4 in the set page. Only then phases 8 to 11: that walk shows whether picks and rounds are wanted as written.

## Later: tests that read skill prose

The person judges today's suite heavy and coupled to skill wording. Engine tests stay; tests asserting sentences in a skill go. Sorted out with the skill-generate pass, at the end.
