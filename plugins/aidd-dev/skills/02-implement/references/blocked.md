---
name: blocked
description: Conditions that make a plan blocked (needs a human), plus the retry budget.
---

# When a plan is blocked
`blocked` = implementation cannot proceed; only a human can unblock. Stop, set `status: blocked`, escalate.

- **Physically impossible** (the implementer reports it at once, no retry helps): real credit-card payment; human login (Google OAuth, Apple Face/Touch ID); a secret the AI cannot read; anything behind hardware or 2FA.
- **Stuck loop** (the implement layer counts re-spawns): retry on failure up to the budget — max 3 no-progress attempts on a milestone (`completion_score` not increasing) or 10 attempts total — then `blocked`.
