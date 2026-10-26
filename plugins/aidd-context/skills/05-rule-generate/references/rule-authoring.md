# Rule authoring

## Rules

- R1. One topic per file; split multiple topics.
- R2. Concise bullets; keep literals, conditions and exceptions.
- R3. Explicit scope or all files.
- R4. English unless asked otherwise.
- R5. Distinct bullets: none repeats, weakens or contradicts another.

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

Pick in order: `03`, `02`, `01`, `00`, `04`–`08`, else `09`.

- Themes: `## group`, at most one tiny good-code example each.
