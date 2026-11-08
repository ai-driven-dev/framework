# Wireframes

| Topic | Rule |
| --- | --- |
| id | its own, unique among all records. Lowercase words joined by hyphens. The step names it |
| `uses` | the ids of the components it expects. Existing or not yet, each in the form of an id |
| `uses`, component missing | warning R18. Named to the user, for the design system to add |
| `states` | `default`. `empty`, `loading`, `error`, `no-rights` when they exist |
| `zones` | the named regions of the screen, in reading order |
| render | one `<section data-state>` per state. Each holds a `data-zone` element per zone |
| style | none: the screen dressing it carries the style |
| platform | none: one wireframe for every platform |
