# Versions

`bump` applies the versions. It is given:

| Input | Decided by the model |
| --- | --- |
| `--breaking` | set when the change removes a variant, state or property, renames or deletes a token, or deprecates; else left out |
| `--change` | one line saying what changed; the reasons go to the user, never in the record |
| `--task` | the task folder, `aidd_docs/tasks/…` |
| refs | the tokens or ids of the agreed impact |

| Topic | Rule |
| --- | --- |
| `validated` | set by the user only, after looking at the render |
| deprecating | `replaced-by: <id>`, or `none` with a `## Deprecation` section |
| `system.md` | its version moves on a publication, which adds its row |

The engine applies the rest.
