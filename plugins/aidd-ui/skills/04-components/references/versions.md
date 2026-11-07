# Versions

What the model decides.

| Topic | Rule |
| --- | --- |
| `--breaking` | set when the change removes a variant, state or property. set when the change deprecates. not set for a value change alone |
| `--change` | one line saying what changed. the reasons go to the user, never in the record |
| removing | `bump --removed <id>`, then delete the record and its render |
| deprecating | `replaced-by: <id>`, or `none` with a `## Deprecation` section |
