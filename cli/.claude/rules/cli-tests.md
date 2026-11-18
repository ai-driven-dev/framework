---
description: Apply when writing, changing or reviewing a test; levels, guard pointers, the discipline and the 8-item grid.
paths:
  - "tests/**"
---

# Tests

## Levels, lowest that proves the behaviour; the suffix selects the vitest project

| Level | Folder | Use for |
| --- | --- | --- |
| unit `.unit.test.ts` | mirror path of the module | a domain rule or a command over in-memory doubles, no fs (`unit-tests-reading-disk.arch.test.ts`) |
| contract `.contract.test.ts` | `tests/contexts/<ctx>/ports/` | one suite per port, run on the double and on the real adapter |
| integration `.integration.test.ts` | mirror path of the module | an adapter on a real temp directory, or layers assembled |
| e2e `.e2e.test.ts` | `tests/e2e/` | the built binary: exit code, output, files; one per command and per family of failure |
| golden `.golden.test.ts` | `tests/golden/` | a full generated output against a versioned snapshot |
| characterization | the level of the code it covers | behaviour no test covers, written before a move; green first, proof inverted |
| arch `.arch.test.ts` | `tests/architecture/` | a ratchet over source text; elsewhere it runs nowhere |

## Guards

- Kit: a context's tests import its own `tests/contexts/<ctx>/testing/` only, `kit-isolation.arch.test.ts`.
- Another context is reached through its `application/` and `contract/` only, `test-cross-context-imports.arch.test.ts`.
- Mirror: `tests/` follows `src/`, `test-mirror-path.arch.test.ts`.
- A test file stays under 800 lines, `test-file-size.arch.test.ts`; 400 is a review point.

## Discipline

- Write the test first and watch it fail for the reason its name gives; one green on its first run is dropped, a characterization test excepted.
- One home per case: a behaviour is proven at one level, never repeated above it.
- A guard ships with its plant: break the named behaviour and see this test red, no other (`biome-guards-bite.arch.test.ts`).
- Mutation floors and runs: `aidd_docs/memory/testing.md`.
- A test double stubs answers; it never re-implements the production logic it replaces (review rule, no guard).

## Grid

1. A name states behaviour: `describe` a situation, `it` an observable result, in English.
2. One file, one subject; "and" in a `describe` means two.
3. Relevance: the test proves what no other test proves.
4. The assertion bears on a value, a write or a message, never an internal call.
5. Mock smell: renaming a private method breaks it, or mocks outnumber assertions.
6. Breaking the named behaviour turns this test red and no other.
7. No dependency on the clock, the network, the current directory or the order.
8. The file mirrors its source; one test file per command.
