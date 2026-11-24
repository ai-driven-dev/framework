# Challenge: Scheduled task trials

## Round 1

Aim: Prove the complete workflow on representative inputs before the user enables recurrence.

### Deal breakers

- Configuration can activate a job before its trial. Evidence at `d46fcb5d0` in `01-configure.md`, step 5 → defer activation until the user sees and accepts a passing run.
- A paper trace can finish testing without executing either skill. Evidence at `d46fcb5d0` in `02-test.md`, steps 1–5 → monitor a real one-off run and compare the handoffs and final output to criteria fixed before it starts.
- A retry after partial delivery can book an invoice twice. Evidence at `d46fcb5d0` in `02-test.md`, step 5, which restarts from the beginning without reconciling prior effects → retry on clean data or an idempotent destination after checking the previous run.

### To decide

- None

### Suggestions

- None

### Holds

- A request limited to a draft can still produce a portable prompt when the chosen scheduler is unavailable.
