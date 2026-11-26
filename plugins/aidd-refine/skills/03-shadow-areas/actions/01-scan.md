# 01 - Scan

Find what the source leaves unsaid that would change what gets built or tested.

## Input

A text file inside the working directory.

## Process

1. Check the source.
   - Not a file, outside the working directory, empty, or a shadow report: answer why and stop.
2. Find each fact the source leaves a builder to guess, with [lenses.md](../references/lenses.md) as hints, never as a checklist, and keep it as a gap with the passages it comes from.
3. Compare every two statements on the same actor, data or bound, and keep each pair that cannot both hold as a gap quoting both.
4. Write the two readings a builder could take of each gap, and keep it only when both are plausible and build different things.
5. Merge the gaps that ask the same thing, whatever their category.
6. Set each gap's category with [categories.md](../references/categories.md).
7. Go to [report](02-report.md).

## Output

The gaps, each with its category, question and quotes.

## Rules

- Write each gap as one question with one ask, in the source's language, naming the exact role, field, term or condition it lacks.
- Split a question that joins two asks into two gaps.
- Ask what the source must decide, never how to build it.
- Quote each passage verbatim, as the source writes it.
- Keep no gap rather than a weak one, and no gap found is a valid result.
