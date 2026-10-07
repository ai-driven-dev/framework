# Backlog link

A backlog item is a ticket already resolved, or a path to its Markdown artefact. Never raw text.

Declare it in the feature folder as `backlog-link.json`, from
[backlog-link-template.json](../assets/backlog-link-template.json).

`backlog` is the one field: a forge reference or a project-relative Markdown path, never both.
`written_at` is now, ISO 8601 UTC. `written_by` is the skill that wrote it.

No item named, no file: an undeclared folder is normal.
Never overwrite one, so a correction by hand survives.
