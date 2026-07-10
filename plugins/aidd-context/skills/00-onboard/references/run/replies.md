# Replies

| Reply         | Effect                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| a number `[n]`| run that step, or open an idle-menu umbrella                                         |
| `OK`          | walk the pending steps (ranks 1-3) in order, never the idle menu                     |
| `?`           | expand the full detail (command ids, tier clauses, per-check reasons), read-only     |
| `back` / `<`  | re-render the prior screen, read-only, no re-scan                                    |
| `recap`       | summarize this session's conversation, read-only, only when a prior conversation exists |
| `explain <n>` | describe a step in two or three plain lines, read-only                               |
| `explain project` | summarize the project from its memory bank, read-only, only when memory is filled |
| `skip`        | record the step left in the ledger, it does not re-fire                              |
| `stop`        | one-line close, end the loop                                                         |
| a gap         | no installed skill, say it needs a plugin by function, offer explain or stop         |
