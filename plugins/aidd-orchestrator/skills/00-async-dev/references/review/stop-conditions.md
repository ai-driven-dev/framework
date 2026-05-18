# Stop conditions

The review loop evaluates four conditions, in order. The first match wins; later conditions are ignored.

## 1. Blocked label

If the linked issue carries the configured `blocked` label (default `claude/blocked`), the loop stops with `reason = blocked_label`. The Check Run conclusion is `action_required`.

Use case: a maintainer noticed a deeper issue and wants Claude out of the loop without writing a comment.

## 2. Max iterations

If the iteration counter has exceeded `config.max_iterations` (default `3`), the loop stops with `reason = max_iterations`. The Check Run conclusion is `neutral`.

Use case: convergence failure. After N rounds of fixes the reviewer probably wants to look at the PR.

## 3. Human reviewer (iteration > 1 only)

The human-reviewer stop **only fires from iteration 2 onwards**. On iteration 1, the human comments collected ARE the input the loop was triggered to address; treating them as a stop signal would make the loop a no-op.

From iteration 2 onwards, if any new comment authored since the previous iteration started is from a non-bot user, the loop stops with `reason = human_reviewer`. The Check Run conclusion is `success` if the last iteration's tests passed, else `neutral`.

Detection rules for "non-bot":
- `author.type == "Bot"` from the GitHub API -> bot
- author login ends with `[bot]` -> bot
- author login is in `config.bot_allowlist` (optional) -> bot
- otherwise -> human

Use case: a reviewer wrote feedback during the loop. Claude must not loop on top of human input. The next pass requires an explicit re-trigger.

## 4. No comments left to address

If no unaddressed non-bot comments remain in the audit log, the loop stops with `reason = no_comments`. Benign closure: action 04 still posts a summary saying "no fix iterations on this loop". The Check Run conclusion is `success`.

Use case: a `to-review` trigger with nothing concrete to fix (already addressed, or trigger fired by mistake).

## Continue

If none of the above match, the decision is `continue`. `03-fix-iteration` runs and the loop returns to `01-collect-comments`.

## Why this order

Blocked label is the strongest explicit human signal. Max iterations protects against infinite loops even when bots keep commenting. Human reviewer detection is third because a `blocked` label or `max_iterations` could coincide with a human comment, and we want the explicit signals to win. No-comments is the catch-all benign exit.
