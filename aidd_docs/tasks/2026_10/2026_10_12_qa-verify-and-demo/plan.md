---
objective: "Acceptance QA verifies browser and CLI criteria without video, a demo skill shows any journey, and the SDLC runs both before the draft pull request."
status: in-progress
---

# Plan: QA verifies, demo shows

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Split `aidd-qa` into verify and show, harden verify for real journeys, wire both into the SDLC |
| **Source** | #918 (agreed contract in its body), #919 |

## Phases

| #   | Phase             | File                         |
| --- | ----------------- | ---------------------------- |
| 1   | split             | [`phase-1.md`](./phase-1.md) |
| 2   | verify-rules      | [`phase-2.md`](./phase-2.md) |
| 3   | demo              | [`phase-3.md`](./phase-3.md) |
| 4   | sdlc-wiring       | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Verify carries no media; the demo owns it | a verdict is the step results; a missing `ffmpeg` must not block it |
| The demo never decides where its artifact goes | the caller (pull request, defect, user) does |
| Golden is verdicts by criterion, not bytes | an LLM run varies in wording, never in what it proves |
