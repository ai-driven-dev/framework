# Rule authoring

## Framing

- Default manual: ask for missing topic. `auto`: scan/propose; await selection before drafting.
- Confirm operation and [hosts](tool-paths.md#publications) or plugin. Unspecified hosts: detect/propose supported installations; await confirmation before drafting/assessment. Publish/delete: confirm existing sources through [Write](tool-paths.md#write); no drafting/assessment.
- Create/update: confirm topic, category/slug, description and scope; draft full bodies and metadata in context using [Rules](#rules), [Naming](#naming) and [rule-template.md](../assets/rule-template.md).

## Rules

- **R1.** One topic per file; split multiple topics into independent rules.
- **R2.** Concise bullets only; preserve literals, conditions and exceptions.
- **R3.** Explicit file scope or all files.
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

- Multiple themes: `## group`; at most one tiny clarifying good-code example per group.

## Assessment

- **needs review**: uncertainty that could affect comparison with existing policies (applicability/interface/activation/configuration/meaning/precedence/evidence or unreadable sources). Overrides other labels; resolve before classifying conflict or proposing changes to that source.
- Compare obligations, prohibitions, scope, conditions, exceptions and priority, including prior sources for updates.
- Exclude only proven disjoint scopes, regardless of current files.
- Show all classified findings and full candidates: paths, decisive text, scope reasoning; propose relevant create/keep/update/merge/scope/priority/cancel resolutions.

- **new**: no coverage, overlap or conflict.
- **covered**: all obligations supplied throughout scope.
- **overlap**: compatible partial repetition/extension.
- **conflict**: incompatible obligations or unjustified weakening.
