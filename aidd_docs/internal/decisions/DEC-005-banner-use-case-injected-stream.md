---
name: decision
description: BannerUseCase with injected WriteStream for testability
argument-hint: N/A
---

# Decision: BannerUseCase with injected WriteStream

| Field   | Value          |
| ------- | -------------- |
| ID      | DEC-005        |
| Date    | 2026-03-22     |
| Feature | animated-banner |
| Status  | Accepted       |

## Context

The animated banner logic was initially inline in `cli.ts`. Moving it to a use-case class required making it testable without global side-effects on `process.stdout`.

## Decision

`BannerUseCase` accepts a `NodeJS.WriteStream` in its constructor (defaults to `process.stdout`). Tests inject a mock stream with `isTTY: false` or `isTTY: true` and a `vi.fn()` write spy.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Mock `process.stdout` globally | No constructor change | Pollutes global state, fragile teardown | Side-effects bleed between tests |
| Export as plain async function | Simpler call site | No injection point, untestable | Can't swap stream in tests |

## Consequences

- Unit tests for banner run without TTY side-effects
- Pattern is consistent with other use-cases that inject ports via constructor
- Call site in `cli.ts` is `new BannerUseCase().execute()` — no boilerplate
