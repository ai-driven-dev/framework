# Stop conditions

The review loop evaluates three conditions in this exact order. The first match wins; later conditions are ignored.

## 1. Blocked label

If the linked issue carries the configured `blocked` label (default `ai:blocked`), the loop stops with `reason = blocked_label`. The Check Run conclusion is `action_required`.

Use case: a maintainer noticed a deeper issue and wants Claude out of the loop without writing a comment.

## 2. Max iterations

If the iteration counter has reached `config.max_iterations` (default `3`), the loop stops with `reason = max_iterations`. The Check Run conclusion is `neutral`.

Use case: convergence failure. After N rounds of fixes the reviewer probably wants to look at the PR.

## 3. Human reviewer

If any new comment authored since the last iteration started is from a non-bot user, the loop stops with `reason = human_reviewer`. The Check Run conclusion is `success` if the last iteration's tests passed, else `neutral`.

Detection rules for "non-bot":
- `author.type == "Bot"` from the GitHub API → bot
- author login ends with `[bot]` → bot
- author login is in `config.bot_allowlist` (optional) → bot
- otherwise → human

Use case: a reviewer wrote feedback. Claude must not loop on top of human input. The next pass should be triggered by the human after they push or re-label.

## Continue

If none of the above match, the decision is `continue`. `03-fix-iteration` runs and the loop returns to `01-collect-comments`.

## Why this order

Blocked label is the strongest explicit human signal. Max iterations protects against infinite loops even when bots keep commenting. Human reviewer detection is last because a `blocked` label or `max_iterations` could coincide with a human comment, and we want the explicit signals to win.
