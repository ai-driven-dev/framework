---
name: decision
description: Shared skip signal via Promise.race for interruptible animations
argument-hint: N/A
---

# Decision: Shared skip signal for interruptible animations

| Field   | Value          |
| ------- | -------------- |
| ID      | DEC-006        |
| Date    | 2026-03-22     |
| Feature | animated-banner |
| Status  | Accepted       |

## Context

The banner animation uses multiple `sleep()` calls across phases (glitch passes, line-by-line reveal, final pause). Any keypress must skip the entire animation instantly, not just the current sleep.

## Decision

A single `skip` promise is created once via `waitForKeypress()`. A local `sleep` wrapper races every timeout against it: `(ms) => Promise.race([raw(ms), skip])`. Pressing a key resolves `skip`, which short-circuits all subsequent sleeps simultaneously.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| `Promise.race` only on final pause | Simple | Only skips the end, animation still plays fully | Poor UX — user must wait through glitch |
| AbortController | Explicit cancellation API | More boilerplate, overkill for one signal | `Promise.race` is simpler and sufficient |
| Global flag checked in each sleep | No promise chaining | Polling-style, requires extra variable | Reactive model with shared promise is cleaner |

## Consequences

- Any keypress at any point during the animation jumps immediately to CLI output
- Pattern is reusable for any future animated output: create one skip signal, wrap all sleeps
- `waitForKeypress` sets stdin raw mode then restores it — must be called once per animation, not per sleep
