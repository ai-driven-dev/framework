---
name: milestones
description: Template for deliverable milestones with go/no-go criteria
argument-hint: N/A
---

# Milestones - [Feature Name]

> Jalons de livraison avec critères go/no-go.

## Overview

| # | Milestone | Priority | Complexity | Status |
|---|-----------|----------|------------|--------|
| M0 | [Setup + premier écran] | Must | S | ⬜ |
| M1 | [Happy path complet] | Must | M | ⬜ |
| M2 | [Gestion erreurs + edge cases] | Should | M | ⬜ |

**Légende**: ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

---

## M0: [Nom orienté valeur utilisateur]

### Objective

[Ce que l'utilisateur pourra faire à la fin de ce milestone]

### Deliverable

[Livrable concret et testable]

### Features Included

| # | Feature | Complexity |
|---|---------|------------|
| 1 | [Feature] | XS/S/M |

### Go/No-Go Criteria

- [ ] [Critère 1 observable]
- [ ] [Critère 2 observable]

---

## M1: [Nom orienté valeur utilisateur]

### Objective

[Ce que l'utilisateur pourra faire]

### Deliverable

[Livrable concret et testable]

### Features Included

| # | Feature | Complexity |
|---|---------|------------|
| 1 | [Feature] | XS/S/M |

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
- [ ] Chaque milestone = valeur utilisateur testable
- [ ] Aucune milestone > M
- [ ] Max 40% "Must Have"
