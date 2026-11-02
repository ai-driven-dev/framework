# Versions

| Case | `version` | Breaking | `status` |
| --- | --- | --- | --- |
| record created | `1`, `system.md` `1.0.0` | no | `proposed` |
| element or screen the change reaches | +1 | yes when it removes a variant, state or property, renames or deletes a token, or deprecates; else no | `proposed` |
| deprecated element, a token's value changed | unchanged | | `deprecated` |
| deprecated element, a token it cites renamed or deleted | +1 | yes | `deprecated` |

| Topic | Rule |
| --- | --- |
| History row | Version, Change, Breaking, Task: the task folder |
| `implemented-version`, `code` | unchanged: the code follows in the feature |
| `system.md` version | unchanged: a publication adds its row |
| deprecating | `replaced-by: <id>`, or `none` with a `## Deprecation` section |
| reached screen under review | in that review's `## Verdicts`, one `pending` row per state at the new version; `impact` lists no review, read them |
