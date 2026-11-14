# 04 - Conclude

Leave screens that validate, and tell the user what follows.

## Input

The screens kept.

## Process

1. Record in the history each screen kept, per [engine](../references/engine.md).
   - A screen sent back is raised, not recorded.
2. Validate per [engine](../references/engine.md).
3. Fix each error line under `aidd_docs/ui/` as its `=> fix` says.
4. Validate again per [engine](../references/engine.md), and repeat until only these remain:
   - errors the [engine](../references/engine.md) says are about the code
   - `warning` lines, which are not errors
5. Look at every screen the change reached per [look](../references/look.md), and fix it.
   - A change reaches each screen `bump` lists in `changed`.
   - Look on each platform the screen targets.
   - Skip those already looked at and unchanged since.
   - Hand back only when all are looked at.
6. Write the showcase per [engine](../references/engine.md), in the project memory's language.
7. Reply with:
   - the screens created, each with the wireframe it dresses
   - the screens you picked yourself
   - each screen left without `code`, and why
   - what the validation still prints
   - that no browser was found, if so
   - that the code is untouched
   - that each screen is `proposed` until its review
   - the single next step: give a verdict on each screen

## Output

The reply to the user.
