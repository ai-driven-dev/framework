# Persistence

Write under `aidd_docs/product/decisions/<decision-slug>/`, the slug in kebab-case.

| File | Holds |
| --- | --- |
| `tracking-plan.md` | the approved plan |
| `ledger.md` | the evidence ledger, collection log, and exclusions |
| `dashboard.md` | the dashboard for one plan version |
| `memo.md` | the decision memo |
| `ledger.csv` | optional export of the ledger |

| Situation | Result |
| --- | --- |
| New decision | create the folder |
| Same decision, plan unchanged, new collection | overwrite ledger and dashboard; keep the memo until revised |
| Plan revised after approval | increment `version`; mark the previous dashboard and memo `stale` |
| Existing file edited by the user | preserve the edit; change only generated sections |
