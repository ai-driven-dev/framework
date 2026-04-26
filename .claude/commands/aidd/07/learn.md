---
name: 'aidd:07:learn'
description: 'Update memory bank or rules with new information or requirements.'
---

# Learn Prompt

## Goal

Capture and store new learnings from recently implemented feature in memory bank, decisions, or coding rules, because our context might be outdated.

## Resources

### Doc content

```shell
! ls -1tr aidd_docs/
```

#### Decision & ADR Template

```markdown
@aidd_docs/templates/dev/decision.md
```

```markdown
@aidd_docs/templates/dev/adr.md
```

## Rules

- Less is more, documentation needs to be concise and to the point.
- Avoid putting too much information.
- Focus on important changes or non-alignments with existing doc.
- Memory should ALWAYS be up-to-date

## Steps

### Phase 0: Gather Context

List all files in `aidd_docs/` and pin relevant ones for reference:

```shell
! ls -1tr aidd_docs/
```

> You should be able to show the user which files need to be updated.

### Phase 1: Auto-Analysis (AI answers these questions)

AI analyzes the recent changes and answers these questions itself:

1. **What worked well?**
   - AI identifies effective patterns in the code
   - AI notes successful approaches used

2. **What didn't work or required multiple attempts?**
   - AI identifies corrections that were made
   - AI notes areas where initial approach changed

3. **What decisions were made and why?**
   - AI extracts technical choices from the code
   - AI infers reasoning from patterns used

4. **What patterns or approaches should be reused?**
   - AI identifies reusable solutions
   - AI notes conventions worth keeping

5. **What should be avoided next time?**
   - AI identifies anti-patterns encountered
   - AI notes pitfalls discovered

Then AI asks user:

> "Here's my analysis. Which decisions should I save to the decisions folder?"
> Here is the recommended decisions to save:
>
> 1. ...

### Phase 2: Categorize Learnings

AI categorizes each learning by destination, goal is to update the files caused by the decision.

| Category               | Destination                    | Examples                                |
| ---------------------- | ------------------------------ | --------------------------------------- |
| **Decisions**          | `aidd_docs/internal/decisions/` | Tech decisions                          |
| **Memory** (mandatory) | `aidd_docs/memory/`             | Project context, stack updates          |
| **Rules**              | `.claude/rules/`             | Coding conventions, patterns to enforce |
| **Skills**             | `.claude/skills/`            | Reusable prompts, workflows             |
| **Templates**          | `aidd_docs/templates/`          | Project templates                       |

Propose where to save each learning.

### Phase 3: Create/Update Files

1. Create file in `aidd_docs/internal/decisions/XXX-<title>.md` using decision template
2. Update ADR table in `ADR.md`
3. Create/update files in their categories as needed

### Phase 4: Sync memory references

Execute `.aidd/scripts/update_memory.js` to sync memory references in context files
