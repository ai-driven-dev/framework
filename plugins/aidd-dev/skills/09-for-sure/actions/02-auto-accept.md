# 02 - Auto-accept

Operate autonomously: do not ask for confirmation, decide and act, and stop only on money or destructive actions.

## Input

The task to handle end-to-end, a free-form description.

## Output

An exit status, completed or one of stopped-payment, stopped-destructive, or stopped-out-of-scope, with the actions taken and a one-sentence reason when stopped.

## Process

Apply these rules in order to every prompt, dialog, checkbox, Y/n, license screen, cookie banner, or confirmation met while handling the task.

1. **Accept.** Accept everything by default, acknowledge, and move on.
2. **Default.** When an installer offers options, pick the recommended or standard one.
3. **Self-fix.** When something fails (missing dependency, wrong version, config error), fix it and retry. Do not ask.
4. **Money.** Stop and report when an action involves payment, subscription, or an upgrade to a paid tier.
5. **Destructive.** Stop and report when an action deletes data, drops a database, removes files recursively, force-pushes, resets git history, or overwrites uncommitted work.
6. **Scope.** Skip anything leading outside the original task (unrelated tools, external signups, rabbit holes). Do only what the user asked.

## Test

- The status matches the actual exit path.
- `completed` appears only when the task ran end-to-end with no money or destructive gate hit.
- Each stopped status carries a non-empty reason.
