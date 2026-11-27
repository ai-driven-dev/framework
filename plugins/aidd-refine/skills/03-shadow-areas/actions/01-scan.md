# 01 - Scan

Find what the source leaves a builder to guess.

## Input

A text file inside the working directory.

## Process

1. Check the source.
   - Not a file, outside the working directory, empty, or a shadow report: answer why and stop.
2. List what a builder would have to guess, with [lenses.md](../references/lenses.md) as hints, each with the passages it comes from.
3. Add each two statements on the same subject that cannot both hold.
4. Keep a gap only when it has two plausible readings that build different things.
5. Merge the gaps that ask the same thing.
6. Set each gap's category with [categories.md](../references/categories.md).
7. Go to [report](02-report.md).

## Output

The gaps, each with its category, question and quotes.

## Rules

- Write each gap as one question, in the source's language, naming exactly what is missing.
- Split a question that asks two things.
- Ask what the source must decide, never how to build it.
- Quote the source verbatim.
- No gap beats a weak gap, and an empty report is valid.
