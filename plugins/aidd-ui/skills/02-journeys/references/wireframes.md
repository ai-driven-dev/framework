# Wireframes

| Topic | Rule |
| --- | --- |
| id | its own, unique among all records; the step names it, the screen dressing it later cites it |
| `uses` | the ids of the components it expects, existing or not yet |
| `states` | `default`; `empty`, `loading`, `error`, `no-rights` when they exist |
| `zones` | the named regions of the screen, in reading order |
| render | one `<section data-state>` per state, each holding a `data-zone` element per zone |
| style | none: no `<style>`, `style=`, `<link>` or `var()`; the screen dressing it carries the style |
| platform | none: one wireframe for every platform |
