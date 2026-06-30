# The AIDD journey

The flow onboard explains and guides through, from the course (`courses/05_ai_coding/0501_flow.md`). It is a sequence, not a cage: the user can jump anywhere, and some steps only apply when the work needs them. Onboard suggests the next logical step and lets the user choose.

Onboard describes a step by what it **achieves**, then resolves it to a skill that is actually installed by matching descriptions (see Resolving). It never names a skill or plugin that is not installed.

## The flow

Context comes first and sits underneath everything: the project memory bank, so the AI knows the project instead of guessing each session. This is the foundation, and onboard's own plugin sets it up, so it is always available. A greenfield empty repo architects a stack first.

Then, per piece of work:

1. **Clarify the need**, when it is fuzzy. Make the requirement clear before any code. Skip it when the need is already sharp.
2. **Track the work** as a scoped item, small enough to finish and easy to follow.
3. **Plan it**: a technical plan, challenged until it is trustworthy.
4. **Build it** against the plan, in small validated steps with atomic commits. Committing happens here, as the work lands. Isolating the work in its own branch is a technical detail of this step, not a stage.
5. **Review it**: review the code and the behavior before it leaves the branch.
6. **Ship it**: open a standardized pull request, and release once it merges.

**Why this order.** Each step removes a guess from the next: clarify so you build the right thing, scope so it stays small, plan so the build does not thrash, review before you ship. The order is a default, and the user always picks.

## Where the project sits, and what to suggest

Read a few plain facts (action 01), then suggest the earliest unmet step. The suggestion is a hint, never a verdict.

This table places by disk facts only. A stage is **also** met when the session ledger marks it done or skipped this session, so `02-orient` excludes those before picking the earliest unmet step (it owns that definition; this table does not repeat it).

| What the project looks like                                  | Suggest        |
| ----------------------------------------------------------- | -------------- |
| Empty repo, nothing built yet                                | Context (architect a stack first) |
| Has code or files, but no project memory set up              | Context (set up the memory bank) |
| Memory set up, only a rough idea so far                      | Clarify the need |
| The need is clear, nothing tracks it yet                     | Track the work |
| Work is tracked, no plan yet                                 | Plan           |
| A plan is ready, no code against it                          | Build          |
| Code in progress, nothing reviewed                           | Build, or Review if it looks done |
| The build looks done                                         | Review           |
| An open pull request                                        | Ship (carry it through, release on merge) |

Having code never proves the build is finished, so onboard always lets the user pick the step rather than declaring one done.

## Beyond the steps, by discovery

The steps are the spine, and they never name a specific skill. Onboard reads the installed skills (action 01) and fills each step with whatever fits.

Most setups also have skills that are not a step but a tool for when the work needs one: fixing a bug, cleaning up code, finding technical debt, adding tests, capturing a lesson, drawing a diagram. Onboard does **not** hardcode these. It reads every installed skill, places the ones that fit a step, and surfaces the rest grouped by what their own description says they do. A skill added to any plugin later shows up on its own, with no change to this file. This file describes the flow, never the catalogue of skills.

## Resolving a step to an installed skill

1. Take the installed AIDD skills that action 01 listed, each with its description.
2. Match what the step achieves against the descriptions.
3. One match: suggest that skill.
4. No match: it is a gap. Say the step needs an AIDD plugin that is not installed, named by what it does only. Never invent a skill id or a plugin id.
5. Several matches: ask the user which one, in plain terms, before continuing.

Context always resolves, since onboard ships in the plugin that provides it. A later step whose plugin is not installed is a gap. Say once that those steps unlock when their plugins are added, named by what they do.
