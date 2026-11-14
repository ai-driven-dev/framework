# Versions

What the model decides.

| Topic | Rule |
| --- | --- |
| `--breaking` | set when the change renames or deletes a token. Not set for a value change alone |
| `system` | named in `bump` whenever `system.md` changes |
| `system` rows | the semver rows count publications. The integer rows count contents. Keep both, and never ask the user to pick |
| `--change` | one line saying what changed. The reasons go to the user, never in the record |
