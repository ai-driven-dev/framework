# 01 - PRD

Parse the feature input, draft a structured PRD per the template, validate with the user, then save the file under `aidd_docs/tasks/`.

## Inputs

```yaml
feature_description: <free text>   # required
user_stories: [<id or text>]       # optional; existing stories to anchor the PRD
```

## Outputs

```yaml
prd_path: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-prd.md
feature_name: <kebab-case slug>
sections_present:
  - overview
  - problem-statement
  - goals
  - non-goals
  - user-stories
  - acceptance-criteria
  - dependencies
  - open-questions
```

## Process

1. **Parse input**. Extract feature scope, goals, and constraints from `feature_description` (and `user_stories` when provided).
2. **Draft**. Fill `assets/prd-template.md` with all 8 sections: overview, problem statement, goals, non-goals, user stories, acceptance criteria, dependencies, open questions.
3. **Validate**. Show the full draft to the user. Wait for explicit approval. Apply revisions and re-show on each iteration.
4. **Save**. Write the approved PRD to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-prd.md`. Create the month directory when missing.
5. **Return** the structured Outputs block.

## Test

- **File saved**: `prd_path` exists on disk after the action completes.
- **All sections**: the file contains the 8 required headings listed in `sections_present`.
- **No implementation**: the file has no `## Implementation` heading and no source code blocks describing how to build the feature.
