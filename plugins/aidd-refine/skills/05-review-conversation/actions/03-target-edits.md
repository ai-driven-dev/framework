# 03 - Target edits

Produce a concise HTML report and a selectable execution prompt.

## Input

Transcripts, measurements and findings with any verified edits.

## Process

1. Fill the [report template](../assets/report-template.html) and copy [report.css](../assets/report.css) and [report.js](../assets/report.js) alongside it.
   - Replace fictional content and remove authoring scaffolds.
   - Link the exact analyzed transcript path in the heading when available; otherwise show its source and identifier. Retain all user messages in chronological order in normal weight. Messages with calls have collapsed two-line previews; messages without calls are displayed directly without a dropdown. Every message shows its response duration and call count, including zero; label unavailable durations instead of estimating. Put recorded calls and their durations inside. Keep full transcripts in private sidecars.
   - Lead with the conversation’s actual outcome, source coverage and useful measurements. Separate observed results from proposed file changes; never present a completed result as a recommendation.
2. Add acceptance controls only to verified textual edits supplied by recommend.
   - Number findings and show three columns: the exact message or tool call involved, the problem, and the addressed solution. At the top show only a direct link to the full affected file path, without a label or repeated path. In the solution column, show only exact removed (−) and added (+) lines with their colored backgrounds, without Git headers or unchanged context. For more than five changed lines, show the first five and offer a dialog with all removed lines on the left and added lines on the right; omit additions for a pure deletion.
   - Present a recommendation only when it has a verified file edit and an exact Git-style diff. Keep other findings in an observations section without invented patches or acceptance controls.
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
