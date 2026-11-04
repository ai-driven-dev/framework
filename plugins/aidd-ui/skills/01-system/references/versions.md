# Versions

`bump` applies the versions. It is given:

| Input | Decided by the model |
| --- | --- |
| `--breaking` | set when the change removes a variant, state or property, renames or deletes a token, or deprecates; a value change alone is not breaking |
| `--change` | one line saying what changed; the reasons go to the user, never in the record |
| `--task` | the task folder, `aidd_docs/tasks/…` |
| refs | the tokens or ids of the agreed impact |

Within one task an element is raised once: a later `--breaking` change turns its row to breaking, with the change text added.

| Topic | Rule |
| --- | --- |
| `validated` | set by the user only, after looking at the render |
| deprecating | `replaced-by: <id>`, or `none` with a `## Deprecation` section |
| history | `aidd_docs/ui/history.md` is the engine's, one row per version of each record, no history in a record; `bump` appends, `bump --created` writes the first row |
| system version | its rows in `history.md`, id `system`, semver; a publication adds one, its Task listing the published tasks, written by `publish`; a run is no publication |

The engine applies the rest.
