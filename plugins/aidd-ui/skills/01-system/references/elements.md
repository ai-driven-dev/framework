# Elements

| Topic | Rule |
| --- | --- |
| place | components and their renders in `aidd_docs/ui/components/`, assets with their file in `aidd_docs/ui/assets/` |
| level | asset, atom, molecule, composition: an element uses its level or lower, never itself |
| `tokens` | semantic tokens only, never a primitive |
| `states` | `default`; `focus` when interactive; `hover`, `disabled`, `loading`, `error` when they exist |
| `variants` | bare items, or `axis=value` for a prop varying on its own; never `state`, `variant` or `theme` as an axis |
| `code` | `path#Export`, `package:<name>#Export`, or the bare path of an `.astro` file |
| `implemented-version` | the version the code implements, set with `code`; without `code` only on a molecule or composition whose used elements are implemented |
| render coverage | each variant value and each state at least once, on an element: `data-variant`, `data-<axis>`, `data-state`; no product of axes, no repeat per theme |
| render style | `var()` of its tokens and of the elements it uses; no colour or length literal; logical properties when `rtl` is declared |
| molecule render | shows the elements it uses, with their tokens |
| length no token holds | up to 2px, a warning; larger, the nearest token, the gap named to the user |
