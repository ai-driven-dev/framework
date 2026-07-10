# Done rule (session ledger)

A step is done when a disk signal proves it OR the session ledger recorded it run or left this session. A done step never re-enters the next-action list. In-context session state, no file.

- Kills the re-nag for off-disk completions a disk scan cannot see: a read-only review, a MANUAL step left for the user, an explicit skip.
- The ledger is re-read every scan, so a step recorded since the last scan drops out. Disk and VCS facts refresh on change, not every loop.
