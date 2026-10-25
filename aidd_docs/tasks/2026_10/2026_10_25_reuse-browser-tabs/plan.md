---
objective: "The browser QA instructions require reusing one tab or tab group for each scenario and closing its session when finished."
status: in-progress
---

# Plan: Reuse browser tabs in QA

Source: User request (2026-10-25)

## Phases

| # | Phase | File | Depends on |
| --- | --- | --- | --- |
| 1 | Clarify browser session lifecycle | [`phase-1.md`](./phase-1.md) | none |

## External sources

| URL | What it settled |
| --- | --- |
| none | none |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| regression | Low: one instruction added to the Playwright QA reference; no runtime code changes. | phase-1 |
| documentation | The active browser QA instructions already require one session per scenario and closing it, but do not explicitly require reusing its tab across steps. | phase-1 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `docs/ARCHITECTURE.md`: capabilities belong to the owning concern | The browser QA interface reference belongs to the `aidd-qa` plugin. |
