# 03 - Target edits

Map minimal edits and render the report.

## Input

The timing, usage, and recommendations tables.

## Output

An HTML report in a temporary directory with local `report.css` and `report.js`, plus its path and the next-intent question.

## Process

1. **Target.** Map file recommendations to real paths; omit behavior-only rows. Build `Fichier | + Ajout | − Retrait ou clarification`, consolidate targets, and show `Aucun fichier recommandé | — | —` when empty.
2. **Render.** Fill [the report template](../assets/report-template.html) with measured values and grounded findings; copy its local CSS and JavaScript.
   - Remove samples. Escape every injected value; allow only template markup and local assets.
   - Keep `data-prompt` and editable execution instructions as short as possible without losing targets or actions.
   - Write only to the allowed unique temporary directory.
3. **Return.** Provide its path and end exactly: `Quel changement d’intention général, même minime, appliquons-nous au prochain run pour rendre notre amélioration cumulative et mesurable ?`

## Test

| Case | Pass |
| --- | --- |
| Edit table | prior file targets only; consolidated or empty row |
| Report | no samples; unavailable values named; injected evidence inert |
| Assets | HTML, CSS, and JavaScript resolve locally only |
| Close | path returned; exact final question |
