# 03 - Research alternatives

Refine the target recipe with a checklist, then scout for the highest-value insights and propose them as sorted lists.

## Input

The recipe or topic to modernize. If a recipe, its `recipes/<slug>.md` holds the current approach and coverage.

## Output

Three parts, then a recommendation:

1. An alternatives table `| Alternative | What it is | Pros | Cons | Source |`, sorted by value.
2. A coverage-gaps list: important sub-topics the recipe omits, each with why it matters.
3. A counter-intuitive wins list: surprising tips, each with the result it produces.

Ephemeral: nothing is written under `recipes/`.

## Process

1. **Refine.** Fill `@assets/refine-goal-checklist.md` with the user until the target is precise: outcome, level, scope, grouping. Read `recipes/<slug>.md` first when the recipe exists. Run `list` when it is unnamed.
2. **Fan out.** Spawn one agent per angle in `@references/research-playbook.md` via the `Task` tool. Each applies the playbook criteria (freshness, community signal, tips), pushes for the most insights it can, and includes counter-intuitive ones with evidence. Each returns candidates with sources.
3. **Curate.** Dedupe the candidates. Drop anything that neither beats nor extends the recipe. Sort each bucket by value. Clear `@assets/research-checklist.md`: gaps filled, unknowns surfaced, claims corroborated.
4. **Present.** Render the alternatives table, the coverage-gaps list, and the counter-intuitive wins list, then state a recommendation and why.
5. **Hand off.** If the user picks insights to keep, route to `upsert` to fold them into the recipe.

## Test

- The output has an alternatives table with pros and cons, a coverage-gaps list, and a counter-intuitive wins list, plus an explicit recommendation, and nothing is written to disk.
- The research checklist clears (gaps filled, unknowns surfaced, claims confirmed) before any hand-off to `upsert`.
