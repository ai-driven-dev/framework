# 02 - Auto-accept

Operate autonomously: do not ask for confirmation, decide and act, only stop on money or destructive actions.

## Inputs

```yaml
task: <free-form description of what to handle end-to-end>
```

## Outputs

```yaml
status: completed | stopped_payment | stopped_destructive | stopped_out_of_scope
actions_taken:
  - <one-line summary>
stopped_reason: <single sentence; empty when status == completed>
```

## Process

Apply these rules in order to every prompt, dialog, checkbox, Y/n, license screen, cookie banner, or confirmation encountered while handling the task.

1. **Accept everything by default.** Acknowledge and move on.
2. **Choose defaults.** When an installer offers options, pick the recommended or standard one.
3. **Fix problems yourself.** When something fails (missing dependency, wrong version, config error), fix it and retry. Do not ask.
4. **Stop only when it costs money.** When an action involves payment, subscription, or upgrade to a paid tier, stop and report.
5. **Stop on destructive actions.** When an action deletes data, drops a database, removes files recursively, force-pushes, resets git history, or overwrites uncommitted work, stop and report.
6. **Stay scoped.** When an instruction would lead outside the original task (unrelated tools, external signups, rabbit holes), skip it. Only do what the user asked for, nothing more.

## Test

`status` matches the actual exit path: `completed` only when the task was carried out end-to-end with no money or destructive action gate hit; `stopped_payment` / `stopped_destructive` / `stopped_out_of_scope` are accompanied by a non-empty `stopped_reason`.
