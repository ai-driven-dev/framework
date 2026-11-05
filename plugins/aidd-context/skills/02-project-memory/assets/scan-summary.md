<!-- Fill both tables from the scan, show them, and remove this comment. -->

Here is what I read.

| Capability     | Holds because                                  |
| -------------- | ---------------------------------------------- |
| core           | always                                          |
| ecosystem      | always                                          |
| `<capability>` | `<the path or dependency that proves it>`       |
| `<capability>` | `<the path or dependency that proves it>`       |

| Tool             | Human    | Agent    | Owned by      |
| ---------------- | -------- | -------- | ------------- |
| `<vcs platform>` | `<mode>` | `<mode>` | `<file>.md`   |
| `<tool>`         | `<mode>` | `<mode>` | `<file>.md`   |
| `<tool>`         | `<mode>` | none     | none          |

Ask for what the repo cannot prove only when it materially affects the authorized work: a tool nobody
committed, an access mode, or a hand-off. Name what is missing rather than asking an open question.

- One row per capability, one row per tool. Evidence is a path, a dependency, or the user's explicit confirmation, never an unsupported claim.
- A capability that holds always says so; do not invent evidence for it.
- Drop the second table when the project reaches nothing outside itself.
