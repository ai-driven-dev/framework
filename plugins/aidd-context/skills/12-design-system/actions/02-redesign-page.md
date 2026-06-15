# 02 - Redesign a page

An executable playbook: **you (the AI) invoke each Impeccable command yourself** - the user never types one. The user only answers questions and validates results between steps. Walk the steps in order as a todo; each step says what to invoke, what to ask, and when to move on. Impeccable writes the code; `DESIGN.md` stays the single source of truth.

## Inputs

- `page` (required) - the page to redesign: a route (`/pricing`), a source path (`src/pages/pricing.tsx`), or a dev-server URL. Prefer a source path; ports drift, paths do not. If missing, ask for it first.

## Outputs

- The page restyled by Impeccable against the canonical `DESIGN.md`.
- A `critique` snapshot trail (baseline → final) proving the improvement.
- `DESIGN.md` updated **only via `extract`** - never by hand.

## Process

### Step 1 - Check the ground

**Do:** verify `/impeccable` responds and `DESIGN.md` exists at the project root - and that it has a point of view.

- If Impeccable is absent: guide install (<https://impeccable.style>), then stop. Never emulate it.
- If `DESIGN.md` is absent: run action [01-create-design-system](01-create-design-system.md) first - redesigning without a system just produces new drift.
- If `DESIGN.md` is **generic**, fix it before redesigning - every command aligns the page to it, so a bland system caps the ceiling (polished garbage stays garbage). Generic means any of: no anti-references in `PRODUCT.md`, color strategy Restrained-by-default when the brief wants impact, mood sentence that says "modern/clean". Route to action 01 steps 1-2 (`init` / `document`) to re-found it, then come back.

### Step 2 - Measure: invoke `/impeccable critique <page>`

**Do:** invoke it now - it is the measurement, not an option. It scores Nielsen's 10 heuristics 0-4 (total /40; real interfaces land 20-32), persists a snapshot, and returns the P0/P1 backlog.

Critique's own flow ends by presenting findings and asking the user targeted questions (it STOPs and calls AskUserQuestion itself). **Let it** - don't summarize over it or re-ask.

### Step 3 - Complete the brief

**Do:** critique's questions cover what is broken; add only what they don't, in one AskUserQuestion:

1. Is the page wrong (structure, content order) or just ugly (style)? - this decides Step 4's route
2. Any direction already in mind? (bolder, calmer, simpler...)

Critique's answers + these two are the brief for everything below.

### Step 4 - Fix: invoke one command per weak axis

**Do:** route from the critique backlog + the user's answers, top severity first. Impeccable's own rule applies: a command is a suggestion the user confirms - name the command and the reason, get a yes, then invoke. One command, show the result, then the next. Skip sound axes.

**Fix defects** (convergent - removes what is broken):

| Symptom (critique + user)                   | Invoke                        |
| ------------------------------------------- | ----------------------------- |
| Score low across the board, many small P1s  | `/impeccable polish <page>` - it reads the critique snapshot as its backlog |
| Hierarchy flat, spacing off, crowded        | `/impeccable layout <page>`   |
| Type generic, sizes arbitrary, hard to read | `/impeccable typeset <page>`  |
| Gray, dull, monochrome                      | `/impeccable colorize <page>` |
| Loud, garish, overwhelming                  | `/impeccable quieter <page>`  |
| Cluttered, competing for attention          | `/impeccable distill <page>`  |
| Copy confusing, labels unclear              | `/impeccable clarify <page>`  |
| Breaks on mobile / other viewports          | `/impeccable adapt <page>`    |

**Add ambition** (divergent - the score won't flag these; only the user's "still ugly" does):

| Symptom (critique + user)                   | Invoke                          |
| ------------------------------------------- | ------------------------------- |
| Bland, safe, no personality                 | `/impeccable bolder <page>`     |
| Correct but forgettable, nothing memorable  | `/impeccable delight <page>`    |
| Static, lifeless                            | `/impeccable animate <page>`    |
| "Wow" is the brief, push past conventional  | `/impeccable overdrive <page>`  |

**Convergent vs divergent - the trap:** `critique`/`audit`/`polish` only remove defects. A page can score 30+/40 with zero P0 and still be boring; another polish loop will never fix that. When the score is fine but the user finds the page bland, take the divergent table - and check Step 1's `DESIGN.md` quality gate first, since a bland system caps every command.

**If the user said "the page is wrong" in Step 3:** invoke `/impeccable shape "<page> redesign"` instead - it runs its own discovery interview and produces a confirmed brief. Don't stack axis commands on a broken foundation.

Constraint: changes stay within `DESIGN.md` tokens - no new one-off colors, fonts, or spacing values.

### Step 5 - Show and ask: good direction?

**Do:** show the result (screenshot, or offer `/impeccable live` for in-browser variant picking if a dev server runs). Ask: keep, adjust, or revert?

- Adjust → back to Step 4 with the feedback.
- Keep → next weak axis, or Step 6 when the backlog is done.

### Step 6 - Verify: invoke the quality gates

**Do:** invoke in order, yourself:

1. `/impeccable polish <page>` - alignment, spacing, micro-details (skip if Step 4 already ran it)
2. `/impeccable audit <page>` - must report no P0 (a11y, contrast, responsive)
3. `/impeccable critique <page>` - score must beat the Step 2 baseline, no P0/P1 left

**If a gate fails:** back to Step 4 with the new backlog. Two stalled loops in a row → the problem is structural, go through `shape`.

### Step 7 - Fold back: keep the doc impeccable

**Do:** if the redesign produced repeated patterns or new token needs, invoke `/impeccable extract <page>` so they fold into `DESIGN.md`. Never edit `DESIGN.md` by hand, never create a competing design file (point, never copy).

**Then tell the user:** baseline → final score, what changed, what was folded back.

## Test

After running: the `critique` snapshot trail shows final score > baseline with zero P0, `audit` reports no P0, and `git diff DESIGN.md` is either empty or produced exclusively by `extract`/`document`. Real-execution on disk, never mocked.
