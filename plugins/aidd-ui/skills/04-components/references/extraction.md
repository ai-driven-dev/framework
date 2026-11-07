# Extraction

Read the code roots, even outside them. Invent nothing.

When several design systems coexist, ask which is the norm. Follow that one.

| In the code | In `aidd_docs/ui/` |
| --- | --- |
| component file | a record with a `code` link |
| its link's version | equal to the record's `version` |
| its link's platform | its code root's |
| component on only some platforms | `platforms` lists them |
| variant or state one platform's code lacks | kept in the record. Named to the user as that platform's gap |
| same component on several platforms | one record, a link per platform |
| CSS-only component | a record without `code` |
| prop varying on its own | an axis, `size=sm` |
| prop named `variant` | gives bare items |
| icon, image, illustration | an asset record, never `code` |
| file no record links (C3) | a record, `ignore`, or a backlog left listed |
