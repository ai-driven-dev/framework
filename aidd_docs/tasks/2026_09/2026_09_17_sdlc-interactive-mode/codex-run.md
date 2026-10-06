# Codex run — the interactive gates, with a human at them

The three gates were never executed. A headless run cannot answer them: it would
have to invent the approval the gate exists to collect. This run puts a person
there, under a second AI tool, so what is measured is the text and not Claude
Code's own habits.

## What is already in place

| Piece | Where |
| ----- | ----- |
| Working copy for the delivery | `../test-sdlc-891-codex`, branch `fix/cli-setup-user-scope-plugins`, cut from `origin/next` |
| The issue to deliver | #891, `fix(cli): setup --scope user --plugins throws an uncaught UserScopePluginModeError instead of rendering a validation error` |
| The orchestration Codex will read | the shared build, rebuilt from this branch |

The shared build was rebuilt with:

```shell
aidd setup --ai codex --source local \
  --path /Users/baptistelafourcade/orca/workspaces/framework/fix-sdlc-manual \
  --plugins aidd-context,aidd-orchestrator,aidd-dev,aidd-pm,aidd-refine,aidd-vcs --yes
```

Verified served, not just cached:

```
~/.config/aidd/cache/built/5.3.0/aidd-framework/codex/plugins/aidd-orchestrator/skills/01-sdlc/SKILL.md:10
The mode is `auto` unless the caller asks for `interactive`, named as the request's first whole word …
```

`03-check.md` there carries `would be routed a second time`, `02-deliver.md`
carries `when the plan calls for one, and none otherwise`, and `01-frame.md`
carries `A source is planning-ready when`. All three fixes are in what Codex will
read.

## Before you start

**The shared build is machine-wide.** Every project and every session on this
machine now resolves `aidd-*` from this branch instead of the published 5.3.0.
That is what makes the run meaningful, and it is also a change outside this
worktree. To put the published release back:

```shell
aidd setup --ai codex --source remote --yes
```

Codex also refuses to run a plugin's hooks until each is trusted. Approve the
prompt once in the interactive session, or the session leaves no run journal and
nothing says why.

## Run it

```shell
cd /Users/baptistelafourcade/orca/workspaces/framework/test-sdlc-891-codex
codex
```

`aidd-orchestrator` ships no commands, so Codex has no `/` entry for this skill —
it is picked up by description. Give it the request as a quoted string, so the
first-whole-word rule has something defined to read:

```
Use the aidd-orchestrator 01-sdlc skill. The request is exactly, between the quotes:
"interactive #891"
```

## What to watch

| Gate | Expected | A defect looks like |
| ---- | -------- | ------------------- |
| 1 | it presents the contract for #891 and waits | it starts planning without asking |
| between 1 and 2 | nothing asks you anything | a question about an implementation detail |
| 2 | it presents the plan and waits | the plan is written and executed in one move |
| between 2 and 3 | implement, assert, review and challenge run alone, repairs included | it asks you to confirm a repair |
| 3 | it presents the outcome and waits, before any pull request | a draft pull request exists before you approved |

Also worth one line each: refuse at gate 1 with a change to what is being built
and check the revision comes back to the same gate; approve at gate 2 and check
the plan is reused rather than rewritten.

## Known divergence from #910

The issue's own example of interactive intent is "run the SDLC interactively".
Under this text that is `auto`: the mode word must be the request's first whole
word. The keyword form was the decision taken while building it, so the issue is
what needs updating — but a Codex run typing the issue's phrasing will land in
`auto`, and that is the text behaving as specified, not a bug.

## Observed — run 1, Codex, issue #891

Mode decided from the text, three gates announced before any work. The zone read
only `01-frame.md` while Frame was current.

| Gate | What happened |
| ---- | ------------- |
| 1, contract | presented a five-point contract and stopped, naming the pause and what the approval releases |
| 2, plan | presented the revised plan, its confidence and what the approval releases, and stopped |
| between 2 and 3 | implementation started with no question asked |

Two things worth keeping:

- **A conditional approval is not covered.** At both gates the answer was "approved,
  with corrections". The router says an approval ships what was presented, which
  leaves no reading for an approval that changes it. Codex took the corrections and
  moved on, which is the useful behaviour; the text does not say it is the right one.
- **It corrected the reviewer on a verifiable fact.** Told to drop Kilo, it answered
  that Kilo exists in its checkout and gave the path. The reviewer was reading a
  branch cut before Kilo landed on `next`. Following the instruction would have
  dropped a shipped tool from the documentation.

## The clause that run produced

`An approval ships what was presented` had no reading for the answer the run
actually got twice, "approved, with corrections". Taken literally it made a
correction a refusal, which sends a one-line fix back through the zone and
presents the artifact again. Codex advanced instead, which is the useful
behaviour and not what the text said.

The sentence now reads `An approval ships what was presented, with any correction
it carries.` Three readers traced the three answers a pause can get:

| Answer | A, approved | B, approved with corrections | C, refused |
| ------ | ----------- | ---------------------------- | ---------- |
| 9-1 | ships as presented | ships corrected | routes to Frame, pauses again |
| 9-2 | ships as presented | ships corrected | routes to Frame, pauses again |
| 9-3 | ships as presented | ships corrected | routes to Deliver, pauses again |

No reader answered `UNDECIDABLE`, and each quoted the clause for A and B and the
routing sentence for C.

One reader of the three read a collision on B with `An artifact produced anew
pauses again`: a correction that cannot be applied as an edit makes the zone
produce the artifact again, and that sentence would pause for it. The other two
did not. One reading out of three is below the bar this work has used for
changing text — the defect it fixed was unanimous — so the sentence stays and the
reading is recorded here instead.
