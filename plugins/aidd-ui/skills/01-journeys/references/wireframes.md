# Wireframes

| Topic | Rule |
| --- | --- |
| id | its own, unique among all records. Lowercase words joined by hyphens. The step names it |
| `uses` | the ids of the components it expects. Existing or not yet, each in the form of an id |
| `uses`, component missing | warning R18. Named to the user, for the design system to add |
| `states` | `default`. `empty`, `loading`, `error`, `no-rights` when they exist |
| `zones` | the named regions of the screen, in reading order |
| step | a screen the persona sees. A notification or an email is the action of the step before. Another actor's screens make their own journey |
| render | one `<section data-state>` per state. Each holds a `data-zone` element per zone |
| zone content | what it shows, in plain HTML: headings, labels, fields, buttons, rows |
| state content | what changes: the empty message, a loading placeholder, the error. A state identical to another is not one |
| style | none: the screen dressing it carries the style |
| platform | none: one wireframe for every platform |
