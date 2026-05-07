# 02 - Ask Probing Questions

Generate questions to challenge assumptions, edge cases, and missing context.

## Inputs

- `captured_request` : original bullet points request.

## Outputs

List of 3-5 probing questions.

```markdown
- Question 1?
- Question 2?
```

## Depends on

- `01-capture-request`

## Process

1. Analyze `captured_request` for gaps (assumptions, edges, context).
2. Generate targeted questions using `assets/question-templates.md`.
3. Output questions for user response.

## Test

- Questions address potential ambiguities in the request.