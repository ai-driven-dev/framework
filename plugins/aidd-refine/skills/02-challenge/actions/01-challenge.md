# 01 - Challenge

Attack the work and report what breaks its aim, so the caller knows whether it holds.

## Input

- The work: an answer, files, a plan, a doc, a decision or a commit range.
- What it was asked to do: a plan, a spec or a request, else the user's stated intent.
- Optional techniques from [techniques.md](../references/techniques.md), else those that apply to the work.
- Optional task folder.

## Process

1. State the aim the work serves, in its strongest reading.
2. Run the work when it can run, and keep each command with its output as evidence.
3. Apply each selected technique of `techniques.md`, in its table order, to the work and to what it was asked to do.
4. Classify each finding with the first question of [decision.md](../references/decision.md) that answers yes.
5. Keep at most three items in To decide and three in Suggestions, those that matter most to the aim.
6. Fill [report-template.md](../assets/report-template.md).
7. Write it to `challenge.md` under a `# Round <n>` heading, after any earlier round, in the first folder that exists:
   - the task folder named;
   - the folder of the plan or spec the work follows;
   - a new `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`, its slug naming the work.
8. Read `challenge.md` back, then emit the filled report and its path on one line, with nothing else.

## Output

The filled report, emitted and kept in `challenge.md`.

## Rules

- Attack the work as an adversary would, never as its author.
- Report only what changes a decision, and nothing found is a valid answer.
- Keep the template's headings and order, and write `- None` in an empty section.
- List under Holds only attacks the work survived, never a restated requirement.
