# Destinations

Every destination starts from the approved learning packet.

| Destination | Use when | Apply |
| ----------- | -------- | ----- |
| memory | durable project fact, convention, or gotcha | write the packet into the matching memory entry |
| ADR | explicit choice with context and consequences | write the packet to `aidd_docs/memory/internal/decisions/<slug>.md` through [ADR template](../assets/adr-template.md) |
| rule | enforceable coding or agent behavior | send the packet to rule-generate |
| skill | reusable workflow worth a dedicated skill | send the packet to skill-generate |

Rules:

- If the project memory bank is missing, say what is missing and ask before handing off to project-memory.
- If the destination structure is unclear, ask. Do not invent a new taxonomy.
- Replace superseded entries. Do not add contradictions.
- For ADR supersession, link both decision records.
- Prefer the narrowest destination that can own the lesson.
- The user may choose another destination after seeing the recommendation.
- Learn writes memory and ADRs. Learn hands off rules and skills.
