# 10 - Init tests

Install the test harness and prove it: one unit test, one end-to-end test, coverage on. Delegate the test-writing to the testing capability.

## Inputs

- The materialized project: the structure under test (`05-init-architecture`) and the stack installed (`06-init-dependencies`).

## Process

1. Install and configure the test runner + coverage reporting for the project's stack.
2. Delegate to the **testing capability** (discovered by description) to write one passing unit test and one passing end-to-end test (a per-surface smoke).
3. Run the suite.

## Test

- [ ] Unit test passes.
- [ ] End-to-end test passes.
- [ ] Coverage is reported.
- [ ] *(frontend)* A form submits through its validation layer and is covered by a test.
