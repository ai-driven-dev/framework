# Axis: code

Read the diff and what it reaches, each finding under its kind.

| Kind | Look for |
| --- | --- |
| `correctness` | wrong logic, a boundary, a race |
| `compatibility` | a break for existing callers, data, config or migrations |
| `security` | a secret, missing authorization, an injection, a risky dependency |
| `error-handling` | a failure swallowed or left undiagnosable |
| `performance` | a cost that grows with real input |
| `architecture` | drift from the documented architecture |
| `interface` | a UI, CLI or API state, message or accessibility gap |
| `code-health` | naming, readability, dead code |
| `tests` | a changed behaviour no test could fail for |
| `regression` | an existing test weakened or deleted |
| `adversarial` | a malformed or hostile input that reaches the diff |
