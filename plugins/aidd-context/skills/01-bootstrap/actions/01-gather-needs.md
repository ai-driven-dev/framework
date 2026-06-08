# 01 - Gather needs

Walk user through the 24-item checklist via interactive Q&A until all 18 user-input items (blocks 1-3) filled. The 6 derived items (block 4) stay empty here - filled by actions 02, 04, 05.

## Inputs

- Free-form user request to bootstrap a new SaaS project.

## Outputs

Filled copy of `@../assets/checklist.md` held in conversation context (not yet on disk). Each user-input item has a concrete value replacing its `<...>` placeholder.

```markdown
- [x] **Project name** - Acme Invoicing
- [x] **One-liner** - Smart invoice tracker for freelancers, syncs with Airtable
- [x] **Type** - B2B SaaS
- [x] **Target users** - solo freelancers and 2-5 person agencies, ~500 active at 6 months
... (all 18 input items filled)
```

Plus selected **building blocks** - data, and any of auth, email, file storage, background jobs, scheduled jobs (CRON), payments, logging - recorded later in `INSTALL.md`.

## Process

1. Read `@../assets/checklist.md`. Print the four blocks as a single markdown checklist so user sees full scope upfront.
2. Ask block by block, one block per message. Within a block, ask all questions at once (user answers in batch). Do not ask block 4 - derived.
3. For each user answer, fill the matching item. If vague ("scalable", "fast"), ask one follow-up to make it concrete (numbers, examples).
4. After block 1, sanity-check coherence: type matches user volume? Integrations realistic for the platform target?
5. After block 3, surface conflicts (e.g. budget < 50€/mo + AWS preference + heavy backend → impossible). Force a re-answer on the conflicting item.
6. Capture **technical building blocks** the app needs - data, and any of auth, email, file storage, background jobs, scheduled jobs (CRON), payments, logging/errors; select only those that apply. These feed provider decisions (actions 04-05) and the scaffold.
7. Print the filled checklist (blocks 1-3) + selected building blocks; ask user to confirm "go" before passing to action 02.

## Test

The 18 user-input items in the in-memory checklist have no remaining `<...>` placeholders, the 6 block-4 items are still placeholders, the selected building blocks are captured, and the user has explicitly confirmed with "go" or equivalent before action 02 starts.
