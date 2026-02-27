---
name: milestones
description: Template for deliverable milestones with go/no-go criteria
argument-hint: N/A
---

# Milestones - [Feature Name]

> Jalons de livraison avec critères go/no-go.

## Overview

| # | Milestone | Epics incluses | Points | Sprints estimés | Status |
|---|-----------|---------------|--------|----------------|--------|
| M0 | [Setup + premier écran] | — | [X] | 1 | ⬜ |
| M1 | [Happy path complet] | E1, E2 | [X] | [X] | ⬜ |
| M2 | [Gestion erreurs + edge cases] | E3 | [X] | [X] | ⬜ |

**Légende** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Vélocité et capacité

| Métrique | Valeur |
|---|---|
| **Vélocité estimée** | [XX] pts/sprint |
| **Taille de sprint** | [2 semaines] |
| **Capacité équipe** | [X] développeurs |
| **Buffer contingence** | [20-30]% |
| **Points totaux (toutes epics)** | [XX] pts |
| **Sprints estimés (avec buffer)** | [X] sprints |

> Pour une équipe nouvelle, estimer la vélocité à 60-70% de la capacité théorique pour les 2 premiers sprints.

---

## M0: [Nom orienté valeur utilisateur]

### Objective

[Ce que l'utilisateur pourra faire à la fin de ce milestone]

### Deliverable

[Livrable concret et testable]

### Epics & Stories incluses

| Epic | Stories | Points |
|---|---|---|
| [Epic name] | US-001, US-002 | [X] |

### Go/No-Go Criteria

- [ ] [Critère 1 observable]
- [ ] [Critère 2 observable]

---

## M1: [Nom orienté valeur utilisateur]

### Objective

[Ce que l'utilisateur pourra faire]

### Deliverable

[Livrable concret et testable]

### Epics & Stories incluses

| Epic | Stories | Points |
|---|---|---|
| [Epic name] | US-003, US-004 | [X] |

### Go/No-Go Criteria

- [ ] [Critère 1 observable]
- [ ] [Critère 2 observable]

### Dependencies

- M0 complété

---

## Complexity Guide

| Size | Description |
|------|-------------|
| **XS** | Trivial, < 1h |
| **S** | Small, 1-4h |
| **M** | Medium, 1-2 days |
| **L** | Large → SPLIT |
| **XL** | Epic → SPLIT |

---

## Validation

- [ ] 3-6 milestones maximum
- [ ] Chaque milestone = valeur utilisateur testable et démontrable
- [ ] Chaque milestone rattachée à des epics avec points estimés
- [ ] Vélocité estimée et sprints calculés
- [ ] Buffer de contingence intégré (20-30%)
- [ ] Aucune milestone > M en complexité
- [ ] Max 40% "Must Have"
