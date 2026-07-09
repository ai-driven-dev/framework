# Replies

`04-run` routes the user's reply.

| Reply         | Effect                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| a number `[n]`| run that step per its tier; an idle-menu umbrella re-renders its member sub-list instead |
| `OK`          | walk the pending steps (ranks 1-3) in order; never the idle menu                   |
| `?`           | expand the full detail (command ids, tier clauses, per-check reasons); read-only   |
| `back` / `<`  | re-render the prior screen via `03-present`; read-only, no re-scan                  |
| `recap`       | summarize this session's conversation; read-only; only when a prior conversation exists |
| `explain <n>` | describe a step in two or three plain lines; read-only                              |
| `skip`        | record the step left in the ledger; it does not re-fire                             |
| `stop`        | one-line close, end the loop                                                        |
| a gap         | no installed skill; say it needs a plugin, by function; offer explain or stop       |

- Read-only replies (`?`, `back`, `recap`, `explain`, `stop`) and umbrella picks do not re-scan.
- After a step or the `OK` walk runs, re-scan (`→ 01`) and re-render.
