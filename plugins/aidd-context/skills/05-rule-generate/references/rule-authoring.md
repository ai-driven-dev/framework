# Rule authoring

## Rules

- **R1.** One topic per file; split multiple topics.
- **R2.** Concise bullets only; preserve literals, conditions and exceptions.
- **R3.** Explicit scope or all files.
- **R4.** English unless explicitly requested otherwise.
- **R5.** Never repeat, weaken or contradict active bullets within a rule.

## Naming

`#-slug[@version][-specificity]`: single-digit category prefix, no zero-padding.

| Index | Category | Covers |
| --- | --- | --- |
| 00 | architecture | system design |
| 01 | standards | style/naming |
| 02 | programming-languages | language rules |
| 03 | frameworks-and-libraries | framework/library patterns |
| 04 | tooling | tools/configuration |
| 05 | testing | test patterns |
| 06 | design-patterns | code design patterns |
| 07 | quality | performance/security |
| 08 | domain | business logic |
| 09 | other | miscellaneous |

Prefer framework `03`, syntax `02`, style `01`, architecture `00`, then `04`–`08` in order, else `09`.

- Themes: `## group`; one tiny clarifying good-code example per group maximum.

## Assessment

- **needs review**: uncertainty that could affect comparison with existing policies. Overrides other labels.
- **new**: no coverage, overlap or conflict.
- **covered**: all obligations supplied throughout scope.
- **overlap**: compatible partial repetition/extension.
- **conflict**: incompatible obligations or unjustified weakening.
