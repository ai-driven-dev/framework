# Placement

## Granularity

| Granularity | Slots | Use when |
| --- | --- | --- |
| month | the three months of the quarter | the team commits to a month |
| horizon | `now`, `next`, `later` inside the quarter | order is known, dates are not |

The user picks one per roadmap. `later` stays inside the quarter; beyond it is out of scope.

## Commitment

| Level | Meaning |
| --- | --- |
| `committed` | the team agreed to deliver it this quarter |
| `planned` | intended, not yet agreed by the team |
| `exploring` | under discovery; delivery is not promised |

A `proposal` trace does not block a level, and stays visible beside it.

## Order signals

| Signal | Effect |
| --- | --- |
| required predecessor | placed no later than its dependent |
| fixed external date a source states | placed no later than that date |
| settled decision | follows the decision record |
| user priority | decides between items no other signal orders |
| unsupported value or urgency | no weight |

Never manufacture a score. Propose a relative order with the signal behind each position.
