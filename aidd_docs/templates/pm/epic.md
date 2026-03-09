---
name: epic
description: Template for structuring an epic with its user stories, estimation and scope tier
argument-hint: N/A
---

# Epic: [Epic Name]

> [1-2 phrases décrivant le périmètre fonctionnel et la valeur utilisateur de cette epic.]

## Scope Tier

**MVP** / Next Release / Never

## Justification NSM

[En quoi cette epic contribue-t-elle à la North Star Metric ? Si elle ne contribue pas directement, pourquoi est-elle dans le MVP ?]

## User Stories

| ID | User Story | Points | Priorité | Status |
|---|---|---|---|---|
| US-001 | En tant que [persona], je veux [action] afin de [bénéfice] | [1-8] | Must | ⬜ |
| US-002 | En tant que [persona], je veux [action] afin de [bénéfice] | [1-8] | Must | ⬜ |
| US-003 | En tant que [persona], je veux [action] afin de [bénéfice] | [1-8] | Should | ⬜ |

**Légende** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Estimation totale

| Métrique | Valeur |
|---|---|
| **Stories** | X |
| **Points totaux** | XX |
| **Sprints estimés** | X (vélocité estimée : XX pts/sprint) |

## Critères d'acceptation (niveau epic)

- [ ] [Critère 1 : ce qui doit être vrai quand toutes les stories sont terminées]
- [ ] [Critère 2 : validation métier globale]

## Dépendances

| Dépendance | Type | Bloquant ? |
|---|---|---|
| [Epic/Story/Service] | Technique / Équipe / Externe | Oui / Non |

## Spikes associés

| Spike | Objectif | Time-box | Status |
|---|---|---|---|
| [Spike name] | [Question à résoudre] | [1-2 jours] | ⬜ |

---

## Validation

- [ ] Justification NSM documentée
- [ ] Toutes les stories respectent INVEST
- [ ] Acceptance criteria Gherkin pour chaque story
- [ ] Estimation totale < 13 points par story
- [ ] Dépendances identifiées et plan de mitigation
