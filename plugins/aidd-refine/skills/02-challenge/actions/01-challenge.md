# 01 - Challenge

Attack the work and report what breaks its aim, so the caller knows whether it holds.

## Input

- The work: an answer, files, a plan, a doc, a decision or a commit range.
- What it was asked to do: a plan, a spec or a request, else the user's stated intent.
- Optional techniques from [techniques.md](../references/techniques.md), all of them when none is named.

## Process

1. State the aim the work serves, in its strongest reading.
2. Run the work when it can run, and keep each command with its output as evidence.
3. Apply each selected technique of `techniques.md`, in its table order, to the work and to what it was asked to do.
   - Techniques named: apply only those.
4. Classify each finding with the first question of the `techniques.md` decision that answers yes.
5. Keep at most three items in To decide and three in Suggestions, those that matter most to the aim.
6. Fill [report-template.md](../assets/report-template.md) and emit it, with nothing before or after it.

## Output

The filled report: its aim, deal breakers, what to decide, suggestions and the attacks the work survived.

## Rules

- Give every finding a concrete scenario and the evidence that makes it real.
- Keep the template's headings and order, and write `- None` in an empty section.
- List under Holds only attacks the work survived, never a restated requirement.
