# 03 - Target edits

Map minimal edits and render the report.

## Input

The timing, usage, recommendations, and scope index tables.

## Output

An HTML report in a temporary directory with local `report.css` and `report.js`, plus its path and a next-intent request.

## Process

1. **Target.** Map every recommendation to its maintained source path. Build `Fichier | + Ajout | − Retrait ou clarification`, consolidate targets, and show `Aucun fichier recommandé | — | —` when empty. Recommend only; never apply.
2. **Render.** Fill [the report template](../assets/report-template.html) with measured values and grounded findings; copy its local CSS and JavaScript.
   - Remove samples. Escape every injected value; allow only template markup and local assets.
   - Put findings first. Preserve diagnostic/type tags, collapsible filters, accept controls, target table, and prompt.
   - Show each source path and minimal edit. Keep raw evidence, secondary metrics, timing, coverage, source records, and limitations collapsed.
   - Remove repeated metadata, focus/action tags, score labels, verbose help, and redundant run metadata; put the run ID in collapsed source records.
   - Keep `data-prompt` and editable execution instructions as short as possible without losing targets or actions.
   - Write only to the allowed unique temporary directory.
3. **Return.** Return its path. Ask the user, in their language, which small general change in intent to apply next run for cumulative, measurable improvement.

## Test

| Case | Pass |
| --- | --- |
| Edit table | every actionable finding has a maintained source row; consolidated or empty |
| Report | no samples; unavailable values and scope coverage named; injected evidence inert |
| Assets | HTML, CSS, and JavaScript resolve locally only |
| Findings | exact source edit and accept control; evidence and limitations collapse |
| Close | path returned; next intent requested in the user's language |
