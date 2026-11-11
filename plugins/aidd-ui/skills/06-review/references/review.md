# Review

| Topic | Rule |
| --- | --- |
| place | `aidd_docs/ui/reviews/<id>.md`, with no render |
| `id` | its own, the file's name: ids are unique among all records |
| `status`, `version` | `proposed` and `1` |
| `scope` | `system` |
| `screens` | the id of each record reviewed, whatever its kind |
| `## Verdicts` | one table: `Screen`, `State`, `Version`, `Verdict`, `Comment` |
| rows | one for each state of each record reviewed |
| `Screen`, `Version`, `Verdict`, `Comment` | as pasted, with a space for each `\|` and line break in a comment |
| coded screen | its `code` link names its own version |
| capture | `screens/<id>.<state>@<version>.png`, a PNG beside the record |
