# 05 - Write or fix a test

Prove behaviour at the lowest level that shows it, once.

## Input

The behaviour to prove or the test to fix.

## Output

A test that failed first for the reason its name gives, at one level.

## Process

1. **Load.** Read [architecture.md](../references/architecture.md) and the `references/contexts/<ctx>.md`. Commands, projects, mutation floors, fixtures and sandbox are in [testing.md](../../../../cli/aidd_docs/memory/testing.md); golden machine independence, bug reproduction and the challenge pass are in [golden-machine-independence.md](../references/test/golden-machine-independence.md), [bug-empirical-reproduction.md](../references/test/bug-empirical-reproduction.md) and [test-challenge-pass.md](../references/test/test-challenge-pass.md).
2. **Level.** Pick the lowest level that proves the behaviour; the suffix selects the vitest project. A behaviour is proven at one level, never repeated above it.

   | Level | Where | For |
   | --- | --- | --- |
   | unit | mirror path of the module | a rule or a use case over in-memory doubles, no fs |
   | contract | `tests/contexts/<ctx>/ports/` | one suite per port, run on the fake and on the real adapter |
   | integration | mirror path | an adapter on a real temp directory, or layers assembled |
   | e2e | `tests/e2e/` | the built binary: exit code, output, files |
   | golden | `tests/golden/` | a full generated output against a versioned snapshot |
   | arch | `tests/architecture/` | a ratchet over source text |

3. **Name.** `describe` a situation, `it` an observable result. One file, one subject; "and" in a `describe` means two.
4. **Red first.** Write the test first and see it fail ([coding-assertions.md](../../../../aidd_docs/memory/coding-assertions.md), Before the code).
5. **Plant.** Ship each guard with its plant: break the named behaviour and see this test red and no other. `biome-guards-bite.arch.test.ts` is the model; no gate enforces it for other tests.
6. **Assert.** Assert a value, a write or a message, never an internal call. A double stubs answers and never re-implements the logic it replaces. No clock, network, current directory or test order.
7. **Kit.** A context's tests import its own `tests/contexts/<ctx>/testing/` kit only, and another context through its `application/` and `contract/` (Biome `noRestrictedImports`, `no-laundered-test-interior.grit`). A kit holds one subject per file: builders, one fake per port, contract suites.
8. **Contract suite.** It is `describe<Port>Contract(subjectName, makeSubject)` in the kit, called by one `*.contract.test.ts`. Red on the real adapter means a wrong case; red on the fake, fix the fake. Cases are only what the port can drive.
9. **Tools.** Tool profiles and ids reach a test only through `registeredTools()` and `TOOL` (`tests/shared/testing/registered-tools.builder.ts`); a synthetic profile is `ProfileBuilder` wrapped by `catalogOf`.
10. **Sandbox.** Run no real AI host binary in a test: e2e runs in the sandbox of `cli-sandbox.builder.ts` (`testing.md`, Fixtures and sandbox).
11. **Real host.** For a real-host check run `pnpm smoke:real`, opt-in and local ([smoke-real.md](../../../../cli/aidd_docs/memory/internal/smoke-real.md)).
12. **Clean up.** Delete the chat the real-host check creates.

## Test

| Case | Pass |
| --- | --- |
| the new test on first run | red for the reason its name gives |
| the named behaviour broken by hand | this test is red and no other |
| `pnpm test` | every project green, no real host binary reached |
