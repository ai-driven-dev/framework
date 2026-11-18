# Review plan

Run `scripts/prepare-review.cjs` to turn the snapshot and the classifications into the operations to apply.

```sh
node "$planner" --input "$review_json"
```

- `$planner`: the absolute path of `scripts/prepare-review.cjs`, next to the loaded `SKILL.md`.
- `$review_json`: a temporary file outside the project, following `review-input.schema.json`.
- Result: JSON on stdout, following `review-output.schema.json`.
