# Intensity levels

The `condense` action supports three intensity levels. Each row applies progressively more aggressive compression.

| Level     | What change                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **lite**  | No filler or hedging. Articles and full sentences are kept. Professional but tight.                                          |
| **full**  | Drop articles, fragments are acceptable, short synonyms.                                                                     |
| **ultra** | Abbreviate (DB, auth, config, req, res, fn, impl), strip conjunctions, arrows for causality (X to Y), one word when enough. |

## Side-by-side example

Question: "Why does a React component re-render?"

- **lite**: "Your component re-renders because you create a new object reference each render. Wrap it in `useMemo`."
- **full**: "New object ref each render. Inline object prop = new ref = re-render. Wrap in `useMemo`."
- **ultra**: "Inline obj prop to new ref to re-render. `useMemo`."
