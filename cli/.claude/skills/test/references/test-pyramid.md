# Reference: Test Pyramid

## Tiers

| Suffix | Target | Mock strategy |
| ------ | ------ | ------------- |
| `*.unit.test.ts` | domain models, pure functions, use-case logic | mock all ports via in-memory implementations from `tests/helpers/ports/` |
| `*.integration.test.ts` | adapters + real-FS contracts, use-case format serialization | real temp filesystem where needed; mock HTTP servers |
| `*.e2e.test.ts` | full CLI user journeys | real binary via `runCli()`, local fixtures only |

## Unit rules

- No real filesystem, no real I/O
- Mock only ports (domain interfaces) — never mock use-case internals
- `describe.concurrent()` forbidden
- Cover: business logic, branches, error paths

## Integration rules — adapters

- One file per adapter
- Cover: error parsing, retry logic, format transformation not visible in E2E

## Integration rules — application

- Real temp filesystem only when adapter boundary behavior is the test target
- Mock all ports otherwise

## E2E rules

- 5–10 scenarios per command max
- `describe.concurrent()` required at top level
- `try/finally` cleanup
- Marketplace = local fixture (`tests/fixtures/framework-real`); real GitHub only in manual smoke
- TTY interactive flows: use `expect(1)` shell-out via `execFile`
- Wall clock: <30s for the full suite

## Forbidden

- `it.skipIf(networkAvailable)` patterns
- Tests depending on real GitHub / external HTTP / real filesystem outside tmp
- Snapshot tests on menu trees / output strings
- Multiple permutations of the same flag combination — pick one representative case
- Deleting unit tests that an E2E now covers (only delete if same scenario AND same assertion)

## Test name rules

- Test name = observable behaviour sentence
- Use nested `describe` not prefix separators
- `describe('<ClassName>')` wraps all tests for that class
