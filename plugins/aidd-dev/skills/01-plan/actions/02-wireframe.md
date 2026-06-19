# 02 - Wireframe

Sketch a low-fidelity ASCII wireframe of a screen, to fix its layout before the plan. Frontend only, skip it when the feature has no UI.

## Input

The screen or feature to sketch, from the gathered source.

## Output

A low-fidelity ASCII wireframe of each screen, its regions and key elements in place, with a numbered note per region. Structure only, no behavior, no styling, no final copy.

## Process

1. **Pick the screens.** List the screen or screens the feature needs. Ask the user which one when it is ambiguous. Skip the action entirely when there is no UI.
2. **Block the layout.** Draw each screen as one box-drawing wireframe with `┌ ─ ┐ │ └ ┘`. Place the regions (header, nav, main, aside, footer) and the key elements (lists, forms, cards, buttons, inputs) where they sit. Number each region. Low fidelity, no colors, no final copy.
3. **Annotate.** Under the sketch, one line per numbered region on what it holds and why.
4. **Confirm.** Show the wireframe and ask the user to confirm the layout or adjust it. Wait for the answer. A confirmed layout feeds the plan.

## Example

```
┌─────────────────────────────────────┐
│ (1) Header: logo · search · account  │
├──────────┬──────────────────────────┤
│ (2) Nav  │ (3) Results list          │
│  filters │  ┌──────────────────────┐ │
│  by type │  │ (4) Result card       │ │
│          │  └──────────────────────┘ │
└──────────┴──────────────────────────┘
```

1. Header: brand, global search, account menu.
2. Nav: filters that narrow the list.
3. Results: the matched items, paginated.
4. Card: one result, title and summary.

## Test

- The output is a box-drawing wireframe of each screen with numbered regions and a one-line note each, carries no behavior, styling, or final copy, and waits for the user.
