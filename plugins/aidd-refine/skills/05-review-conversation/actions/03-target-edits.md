# 03 - Target edits

Produce a concise HTML report and a selectable execution prompt.

## Input

Transcripts, measurements and findings with any verified edits.

## Process

1. Fill the [report template](../assets/report-template.html) and copy [report.css](../assets/report.css) and [report.js](../assets/report.js) alongside it.
   - Replace fictional content and remove authoring scaffolds.
   - Lead with the decision, source coverage and useful measurements, then the findings.
   - Keep the prompt/call chronology concise and full transcripts in private sidecars.
2. Add acceptance controls only to verified textual edits supplied by recommend.
   - Selecting an edit builds a prompt without applying changes.
3. End with a two-column problem → solution table linked to the detailed evidence.
   - Use one short row per distinct supported problem.
   - For an unknown cause, give the next diagnostic step rather than an invented fix.
   - Omit the table when there are no findings.
4. Check the report in a real browser at desktop and 360 px widths, including selection, deselection, manual prompt edits and copying.
   - Confirm readable content, working evidence links and no horizontal document overflow.
   - Confirm the copied prompt includes only selected edits and manual text, excluding diagnostic remedies.
   - Fix a failed check and repeat it; report and stop on an unresolved failure.
   - If a check cannot run, share the report with that limitation and mark it unverified.
5. Share the HTML path once checks pass.
   - Ask a follow-up only when a useful decision remains.

## Output

HTML report with local CSS/JS, its path and verification status.

## Rules

- **Escaping:** escape inserted text and attribute values.
- **Sharing:** keep the report local unless sharing its contents is authorized.
- **Localization:** translate the UI while preserving source excerpts.
