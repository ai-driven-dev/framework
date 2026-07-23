---
name: 11-qa
description: Run post-review QA for a planned UI feature and produce reviewer evidence. Use when the user wants to validate a happy path, exercise edge cases, record QA video, or prepare QA evidence for a pull request. Not for writing automated tests, reviewing a diff, or fixing the application.
argument-hint: load-scope | choose-video | run-scope | save-evidence | offer-pr-upload
---

# QA

Validate a reviewed UI feature through its planned test scope and produce evidence for reviewers.

## Actions

| #   | Action            | Role                                                     | Input                         |
| --- | ----------------- | -------------------------------------------------------- | ----------------------------- |
| 01  | `load-scope`      | Load and show the planned happy path and edge cases     | plan path                     |
| 02  | `choose-video`    | Confirm happy-path or full-scope video coverage         | displayed QA scope            |
| 03  | `run-scope`       | Execute every confirmed scenario and record its verdict | scope and video choice        |
| 04  | `save-evidence`   | Save QA media and the report in the feature folder      | execution results             |
| 05  | `offer-pr-upload` | Offer to add the main video to an existing pull request | saved evidence and pull request |

Run `01 → 02 → 03 → 04 → 05` for a QA run. Run `05` alone only when saved QA evidence and an existing pull request are supplied. Run each action's Test before the next.
Before running an action, read its file in `actions/`, not only the table or assets.

## Transversal rules

- Run against a reviewed change. A failed scenario returns findings to the implementation loop. It never patches the application.
- Take the happy path and edge cases only from the plan's test scope. Propose additional edge cases only for the user to confirm.
- Save all evidence in the feature folder beside the plan and phases.
- An external pull request update requires an existing request and the user's approval.
