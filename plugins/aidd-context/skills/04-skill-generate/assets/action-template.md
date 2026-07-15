# <NN - Action title>

<One sentence: what this action does.>

## Input

<OPTIONAL. Free-form prose or bullets naming the values this action consumes. Omit this section when the action takes none. No frozen YAML/text data block.>

## Output

<MANDATORY. The concrete result, in prose: one line naming what is produced. Use a small table only when the output is genuinely tabular. No frozen YAML/text data block.>

## Process

1. **<Label>.** <Imperative step, short sentences. Sub-bullet for a branch, a condition, or a loop back.>
2. **<Label>.** <Next step.>

## Test

<One deterministic check: a command to run, a concrete check on the produced artifact, or an observable side-effect. State the pass condition plainly.>

<!--
Cite an include the action needs as its `@<path>` ALONE inside a fenced block, never inline in a sentence (R13). Name an include used only by this action with this action's slug prefix; cite a global include (used skill-wide) from SKILL.md instead of here.

```md
@references/<action-slug>-<file>.md
```
-->
