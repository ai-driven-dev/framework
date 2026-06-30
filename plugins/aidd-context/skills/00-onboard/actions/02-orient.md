# 02 - Orient

Tell the user, in plain language, where their project sits and the next step, then offer a project-adapted menu. Teach as you go.

## Input

The snapshot from `01-read-project` (signals + ledger + installed skills), held in context, not printed.

## Output

A short, plain briefing plus the menu rendered per `@../assets/menu.md`. No internal names, no raw labels, no snapshot reaches the user.

## Process

1. **Place.** Default = the earliest **unmet** stage in `@../references/journey.md`, where met = a disk fact **or** a ledger done/skip; a foundation stage is the loud default.
2. **Rank.** Add the stage-gated secondary tools the snapshot signals trigger in `@../references/signals.md`.
3. **Resolve.** Resolve each item to an installed skill, else name it a gap by function; never name a skill or plugin that is not installed.
4. **Brief.** Write the plain briefing: the one-line project, where it sits, the why; explain each AIDD term on first use.
5. **Assemble.** Render the menu per `@../assets/menu.md`; a foundation default is tagged `(recommended)` and stated skippable.
6. **Wait.** Offer the menu and wait for a number; free text re-renders it. Never auto-advance.
7. **Different step.** Show the `@../references/journey.md` stages, let the user pick one, and resolve it.
8. **Hand** the chosen item to `03-act`; acting on it belongs there.

## Test

- Plain language only: no internal note names, raw stage labels, or snapshot reach the user.
- The default is the earliest stage unmet by both disk and ledger; a foundation stage renders as the `(recommended)`, skippable first choice.
- Secondary tools are stage-gated per `signals.md`; the menu follows `@../assets/menu.md` (default + secondary ≤ ~5, footer never dropped).
- Every item resolves to an installed skill or a named gap; nothing uninstalled is named.
