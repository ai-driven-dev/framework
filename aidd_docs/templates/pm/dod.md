---
name: definition-of-done
description: Project-level Definition of Done applied to all user stories
argument-hint: N/A
---

# Definition of Done

> Critères de qualité applicables à **toutes** les user stories du projet. Une story n'est "done" que si **tous** ces critères sont satisfaits.

## Critères standard

| # | Critère | Description | Vérifié par |
|---|---|---|---|
| 1 | **Acceptance criteria** | Tous les scénarios Gherkin de la story passent | PM / QA |
| 2 | **Code review** | Le code a été revu et approuvé par au moins 1 pair | Dev |
| 3 | **Tests** | Tests unitaires et/ou E2E écrits et passants | Dev / QA |
| 4 | **Documentation** | Documentation technique mise à jour si nécessaire | Dev |
| 5 | **Déploiement** | La story est déployable en staging sans erreur | Dev / DevOps |

## Critères spécifiques au projet

<!-- Ajouter ici les critères propres au contexte du projet -->

| # | Critère | Description | Vérifié par |
|---|---|---|---|
| 6 | [Critère projet] | [Description] | [Rôle] |

## Exceptions

<!-- Documenter les cas où la DoD est ajustée (ex: spike, prototype) -->

| Type de story | Critères ajustés | Raison |
|---|---|---|
| **Spike** | Pas de tests, livrable = rapport | Investigation, pas d'implémentation |
| **Prototype** | Pas de code review, pas de tests E2E | Jetable par design |

---

## Validation

- [ ] DoD validée par l'équipe (PM + Dev Lead + QA)
- [ ] Critères mesurables et vérifiables
- [ ] Exceptions documentées et limitées
- [ ] DoD accessible à toute l'équipe
