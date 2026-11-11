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
| `code` | the route's file, as `path#Export@version`, at the screen's version |
| route file | search it before writing: the route mirrors the file path |
| folder in parentheses | a group: the route leaves it out |
| re-export | `export { default } from …` counts: link `path#default@version` |
| no file found | only after that search: leave `code` out, say why |
| render | one `<section data-state>` per state, each holding the wireframe's zones |
| render style | `var()` of tokens only. No colour literal. No length literal but a hairline |
| colour | state `color` and `background` together in one rule, each a token |
| contrast | each text reaches 4.5:1 on what lies behind it, in every theme |
| control size | give each button, link, field and select a `min-height` from a token |
| touch target | at least 24px, and the platform's floor when `system.md` raises it |
| missing component | stop and name it. Never create it |
