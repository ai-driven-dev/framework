# Review report

Where a review lands, what it reviews, and how a round joins it.

## The file

| Question | Answer |
| --- | --- |
| What | one `review.md`, appended to, never rewritten |
| Where | the reviewed work's feature folder, `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`, beside `plan.md` |
| When the work has no folder | resolve one from the change |
| Form | [review-template.md](../assets/review-template.md), in the shape [review-validator.yml](../assets/review-validator.yml) declares |

## The diff

| Question | Answer |
| --- | --- |
| Range | `<base>...HEAD` plus the working tree, tracked and untracked |
| Base | from the arguments, else the branch's pull request target, else the repository default branch |
| Left out | the feature folder's own `review.md` |

## A round

| Rule | Why |
| --- | --- |
| Append a round, derived from the plan and the current diff alone | a round states what this diff shows, and nothing it inherited |
| Count the `## Round` headings, never read their bodies | an earlier round's boxes describe a diff that no longer exists, and copying one is the defect |
