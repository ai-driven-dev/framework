# Extraction

Read the code roots, even outside them; invent nothing. When several design systems coexist, ask which is the norm and follow that one.

| In the code | In `aidd_docs/ui/` |
| --- | --- |
| component file | a record with a `code` link: its version equal to the record's `version`, its platform its code root's |
| component on only some platforms | `platforms` lists them |
| variant or state one platform's code lacks | kept in the record, named to the user as that platform's gap |
| same component on several platforms | one record, a link per platform |
| CSS-only component | a record without `code` |
| prop varying on its own | an axis, `size=sm`; a prop named `variant` gives bare items |
| icon, image, illustration | an asset record, never `code` |
| file no record links (C3) | a record, `ignore`, or a backlog left listed |
