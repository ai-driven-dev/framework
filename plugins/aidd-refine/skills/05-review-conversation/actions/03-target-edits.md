# 03 - Target edits

Render the evidence and recommended edits.

## Input

Transcript, measurements, and recommended edits.

## Process

1. Fill the [report template](../assets/report-template.html) with the input and copy `report.css` and `report.js` alongside it. Lead with the decision, source coverage and useful measurements, then the findings; keep a concise prompt/call chronology below them and the full transcripts in private sidecars rather than reprinting bulky results. Show unavailable measurements and causal limits explicitly.
2. Keep acceptance controls only on verified framework-text or delegation-brief edits. Other findings remain reported without edit; selecting a recommendation builds a prompt and never applies a change.
3. Check the rendered report at desktop and 360 px widths, and verify that selecting an edit updates the execution prompt without including host/project remedies. Share the HTML path and ask which small general intent change to try next run.

## Output

HTML report with local CSS/JS, its path, and a next-intent question.

## Rules

- Replace the fictional example; escape inserted text and attribute values. Keep the report local unless sharing its contents is authorized.
- Localize the UI, not source excerpts.
