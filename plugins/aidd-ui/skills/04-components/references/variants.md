# Variants

A variant is another way to build one element.

It holds the record and the render.

## Set

- Name the set after the element, such as its id.
- A variant folder mirrors `aidd_docs/ui/`.
- It holds the record and the render, side by side.
- The render is the preview: no other file is needed.

## Axes

An axis is one choice in how the element is built.

- Take it from the element: its variants, states, density, keyboard driving.
- Keep the same states in every variant, so they compare.
- Use tokens only, never a literal.

## Feedback

- Read a comment against the state it names.
- Where ratings tie, prefer the one with fewer states to maintain.
