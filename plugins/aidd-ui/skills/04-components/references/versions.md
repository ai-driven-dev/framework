# Versions

What the model decides.

| Topic | Rule |
| --- | --- |
| `--breaking` | set when the change removes a variant, state or property. Set when the change deprecates. Not set for a value change alone |
| `--change` | one line saying what changed. The reasons go to the user, never in the record |
| removing | `bump --removed <id>`, then delete the record and its render |
| deprecating | `replaced-by: <id>`, or `none` with a `## Deprecation` section |
| reached again by this task | its `history.md` row already names the task. No bump, and `bump` leaves it in `left` |
