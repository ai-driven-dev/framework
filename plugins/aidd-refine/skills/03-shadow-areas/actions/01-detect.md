# 01 - Detect

List the gaps the source leaves, each with a category, a severity, a probe and its snippet.

## Input

The source to scan: a file path or inline markdown text.

## Process

1. Check the source.
   - Outside the working directory, or already a shadow report: reject it and stop.
   - Empty: keep one blocker gap under `unstated assumption` asking what the artifact should contain, and go to step 5.
   - Not markdown: keep a warning that snippets may be imprecise, and continue.
2. Walk the categories of [categories.md](../references/categories.md) in their order, keeping one gap per distinct issue with the snippet it comes from.
3. Set each gap's severity with [severity-rubric.md](../references/severity-rubric.md).
4. Write each gap's probe per [probe-style.md](../references/probe-style.md).
5. Merge the gaps that share an identity.
6. Go to [diff](02-diff.md) when the source has a prior report, else to [render-report](03-render-report.md).

## Output

The gaps and warnings of this run.
