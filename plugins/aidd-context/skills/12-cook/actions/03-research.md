# 03 - Research alternatives

Refine the target recipe with a checklist, scout for the highest-value insights, verify each one exists, and propose them as sorted lists.

## Input

The recipe or topic to modernize. If a recipe, its `recipes/<slug>.md` holds the current approach and coverage.

## Output

Three parts, then a recommendation:

1. An alternatives table `| Alternative | What it is | Pros | Cons | Official link |`, sorted by value.
2. A coverage-gaps list: important sub-topics the recipe omits, each with why it matters.
3. A counter-intuitive wins list: surprising tips, each with the result it produces.

Every presented item is confirmed to exist, with its latest state and official link. Ephemeral: nothing is written under `recipes/`.

## Process

1. **Refine.** Fill the goal checklist with the user until the target is precise: outcome, level, scope, grouping. Read `recipes/<slug>.md` first when the recipe exists. Run `list` when it is unnamed.

```md
@assets/research-goal-checklist.md
```

2. **Fan out.** Spawn one agent per angle in the playbook via the `Task` tool. Each applies the playbook criteria (freshness, community signal, tips), pushes for the most insights it can, and includes counter-intuitive ones with evidence. Each returns candidates with sources.

```md
@references/research-playbook.md
```

3. **Curate.** Dedupe the candidates. Drop anything that neither beats nor extends the recipe. Sort each bucket by value. Clear the research checklist: gaps filled, unknowns surfaced, claims corroborated.

```md
@assets/research-checklist.md
```

4. **Verify.** Spawn one agent per surviving candidate via the `Task` tool to confirm it exists, capture its official link, and record its latest state (version or date). Drop any candidate that cannot be confirmed against an official source.
5. **Present.** Render the alternatives table, the coverage-gaps list, and the counter-intuitive wins list, each item carrying its official link, then state a recommendation and why.
6. **Hand off.** If the user picks insights to keep, route to `upsert` to fold them into the recipe.

## Test

- The output has an alternatives table with pros and cons, a coverage-gaps list, and a counter-intuitive wins list, plus an explicit recommendation, and nothing is written to disk.
- Every presented item carries an official link and was confirmed to exist; unverifiable candidates are dropped.
- The research checklist clears (gaps filled, unknowns surfaced, claims confirmed) before any hand-off to `upsert`.
