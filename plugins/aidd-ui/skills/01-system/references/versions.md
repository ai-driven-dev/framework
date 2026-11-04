# Versions

What the model decides; the engine applies the rest.

| Topic | Rule |
| --- | --- |
| `--breaking` | set when the change removes a variant, state or property, renames or deletes a token, or deprecates; a value change alone is not breaking |
| `--change` | one line saying what changed; the reasons go to the user, never in the record |
| `validated` | set by the user only, after looking at the render |
| deprecating | `replaced-by: <id>`, or `none` with a `## Deprecation` section |
| publishing | `publish` adds the `system` row of `aidd_docs/ui/history.md`, which is the engine's and never edited by hand; a run is no publication |
