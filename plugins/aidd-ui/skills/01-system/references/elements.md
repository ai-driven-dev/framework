# Elements

| Topic | Rule |
| --- | --- |
| place | components and their renders in `aidd_docs/ui/components/`, assets with their file in `aidd_docs/ui/assets/` |
| level | asset, atom, molecule, composition: an element uses its level or lower, never itself |
| `tokens` | the semantic tokens its own render uses, never a primitive; those of the elements it uses come with them |
| `interactive` | `yes` when the element itself takes focus, not when only an element it uses does |
| `states` | `default`; `focus` when interactive; `hover`, `disabled`, `loading`, `error` when they exist |
| `variants` | bare items, or `axis=value` for a prop varying on its own; never `state`, `variant` or `theme` as an axis |
| `platforms` | optional, a subset of `system.md`'s; absent means all |
| `code` | one link or a list, each `path[#Export]@<version>` or `package:<name>[#Export]@<version>`; `#Export` when the techno has one; `<version>` the one the code implements, at most `version`; at most one link per platform, a path link on its code root's |
| package link | `platform=package:<name>#Export@<version>` when `system.md` lists several platforms |
| no link | an assembled molecule or composition whose used elements are all coded, an element coded nowhere yet |
| render coverage | each variant value and each state at least once, on an element: `data-variant`, `data-<axis>`, `data-state`; no product of axes; one theme or platform shown by `data-theme` or `data-platform` on a wrapper, the base needing none |
| render style | `var()` of its tokens and of the elements it uses; no colour literal; no length literal but a hairline, as below; logical properties when `rtl` is declared |
| element no render shows faithfully | rendered as close as tokens allow, the gap named to the user |
| molecule render | copies the markup and style of the elements it uses; the impact of a change to them lists it |
| length no token holds | up to 2px, a warning; larger, the nearest token, the gap named to the user |
