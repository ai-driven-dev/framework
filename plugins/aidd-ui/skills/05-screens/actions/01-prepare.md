# 01 - Prepare

Settle which wireframes become screens.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md). If missing, stop and say so.
2. Read `aidd_docs/ui/`. Name the [case](../references/cases.md).
3. If `aidd_docs/ui/system.md` is missing, stop and say so.
4. Take the wireframes the request names, else each one no screen dresses.
   - If there is none, stop and say so.
5. For each, list the components it expects.
   - If one is missing from `components/`, stop and name it.
   - Never create it: the components are written elsewhere.
6. Take the task folder the user named, else ask.
   - It need not exist: only `history.md` rows cite it.
7. Read [propose](02-propose.md).

## Output

- The case and the engine.
- The wireframes to dress.
- The task folder.
