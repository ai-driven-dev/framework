# Screens

| Topic | Rule |
| --- | --- |
| place | records and renders in `aidd_docs/ui/screens/` |
| `id` | its own, never the wireframe's: ids are unique among all records |
| `wireframe` | the id of the wireframe it dresses |
| `uses` | the components it shows, each already in `components/` |
| `states` | those of its wireframe |
| `tokens` | the semantic tokens its render uses, never a primitive |
| `breakpoints` | each one `system.md` declares that the screen adapts to |
| `route` | the path it answers |
| render | one `<section data-state>` per state, each holding the wireframe's zones |
| render style | `var()` of tokens only. No colour literal. No length literal but a hairline |
| colour | state `color` and `background` together in one rule, each a token |
| contrast | each pair reaches 4.5:1, in every theme |
| control size | give each button, link, field and select a `min-height` from a token |
| touch target | at least 24px, and the platform's floor when `system.md` raises it |
| missing component | stop and name it. Never create it |
