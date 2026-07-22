---
name: format
description: >
  Creates or modifies pure string-transform functions in domain/formats/. Use when adding a
  new format module (toml, markdown, json, placeholders, command), implementing a lossless
  round-trip transform and its inverse, or writing exhaustive unit tests for an existing pure
  function. Do NOT use for capability classes — use `capability` instead. Do NOT use for AI
  tool definitions — use `tool` instead. Do NOT use for I/O-bearing code — use `adapter` instead.
---

# Format

Builds pure string-transform functions that live in `domain/formats/`. Every function in this
layer is stateless, has no I/O, is a named export, and uses `.js` ESM import paths. Where a
forward transform exists, a lossless reverse transform must accompany it.

## Available actions

| #   | Action                  | Role                                                     | Input                                    |
| --- | ----------------------- | -------------------------------------------------------- | ---------------------------------------- |
| 01  | `define-pure-function`  | Write the named export with correct signature            | function name + transform description    |
| 02  | `round-trip`            | Implement the inverse function, verify lossless identity | forward function from 01                 |
| 03  | `test`                  | Write exhaustive unit tests (all branches + edge cases)  | both functions from 01-02                |

## Default flow

`01 → 02 → 03`

Skip 02 when the transform has no meaningful inverse (e.g. a lossy stringify with no parse
counterpart) — document this explicitly with a comment in the source file.

## Transversal rules

- Pure functions only: no I/O, no network, no filesystem, no side effects.
- Named exports only; no default exports.
- No `any` types; use generics or explicit union types.
- `.js` extensions on all relative imports.
- Inverse function name follows the pattern `reverse<ForwardName>` or `deserialize<Concept>`.
- A lossless round-trip means `reverse(forward(x)) === x` for all valid inputs.
- Module-level `const` in `CONSTANT_CASE` for any literal used more than once.
- File name is `<concept>.ts` (e.g. `toml.ts`, `markdown.ts`, `command.ts`).

## References

- `references/format-conventions.md` — naming, file placement, no-any rule, ESM imports
- `references/round-trip.md` — lossless identity requirement, composition order, verification pattern

## Invariant rules

- `references/format-conventions.md` — authoritative format layer rules
