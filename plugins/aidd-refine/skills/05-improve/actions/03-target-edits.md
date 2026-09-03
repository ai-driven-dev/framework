# 03 - Target edits

Map recommendations to minimal file edits and one next-intent question.

## Input

The `## Recommendations` table.

## Output

A `## Target edits` table with `Fichier | + Ajout | − Retrait ou clarification`, followed by the next-intent question.

## Process

1. **Target.** Map each file-targeted recommendation to a real project path.
   - Omit behavior-only recommendations from this table.
2. **Render.** Show the smallest addition and removal or clarification for each target file.
   - Render one `Aucun fichier recommandé | — | —` row when no recommendation needs a file edit.
3. **Ask.** End with this exact question: `Quel changement d’intention général, même minime, appliquons-nous au prochain run pour rendre notre amélioration cumulative et mesurable ?`

## Test

| Case | Pass |
| --- | --- |
| A file is shown | it is the target of an earlier recommendation |
| No file needs editing | the empty-table row is shown |
| The report closes | its final line is the exact next-intent question |
