# Rule authoring

## Rules

- **R1.** One topic per file.
- **R2.** Concise bullets preserving literals, conditions and exceptions.
- **R3.** Explicit file scope or all files.
- **R4.** English only.
- **R5.** Never repeat, weaken or contradict active bullets within a rule.

## Naming

`#-slug[@version][-specificity]`: single-digit category prefix, no zero-padding.

| Index | Category |
| --- | --- |
| 00 | architecture |
| 01 | standards |
| 02 | programming-languages |
| 03 | frameworks-and-libraries |
| 04 | tooling |
| 05 | testing |
| 06 | design-patterns |
| 07 | quality |
| 08 | domain |
| 09 | other |

Prefer framework `03`, syntax `02`, style `01`, architecture `00`, then `04`–`08`, else `09`.

- Group multiple themes under `## group`; examples must be tiny, clarifying good code.
