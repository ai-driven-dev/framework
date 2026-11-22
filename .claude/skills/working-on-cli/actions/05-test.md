# Write or fix a test

Load `references/architecture.md` and `references/contexts/<ctx>.md`. Commands, projects, mutation floors, fixtures and sandbox: `aidd_docs/memory/testing.md`. Golden machine independence, bug reproduction and the challenge pass: `references/test/`.

1. Pick the lowest level that proves the behaviour; the suffix selects the vitest project. A behaviour is proven at one level, never repeated above it.

| Level | Where | For |
| --- | --- | --- |
| unit | mirror path of the module | a rule or a use case over in-memory doubles, no fs |
| contract | `tests/contexts/<ctx>/ports/` | one suite per port, run on the fake and on the real adapter |
| integration | mirror path | an adapter on a real temp directory, or layers assembled |
| e2e | `tests/e2e/` | the built binary: exit code, output, files |
| golden | `tests/golden/` | a full generated output against a versioned snapshot |
| arch | `tests/architecture/` | a ratchet over source text |

2. Name behaviour: `describe` a situation, `it` an observable result. One file, one subject; "and" in a `describe` means two.
3. Run it and see it fail for the reason its name gives. A test green on its first run is dropped, unless it characterizes behaviour before a move (green first, same inverted proof).
4. Ship each guard with its plant: break the named behaviour and see this test red and no other. `biome-guards-bite.arch.test.ts` is the model; no gate enforces it for other tests.
5. Assert a value, a write or a message, never an internal call. A double stubs answers and never re-implements the logic it replaces. No clock, network, current directory or test order.
6. A context's tests import its own `tests/contexts/<ctx>/testing/` kit only, and another context through its `application/` and `contract/` (Biome `noRestrictedImports`, `no-laundered-test-interior.grit`). A kit holds one subject per file: builders, one fake per port, contract suites.
7. A contract suite is `describe<Port>Contract(subjectName, makeSubject)` in the kit, called by one `*.contract.test.ts`. Red on the real adapter means a wrong case; red on the fake, fix the fake. Cases are only what the port can drive.
8. Tool profiles and ids reach a test only through `registeredTools()` and `TOOL` (`tests/shared/testing/registered-tools.builder.ts`); a synthetic profile is `ProfileBuilder` wrapped by `catalogOf`.
9. Never run a real AI host binary in a test: e2e runs in the sandbox of `cli-sandbox.builder.ts`, held by `sandbox-reaches-no-tool-binary.e2e.test.ts`. A real-host check is `pnpm smoke:real`, opt-in and local; delete the chat it creates.
10. Goldens, e2e and fixtures are a frozen surface: `pnpm golden:update` only for a deliberate product change. A test file over 400 lines fails Biome (`tests/**` override in `biome.json`).
