# 03 - Target edits

Map recommendations to minimal edits and render the report.

## Input

The timing, usage, and recommendations tables.

## Output

An HTML report in a temporary directory with local `report.css` and `report.js`, plus its path and the next-intent question.

## Process

1. **Target.** Map each file-targeted recommendation to a real project path.
   - Omit behavior-only recommendations from this table.
2. **Summarize.** Build a `Fichier | + Ajout | − Retrait ou clarification` table.
   - Consolidate repeated targets and render each diagnostic's smallest change.
   - Render one `Aucun fichier recommandé | — | —` row when no recommendation needs a file edit.
3. **Render.** Fill [the report template](../assets/report-template.html) with only measured values and grounded findings, then copy its local CSS and JavaScript beside it.
   - Remove every sample value and sample finding from the produced report.
   - HTML-escape every injected value; allow only template-owned markup and local asset references.
   - Write only to a unique temporary directory, never the project.
4. **Return.** Provide the report path and end with this exact question: `Quel changement d’intention général, même minime, appliquons-nous au prochain run pour rendre notre amélioration cumulative et mesurable ?`

## Test

| Case | Pass |
| --- | --- |
| A file is shown | it is the target of an earlier recommendation |
| No file needs editing | the empty-table row is shown |
| The report is rendered | its HTML, CSS, and JavaScript resolve locally with no network dependency |
| Conversation evidence is rendered | it is escaped as text and cannot create markup, scripts, or URLs |
| A value is unavailable | the report says `unavailable` instead of showing sample data |
| The run closes | the returned chat response ends with the exact next-intent question |
