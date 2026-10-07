# Backlog link

A backlog item is a ticket already resolved, or a path to its Markdown artefact. Never raw text.

Declare it in `backlog-link.json`, in the feature folder:

```json
{
  "backlog": "owner/repo#123",
  "written_at": "2026-08-21T09:00:00Z",
  "written_by": "aidd-pm:04-spec"
}
```

`backlog` is the one field: a forge reference or a project-relative Markdown path, never both.
`written_at` is now, ISO 8601 UTC. `written_by` is the skill that wrote it.

No item named, no file: an undeclared folder is normal.
Never overwrite one, so a correction by hand survives.
