---
source: {{source path}}
generated_at: {{generated at}}
status: clean
---

# Shadow Areas Report

Source: `{{source path}}`
Generated: `{{generated at}}`

Total gaps: {{total}} | Blocker: {{blocker count}} | Major: {{major count}} | Minor: {{minor count}}

## Warnings

- {{warning}}

## Gaps by Category

### {{category}}

[{{severity}}] {{probe}}
> {{snippet}}

#### Closed

[{{severity}}] {{probe}}
> {{snippet}}

#### Still Open

[{{severity}}] {{probe}}
> {{snippet}}

#### Newly Introduced

[{{severity}}] {{probe}}
> {{snippet}}

<!-- Fill, then strip this comment. Repeat a category and its gaps as needed. Without a diff, write gaps right under the category and omit Closed, Still Open and Newly Introduced; with one, write gaps only inside them. Omit a snippet a gap does not have. -->
