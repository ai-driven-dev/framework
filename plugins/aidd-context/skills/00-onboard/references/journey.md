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
| An open pull request, nothing reviewed                      | Review, then Ship (carry it through, release on merge) |

Place at the earliest stage still unmet, reading the table top-down. Stages are cumulative: a downstream artifact implies the upstream stages are met — a plan means the need is clarified and tracked, so a project with a plan places at Build, not Clarify. Build is the exception: having code never proves it is reviewed or shipped, so onboard hedges there (see `assets/menu.md`) and lets the user pick rather than declaring one done. Clarify and Track have no disk signal, so they are the place only when no downstream artifact exists, and never a loud default.

## Beyond the steps, by discovery

The steps are the spine, and they never name a specific skill. Onboard reads the installed skills (action 01) and fills each step with whatever fits.

Most setups also have skills that are a tool for when the work needs one, not a step: fixing a bug, cleaning up code, adding tests, drawing a diagram. Onboard does **not** hardcode these — it ranks the relevant ones by the project signals (the capability map in `signals.md`) and resolves each to an installed skill. A skill added to any plugin later shows up on its own. This file describes the flow, never the catalogue of skills.

## Resolving a step to an installed skill

1. Take the installed AIDD skills that action 01 listed, each with its description.
2. Match what the step achieves against the descriptions.
3. One match: suggest that skill.
4. No match: it is a gap. Say the step needs an AIDD plugin that is not installed, named by what it does only. Never invent a skill id or a plugin id.
5. Several matches: ask the user which one, in plain terms, before continuing.

Context always resolves, since onboard ships in the plugin that provides it. A later step whose plugin is not installed is a gap. Say once that those steps unlock when their plugins are added, named by what they do.
