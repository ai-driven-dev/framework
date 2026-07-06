# 04 - Finalize

Consolidate the clarified idea, flag what stays open, and let the user choose where it lives.

## Input

The clarified idea and the conversation so far.

## Output

The approved refined idea with its flagged open assumptions and risks, a pointer to the fitting next step, and, when the user picks the file, a markdown file at `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/brainstorm.md`.

## Process

1. **Consolidate.** Write the refined idea as one coherent, intent-level description built from the bullets. No solution, no plan.
2. **Flag the open.** List the assumptions left unanswered and the risks to confirm at design time, so the next step knows them. Never present a guess as settled.
3. **Get approval.** Show the refined idea and the open list, and ask the user to confirm or correct. Wait for the answer.
4. **Offer to persist.** Once approved, name all three destinations as equals and act on the pick. Persist nothing without the user's choice.
   - **File.** Write to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/brainstorm.md`, where `<yyyy_mm_dd>` is today's date and `<slug>` is the idea in kebab-case (e.g. `aidd_docs/tasks/2026_03/2026_03_09_aidd-craft-plugin/brainstorm.md`). Reuse the feature folder if one exists for this idea, else create it. The path format is fixed.
   - **Ticket.** Open or append a ticket drawn from the memory and VCS context.
   - **Session.** Keep it in the conversation only, write nothing.
5. **Point to the next move.** After persisting, say in plain words what the refined idea is now ready for, planning it, specifying it, or building it, so the user's next request reaches the right tool on its own. Describe the move, never name a plugin or skill, and never run it.

## Test

- The output is a consolidated intent-level idea plus an explicit list of open assumptions and risks, approved by the user, and it names all three persist destinations and the fitting next move without a `plugin:skill` identifier.
- When the user picks the file, a file exists afterward at `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/brainstorm.md` and nowhere else.
