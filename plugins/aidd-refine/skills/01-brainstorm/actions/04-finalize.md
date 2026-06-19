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
4. **Point to the next move.** Say in plain words what the refined idea is now ready for, planning it, specifying it, or building it, so the user's next request reaches the right tool on its own. Describe the move, never name a plugin or skill, and never run it.
5. **Offer to persist.** Once approved, present all three destinations and act on the pick. Name all three, persist nothing without the user's choice.
   - **File.** Write the document to the feature folder as `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/brainstorm.md`, where `<yyyy_mm_dd>` is today's date and `<slug>` is the idea in kebab-case. Reuse the feature folder when one already exists for this idea, otherwise create it. The format is fixed, never another name.

     | Idea, saved on | File written |
     | --- | --- |
     | aidd-craft plugin, 2026-03-09 | `aidd_docs/tasks/2026_03/2026_03_09_aidd-craft-plugin/brainstorm.md` |
     | dark mode toggle, 2026-11-20 | `aidd_docs/tasks/2026_11/2026_11_20_dark-mode-toggle/brainstorm.md` |
   - **Ticket.** Open or append a ticket drawn from the memory and VCS context.
   - **Session.** Keep it in the conversation only, write nothing.

## Test

- The output is a consolidated intent-level idea plus an explicit list of open assumptions and risks, approved by the user, and it names all three persist destinations and the fitting next move without a `plugin:skill` identifier.
- When the user picks the file, a file exists afterward at `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/brainstorm.md` and nowhere else.
