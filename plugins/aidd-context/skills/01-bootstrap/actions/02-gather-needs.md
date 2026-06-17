# 02 - Gather needs

Ask the user the **technical** questions bootstrap needs. Product facts (name, users, features) come from the PRD - never re-ask them.

## Inputs

- The PRD (product context, from `01-check-prd`).
- `@../references/checklist.md` - the question checklist.

## Process

1. Read the PRD; pre-fill every checklist item it already answers (the product block).
2. Ask only the remaining **technical** questions - constraints (real-time, multi-tenant, data sensitivity, volume, performance, SEO, offline) and team / hosting preferences. One block per message, batched.
3. Capture the technical **building blocks** the app needs (data, plus any of auth, email, storage, background jobs, CRON, payments, logging).
4. Surface conflicts (e.g. budget vs hosting vs load) and force a re-answer.
5. Print the gathered needs + building blocks; wait for the user's "go".

## Test

- [ ] Product facts taken from the PRD (not re-asked); technical constraints + building blocks captured; user confirmed "go".
