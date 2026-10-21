# 03 - Target edits

Render the evidence and recommended edits.

## Input

Transcript, measurements, and recommended edits.

## Output

HTML report with local CSS/JS, its path, and a next-intent question.

## Process

1. **Render.** Fill [the report template](../assets/report-template.html) with the input and copy `report.css` and `report.js` alongside it.
2. **Return.** Share the HTML path and ask which small general intent change to try next run.

## Rules

- Replace the fictional example; escape inserted text.
- Localize the UI, not source excerpts.
