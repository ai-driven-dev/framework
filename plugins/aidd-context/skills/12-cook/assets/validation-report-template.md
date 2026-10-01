<!-- Choose success only when deterministic and semantic checks both pass; otherwise choose failure. Replace every placeholder and remove these instructions and the unused branch. Emit the report without writing a file. -->

<!-- Success: count validated recipes and list unavailable optional parsers, or none. -->
```text
PASS: <n> recipe(s) validated.
Checks: deterministic and semantic; unavailable parsers: <languages or none>.
```

<!-- Failure: include one row per deterministic or semantic finding, with a line-specific correction. Disclose unavailable optional parsers in a relevant finding or after the table. -->
```md
| File | Line | Rule | Fix |
| --- | ---: | --- | --- |
| <path> | <line> | <rule> | <specific correction> |
```
