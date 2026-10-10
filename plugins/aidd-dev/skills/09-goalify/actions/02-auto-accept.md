# 02 - Auto-accept

Handle confirmations autonomously within the task's safety limits.

## Input

The task to handle end-to-end, a free-form description.

## Output

- Exit status: `completed`, `stopped-payment`, `stopped-destructive`, or `stopped-out-of-scope`.
- Actions taken, with a one-sentence reason for any stopped status.

## Process

1. **Check.** Apply the task's gates before handling each action or confirmation.
   - Stop and report payments, subscriptions, or upgrades to paid tiers.
   - Stop and report destructive actions: deleting data, dropping databases, recursive removal, force-pushes, history resets, or overwriting uncommitted work.
   - Skip unrelated tools, external signups, and rabbit holes outside the original task.
2. **Act.** Handle in-scope confirmations without asking the user.
   - Accept and acknowledge prompts, dialogs, checkboxes, Y/n choices, licenses, cookies, and confirmations by default.
   - Choose recommended or standard installer options.
   - Fix failures such as missing dependencies, wrong versions, or configuration errors, then retry.
3. **Report.** Return the actual exit status and actions taken.
   - Include a one-sentence reason when stopped.

## Test

| Case | Pass |
| --- | --- |
| Exit | The status matches the actual exit path. |
| Completed task | `completed` appears only after end-to-end execution without a money or destructive gate. |
| Stopped task | Every stopped status includes a non-empty reason. |
