# Review

| Topic | Rule |
| --- | --- |
| place | `aidd_docs/ui/reviews/<id>.md`, with no render |
| `id` | what the round reviewed, then `-review`: `screens-review`. Never a record's id |
| taken id | add `-2`, then `-3`. Never a date |
| `status`, `version` | `validated` and `1`: the verdicts are the user's |
| `scope` | `system` |
| `screens` | the id of each record reviewed, whatever its kind |
| `## Verdicts` | one table: `Screen`, `State`, `Version`, `Verdict`, `Comment` |
| rows | one for each state of each record reviewed. The engine adds `pending` rows on a version bump |
| `Screen`, `Version`, `Verdict`, `Comment` | as pasted, with a space for each `\|` and line break in a comment |
| coded screen | its `code` link names its own version |
| capture | `screens/<id>.<state>@<version>.png`, a PNG beside the record |
