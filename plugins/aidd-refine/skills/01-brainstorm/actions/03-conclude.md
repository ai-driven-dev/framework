# 03 - Conclude

Produce the approved refined idea.

## Input

The conversation so far.

## Process

1. Fill the [discovery brief](../assets/discovery-brief.md).
2. Show it and ask to approve, correct, or explore more.
3. On a correction, revise it and show it again.
4. To explore more, go to explore.
5. On approval, offer where to keep it, per [persistence](../references/persistence.md).
6. When the user chooses a file, write it, then run `scripts/validate-brainstorm.cjs`, next to the loaded `SKILL.md`, on it, fix each finding and validate again, and after 3 passes stop and show what is left.

## Output

The approved brief.

## Rules

- Write the brief's bullets as facts about the idea, not as a list of categories.
- Write nothing unless the user chooses it.
