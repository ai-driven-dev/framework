---
description: "{{when the rule applies, one line}}"
paths:
targets: [{{host tools}}]
nativeOptions: {{host-keyed JSON object or omit}}
---

# {{title}}

- {{requirement}}

## {{group}}

- {{requirement}}

> Fill every `{{...}}`, add one `  - "glob"` line under `paths:` per file pattern or delete `paths:` for a rule on every file, omit `nativeOptions:` when unused, delete the group section when unused, and delete this line.
