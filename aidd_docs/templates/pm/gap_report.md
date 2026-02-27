---
name: gap_report
description: Template for gap analysis report
argument-hint: N/A
---

# Gap Analysis Report - [Feature Name]

## Summary

| Field | Value |
|-------|-------|
| Date | !`date +%Y-%m-%d` |
| Analyzed by | [Name] + AI |
| Source | [PRD / User Stories] |
| Gaps found | X (Y critical, Z important) |

---

## Critical Gaps

> Bloquent le développement - doivent être résolus avant de continuer.

| # | Type | Description | Detected In | Contradicts | Action | Owner | Status |
|---|------|-------------|-------------|-------------|--------|-------|--------|
| 1 | [Type] | [Description] | [doc / section] | [requirement] | [Action] | [Owner] | Open / In Progress / Resolved |

---

## Important Gaps

> Doivent être résolus avant livraison.

| # | Type | Description | Detected In | Contradicts | Action | Owner | Status |
|---|------|-------------|-------------|-------------|--------|-------|--------|
| 1 | [Type] | [Description] | [doc / section] | [requirement] | [Action] | [Owner] | Open / In Progress / Resolved |

---

## Nice-to-have Gaps

> À traiter si temps disponible.

| # | Type | Description | Detected In | Action |
|---|------|-------------|-------------|--------|
| 1 | [Type] | [Description] | [doc / section] | [Action] |

---

## Inconsistencies

> Contradictions détectées entre sections.

- [Section A dit X, Section B dit Y]

---

## PRD Quality Dimensions

> Dimensions de validation qualitative du PRD (inspirées SMART + leakage detection).

### SMART Scoring

> Chaque exigence fonctionnelle doit être Specific, Measurable, Attainable, Relevant, Traceable.

| Requirement | S | M | A | R | T | Score | Action |
|-------------|---|---|---|---|---|-------|--------|
| [FR-001: description] | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | X/5 | [Action si <4/5] |

**Seuil** : Toute exigence <4/5 doit être reformulée.

### Implementation Leakage

> Détecter les noms de technologies dans les exigences fonctionnelles. Un PRD décrit le QUOI, pas le COMMENT.

| Exigence | Terme technique détecté | Reformulation proposée |
|----------|------------------------|------------------------|
| [FR-XXX] | [ex: "React component", "PostgreSQL", "REST API"] | [Reformulation fonctionnelle] |

**Règle** : Zéro nom de technologie dans les Functional Requirements. Les choix techniques appartiennent à l'architecture.

### Coherence & Traceability

> Vérifier que chaque feature PRD est traçable vers un besoin utilisateur et vice versa.

| PRD Feature | Persona | JTBD | Story (si backlog existe) | Status |
|-------------|---------|------|---------------------------|--------|
| [Feature 1] | [Persona X] | [JTBD-XX] | [US-XXX] | ✅ Tracé / ❌ Orphelin |

**Orphelins à traiter** :

- Feature sans JTBD → Justifier ou supprimer
- JTBD sans Feature → Gap fonctionnel à couvrir

---

## Gap Types Reference

| Type | Description |
|------|-------------|
| Functional | Scénarios non couverts |
| Edge case | Cas limites manquants |
| Inconsistency | Contradictions |
| Dependency | Systèmes externes |
| Security/GDPR | Conformité |
| Performance | Scalabilité |
| Codebase drift | Dérive entre specs et code existant |
| IA Strategy | Gaps stratégiques IA (moat, coûts, hallucinations, model drift, adoption) |
| SMART deficit | Exigence non-SMART (vague, non mesurable, non traçable) |
| Implementation leakage | Choix technique dans une exigence fonctionnelle |
| Traceability | Feature orpheline (pas de JTBD) ou JTBD non couvert |

---

## Remediation Tracking

| Gap # | Action | Status | Owner | Due Date | Blocked By |
|-------|--------|--------|-------|----------|------------|
| 1 | [action] | Not Started / In Progress / Completed | [owner] | [date] | [si bloqué] |

### Decision Point

Pour les gaps CRITICAL :

- [ ] GO/NO-GO decision requise avant de continuer
- [ ] GO conditionnel avec acceptation du risque
- [ ] Impact sur le timeline de launch : [jours/semaines]

---

