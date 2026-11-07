# 02 - Write

Write the journeys, then the wireframes their steps lack.

## Input

The case, `<engine>`, the task folder, the persona and the agreed journeys.

## Process

1. Each journey: write `aidd_docs/ui/journeys/<id>.md` from the [journey](../assets/journey-template.md) template.
2. Each step naming no screen or wireframe yet: write `aidd_docs/ui/wireframes/<id>.md` and its render from the [wireframe](../assets/wireframe-template.md) and [render](../assets/wireframe-render-template.html) templates, per [wireframes](../references/wireframes.md); from the code, read its zones, states and components from the screen's code.
3. A wireframe changed: `node <engine> bump --task <task folder> --change "<one line>" <id>`.
4. Records this run created: `node <engine> bump --task <task folder> --created <id>…`.
5. Read [conclude](03-conclude.md).

## Output

The files written.
