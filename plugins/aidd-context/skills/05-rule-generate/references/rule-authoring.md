# Rule authoring

## Rules

- **R1.** One topic per file; split crowded rules.
- **R2.** Concise bullets; preserve literals, conditions and exceptions.
- **R3.** Scope to applicable files or all files.
- **R4.** English only.
- **R5.** Never repeat, weaken or contradict active bullets within a rule; resolve cross-rule findings in action 02.

## Naming

`#-slug[@version][-specificity]`: single-digit category index, no zero-padding. Examples: `2-typescript-naming`, `3-react@19-hooks`.

## Categories

| Index | Category | Covers |
| --- | --- | --- |
| 00 | architecture | Clean, Hexagonal, API design |
| 01 | standards | naming, imports, style |
| 02 | programming-languages | language syntax |
| 03 | frameworks-and-libraries | React, Prisma |
| 04 | tooling | ESLint, Docker, CI |
| 05 | testing | fixtures, mocking |
| 06 | design-patterns | Repository, Factory |
| 07 | quality | performance, security |
| 08 | domain | entities, DTOs |
| 09 | other | miscellaneous |

Pick the most specific: framework `03`, syntax `02`, style `01`, architecture `00`, then `04`–`08`, else `09`.

## Content

- Group related bullets under `## group` only for multiple themes.
- Add a tiny good-code example only to remove ambiguity.
