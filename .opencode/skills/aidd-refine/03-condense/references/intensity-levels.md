# Intensity levels

The `condense` action supports three intensity levels. Each row applies progressively more aggressive compression.

| Level     | What change                                                                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **lite**  | No filler or hedging. Articles and full sentences are kept. Professional but tight.                                                                                                                                       |
| **full**  | Drop articles, fragments are acceptable, short synonyms. Classic terse mode.                                                                                                                                              |
| **ultra** | Abbreviate prose words (DB, auth, config, req, res, fn, impl), strip conjunctions, arrows for causality (X to Y), one word when one word is enough. Code symbols, function names, API names, and error strings: never abbreviate. |

## Side-by-side examples

### Example 1: "Why does a React component re-render?"

- **lite**: "Your component re-renders because you create a new object reference each render. Wrap it in `useMemo`."
- **full**: "New object ref each render. Inline object prop = new ref = re-render. Wrap in `useMemo`."
- **ultra**: "Inline obj prop to new ref to re-render. `useMemo`."

### Example 2: "Explain database connection pooling."

- **lite**: "Connection pooling reuses open connections instead of creating new ones per request. It avoids repeated handshake overhead."
- **full**: "Pool reuse open DB connections. No new connection per request. Skip handshake overhead."
- **ultra**: "Pool = reuse DB conn. Skip handshake to fast under load."

### Example 3: "What is a debounce function?"

- **lite**: "Debounce delays a function call until input stops for a chosen interval. Used for search inputs and resize handlers."
- **full**: "Debounce delay call until input stop for chosen interval. Use for search inputs, resize handlers."
- **ultra**: "Debounce delay call until input stop. Use for search, resize."

## Auto-pause passages (always normal prose)

These passages render in normal English regardless of the active level. Resume terse mode after the passage is clear.

- **Security warnings**: full sentences explaining the risk and the safer alternative.
- **Irreversible action confirmations**: full sentences describing the consequence and any backup step.
- **Multi-step sequences** where dropped conjunctions or fragment order risks misread.
- **Clarifications**: if compression itself creates technical ambiguity, fall back for that bullet.
- **User confusion**: if the user repeats a question or asks "what do you mean", expand for that answer.

### Example: irreversible operation

> **Warning:** This permanently deletes all rows in the `users` table and cannot be undone.
> ```sql
> DROP TABLE users;
> ```
> Terse mode resumes. Verify backup exists first.
