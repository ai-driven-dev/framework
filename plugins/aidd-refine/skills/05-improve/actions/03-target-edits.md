# 03 - Target edits

Map minimal edits and render the report.

## Input

The timing, usage, recommendations, and scope index tables.

## Output

An HTML report in a temporary directory with local `report.css` and `report.js`, plus its path and a next-intent request.

## Process

1. **Target.** Consolidate the provided recommendations by source into `File | + Added | − Removed or clarified`; use `No recommended file | — | —` when empty. Never resolve, judge, or apply sources here.
2. **Render.** Fill [the report template](../assets/report-template.html) from the provided data; remove its sample and copy its local CSS and JavaScript into the allowed unique temporary directory.
   - Escape injected values; allow only template markup and local assets. Localize the HTML `lang`, visible text, and dynamic `data-label-*` text to the user's language.
   - Put findings first with diagnostic/type tags, filters, accept controls, the target table, and an editable global prompt. Copy each recommendation's short target/action prompt into `data-prompt` without redrafting it.
   - Show source paths and minimal edits. Collapse raw evidence, secondary metrics, timing, coverage, source records, and limitations; keep the run ID in source records and avoid repeated metadata.
3. **Return.** Return its path. Ask the user, in their language, which small general change in intent to apply next run for cumulative, measurable improvement.
