# 05 - Render

Draw the approved arrangement as a diagram and a table, in a team view and a stakeholder view.

## Input

The approved arrangement and the confirmed frame.

## Output

Two drafts: the team roadmap per [roadmap template](../assets/roadmap-template.md), and the stakeholder view per [stakeholder template](../assets/stakeholder-template.md).

## Process

1. **Diagram.** Pick the chart per [views](../references/views.md), and generate it through the Mermaid diagram capability when one is installed, the approved arrangement standing as its confirmed plan.
   - None installed: generate it per [views](../references/views.md).
2. **Team.** Fill [roadmap template](../assets/roadmap-template.md) with the diagram and the full table.
3. **Stakeholder.** Fill [stakeholder template](../assets/stakeholder-template.md) per [audiences](../references/audiences.md).
4. **Show.** Present both drafts and ask for corrections.
   - A change of placement or commitment: return to `arrange`.

## Test

| Case | Pass |
| --- | --- |
| The run completes | `git status --porcelain` reads the same after as before |
| The diagram | it sits in a fenced `mermaid` block and parses in Mermaid 10.8.0 or newer |
| The diagram is read back | every bar or entry matches a table row; none is added |
| The team view | every row carries a trace or `proposal` |
| The stakeholder view | no ticket id, estimate, capacity, or excluded item appears |
| Either draft is read back | no `<` placeholder and no template comment survives |
