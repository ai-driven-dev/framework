# Axis: code

| Area | Look for |
| --- | --- |
| correctness | wrong logic, a boundary, a race |
| compatibility | a break for existing callers, data, config or migrations |
| security | a secret, missing authorization, an injection, a risky dependency, hostile input that reaches the diff |
| failure | an error swallowed or left undiagnosable |
| performance | a cost that grows with real input |
| architecture | drift from the documented architecture |
| interface | a UI, CLI or API state, message or accessibility gap |
| tests | a changed behaviour no test could fail for, an existing test weakened or deleted |
| code health | naming, readability, dead code |
