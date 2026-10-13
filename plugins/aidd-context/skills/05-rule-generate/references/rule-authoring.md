# Rule authoring

## Framing

- Manual is default; ask for a missing topic. `auto`: scan/propose, then await selection before drafting.
- Confirm operation and destinations: [host IDs](tool-paths.md#publications) or plugin. Unspecified hosts: detect/propose supported installed tools before confirmation. Publish/delete: confirm existing sources through [Write](tool-paths.md#write); skip drafting/assessment.
- Create/update: confirm topic, category/slug, description and scope; draft complete bodies and metadata in context using [Rules](#rules), [Naming](#naming) and [rule-template.md](../assets/rule-template.md).

## Rules

- **R1.** One topic per file; split multiple topics into independent rules.
- **R2.** Concise bullets only; preserve literals, conditions and exceptions.
- **R3.** Explicit file scope or all files.
- **R4.** Rule text in English unless explicitly requested otherwise.
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

- Group multiple themes under `## group`; use at most one tiny clarifying good-code example per group.

## Assessment

- Compare obligations, prohibitions, scope, conditions, exceptions and priority, including prior sources for updates.
- Exclude only proven disjoint scopes, independently of current files.
- Classify and show all findings and full candidates with paths, decisive text and scope reasoning; propose relevant create/keep/update/merge/scope/priority/cancel resolutions.

- **new**: no coverage, overlap or conflict.
- **covered**: all obligations supplied throughout scope.
- **overlap**: compatible partial repetition/extension.
- **conflict**: incompatible obligations or unjustified weakening.
- **needs review**: unresolved applicability/meaning/precedence/evidence.
