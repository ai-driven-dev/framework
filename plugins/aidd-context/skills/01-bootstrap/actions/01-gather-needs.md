# 01 - Gather needs

Walk the user through the 24-item checklist via interactive Q&A until all 18 user-input items (blocks 1-3) are filled. The 6 derived items (block 4) stay empty here - they are filled by actions 02 and 04.

## Inputs

- Free-form user request to bootstrap a new SaaS project.

## Outputs

A filled copy of `@${CLAUDE_PLUGIN_ROOT}/skills/01-bootstrap/assets/checklist.md` held in conversation context (not yet written to disk). Each user-input item has a concrete value replacing its `<...>` placeholder.

```markdown
- [x] **Project name** - Acme Invoicing
- [x] **One-liner** - Smart invoice tracker for freelancers, syncs with Airtable
- [x] **Type** - B2B SaaS
- [x] **Target users** - solo freelancers and 2-5 person agencies, ~500 active at 6 months
... (all 18 input items filled)
```

## Process

1. Read `@${CLAUDE_PLUGIN_ROOT}/skills/01-bootstrap/assets/checklist.md`. Print the four blocks as a single markdown checklist for the user to see the full scope upfront.
2. Ask block by block, one block per message. Within a block, ask all questions at once (the user answers in batch). Do not ask block 4 - it's derived.
3. For each user answer, fill the corresponding item. If an answer is vague ("scalable", "fast"), ask one follow-up to make it concrete (numbers, examples).
4. After block 1, sanity-check coherence: does the type match the user volume? Are the integrations realistic for the platform target?
5. After block 3, surface conflicts (e.g. budget < 50€/mo + AWS preference + heavy backend → impossible). Force a re-answer on the conflicting item.
6. Print the filled checklist (blocks 1-3 only) and ask the user to confirm "go" before passing to action 02.

## Test

The 18 user-input items in the in-memory checklist have no remaining `<...>` placeholders, the 6 block-4 items are still placeholders, and the user has explicitly confirmed the filled checklist with "go" or equivalent before action 02 starts.
