# Elements

| Topic | Rule |
| --- | --- |
| place | components and their renders in `aidd_docs/ui/components/`, assets with their file in `aidd_docs/ui/assets/` |
| level | an atom uses no component, a molecule uses atoms, a composition uses molecules |
| `tokens` | semantic tokens only, never a primitive |
| `states` | `default`; `focus` when interactive; `hover`, `disabled`, `loading`, `error` when they exist |
| `variants` | bare items, or `axis=value` for a prop varying on its own; never `state`, `variant` or `theme` as an axis |
| `code` | `path#Export`, `package:<name>#Export`, or the bare path of an `.astro` file |
| render coverage | each variant value and each state at least once, on an element: `data-variant`, `data-<axis>`, `data-state`; no product of axes, no repeat per theme |
| render style | `var()` of its tokens and of the elements it uses; no colour or length literal; logical properties when `rtl` is declared |
| molecule render | shows the elements it uses, with their tokens |
| length no token holds | up to 2px, a warning; larger, the nearest token, the gap named to the person |
