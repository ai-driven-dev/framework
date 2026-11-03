# Review rubric

## Finding

| Term | Meaning |
| --- | --- |
| Finding | a defect tied to the diff, with its proof and its smallest fix |
| Proof | the `file:line` that makes the defect real: where the value comes from, who calls the code, the contract it breaks |
| Limit | a doubt left unproven, or a shape nothing reaches; never a finding |

## Severity

| Severity | When |
| --- | --- |
| 🔴 critical | would harm production, its users, their data or what depends on it |
| 🟡 major | any other defect worth fixing |
| 🟢 minor | a matter of taste: style, wording, an optional improvement |

## Verdict

The strictest that holds.

| Verdict | When |
| --- | --- |
| `blocked` | a critical finding |
| `changes-requested` | a major finding, an unchecked criterion, or `functional` with no criterion met |
| `approve` | otherwise |
