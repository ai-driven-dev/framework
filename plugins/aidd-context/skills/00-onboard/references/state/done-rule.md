# Done rule (session ledger)

Stops onboard from re-recommending a step already handled this session. In-context state, no file.

- Done = a disk signal proves it, OR the ledger recorded it run or left (a read-only review, a MANUAL step left, a skip).
- Re-read every scan, so a step recorded since drops out. Disk and VCS facts refresh on change, not every loop.
