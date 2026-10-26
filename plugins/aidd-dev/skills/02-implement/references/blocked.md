---
name: blocked
description: Conditions that make a plan blocked (needs a human).
---

# When a plan is blocked

`blocked` means implementation cannot proceed and only a human can unblock it. Stop, set `status: blocked`, and escalate.

Physically impossible for the AI (no retry helps): real credit-card payment; human login (Google OAuth, Apple Face/Touch ID); a secret the AI cannot read; anything behind hardware or 2FA.
