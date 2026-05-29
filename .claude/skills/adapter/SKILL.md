---
name: adapter
description: >
  Creates or modifies infrastructure adapters in src/infrastructure/adapters/ and their
  corresponding port interfaces in src/domain/ports/. Use when adding a new I/O boundary
  (file system, HTTP, git, npm, OS), changing how an existing adapter translates errors, or
  wiring a new adapter into createDeps. Do NOT use for business orchestration — use `use-case`
  instead. Do NOT use for creating domain types — use `domain-model` instead.
---

# Adapter

Builds the I/O translation layer: port interfaces that describe what the application needs, and
adapter classes that fulfill those contracts by talking to the real world (filesystem, git, HTTP,
npm, OS). Adapters own all technical constants; domain errors never cross the port boundary raw.

## Available actions

| #   | Action             | Role                                              | Input                                   |
| --- | ------------------ | ------------------------------------------------- | --------------------------------------- |
| 01  | `define-port`      | Write the port interface in src/domain/ports/     | port name + method list                 |
| 02  | `implement-adapter` | Write the *Adapter class implementing the port   | port interface from 01                  |
| 03  | `wire-deps`        | Register the adapter in createDeps / createMenuDeps | adapter class from 02               |
| 04  | `test`             | Write infrastructure integration tests           | completed adapter from 02               |

## Default flow

`01 → 02 → 03 → 04`

Skip 01 when the port already exists; start at 02.

## Transversal rules

- Adapter class name ends in `Adapter`, implements exactly one port interface.
- Port: interface only, no classes, ≤5 methods, all I/O methods `async`, no `null` returns.
- No business logic in adapters — I/O and format translation only.
- Throw typed domain exceptions; never let raw third-party errors cross the port boundary.
- Never instantiate adapters directly in commands or `cli.ts` — all wiring via `createDeps`.
- Named export only.
- File name is `<concept>-adapter.ts`.

## References

- `references/adapter-rules.md` — adapter class conventions and technical-constants ownership
- `references/port-design.md` — port interface contract: ≤5 methods, async, no null, intent naming

## Invariant rules

- `references/adapter-rules.md` — authoritative adapter rules
- `references/port-design.md` — authoritative port design rules
