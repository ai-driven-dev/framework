# Rule authoring

The contract every generated rule must satisfy. A rule governs editor and agent behavior for a set of files.

## Rules

- **R1.** One rule file, one topic. Split a crowded rule into several files.
- **R2.** Bullets only, no prose. One ultra-short rule per bullet (3-7 words). Less is more.
- **R3.** Scope every rule to the files it applies to, or mark it as applying to all.
- **R4.** English only, regardless of conversation language.

## File naming

Format `#-slug[@version][-specificity]`. The `#` is the category index, single digit, no zero-pad. Examples: `2-typescript-naming`, `3-react@19-hooks`.

## Category taxonomy

| #   | Category                   | Covers                                        |
| --- | -------------------------- | --------------------------------------------- |
| 00  | `architecture`             | system patterns (Clean, Hexagonal, API design) |
| 01  | `standards`                | code style, naming (camelCase, imports)       |
| 02  | `programming-languages`    | language-specific rules (TS strict mode)      |
| 03  | `frameworks-and-libraries` | framework/lib patterns (React, Prisma)        |
| 04  | `tooling`                  | tool/infra config (ESLint, Docker, CI)        |
| 05  | `testing`                  | test patterns (fixtures, mocking)             |
| 06  | `design-patterns`          | code design (Repository, Factory)             |
| 07  | `quality`                  | perf and security (caching, auth)             |
| 08  | `domain`                   | business logic (entities, DTOs)               |
| 09  | `other`                    | miscellaneous                                 |

Pick the most specific match: framework `03`, language syntax `02`, agnostic style `01`, architecture `00`, then `04`-`08` in order, else `09`.

## Content

- Group related bullets under a `## group` heading when the rule has several themes. Skip groups for a short rule.
- Add one tiny example per group only when it removes ambiguity. Good code only.
