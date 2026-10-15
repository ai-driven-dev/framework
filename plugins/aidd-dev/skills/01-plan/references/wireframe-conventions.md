# Wireframe conventions

A wireframe is a low-fidelity ASCII sketch of a screen. Structure only: no behavior, no styling, no final copy.

## Drawing

- One box per screen, drawn with `┌ ─ ┐ │ └ ┘`.
- Place the regions (header, nav, main, aside, footer) and the key elements (lists, forms, cards, buttons, inputs) where they sit.
- Number each region.
- Under the sketch, one line per number on what it holds and why.

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
