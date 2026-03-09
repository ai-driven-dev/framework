# AIDD CLI -- Backlog de developpement

> Plan d'execution complet pour AIDD CLI v3.0 (MVP), v3.1+ et v3.2+.
> Genere depuis : milestones.md, user_stories.md, architecture.md, prd.md.
> **46 tickets** (37 originaux + 054 migration + 055 release pin + 056 status update check + 064 update dry-run + 080-083 M8 ergonomics).

---

## Fonctionnement du Kanban

Le backlog est organise en trois dossiers representant un flux kanban :

```
aidd_docs/backlog/
  todo/     -- Tickets prets a etre pris en charge
  doing/    -- Ticket en cours de travail (1 seul a la fois)
  done/     -- Tickets termines et valides
```

### Regles pour l'agent AI

1. **Verifier les dependances** -- Avant de commencer un ticket, verifier que tous les tickets listes dans `blockedBy` sont presents dans `done/`. Si un bloquant est encore dans `todo/` ou `doing/`, passer au ticket suivant.
2. **Deplacer avant de commencer** -- Deplacer le fichier ticket de `todo/` vers `doing/` AVANT de commencer le travail.
3. **Un seul ticket a la fois** -- Il ne doit y avoir qu'un seul fichier dans `doing/` a tout moment.
4. **Ordre de priorite** -- Prendre les tickets par numero croissant (le plus petit numero d'abord), en respectant les dependances.
5. **Deplacer apres validation** -- Deplacer le fichier ticket de `doing/` vers `done/` uniquement APRES que tous les criteres d'acceptation soient valides.
6. **Validation d'un ticket** -- Un ticket est considere termine quand :
   - Tous les criteres d'acceptation sont coches
   - Tous les tests passent (`pnpm test`)
   - Le type-check passe (`pnpm typecheck`)
   - Le lint passe (`pnpm lint`)

### Documents de reference obligatoires

Chaque ticket qui implemente du texte visible par l'utilisateur DOIT respecter :

- **`aidd_docs/memory/internal/ux_copy.md`** -- Source de verite pour TOUT le texte visible (erreurs, succes, warnings, progres, aide). Aucun autre document ne doit contenir du texte utilisateur exact.
- **`aidd_docs/memory/internal/user_flows.md`** -- Diagrammes de flux, tables d'etats, chemins de recovery, transitions cross-flow.
- **`aidd_docs/memory/internal/architecture.md`** -- ADRs, conventions de nommage, structure des couches.
- **`aidd_docs/memory/internal/prd.md`** -- NFRs (performance, securite, cross-platform).

### NFR a verifier dans les tests E2E

| NFR  | Critere                                                | Tickets concernes |
| ---- | ------------------------------------------------------ | ----------------- |
| NFR1 | Operations locales < 5s (~100 fichiers)                | 034, 044, 063, 080, 082, 083 |
| NFR2 | Download remote < 30s                                  | 063, 056                     |
| NFR6 | Aucune requete reseau pour operations locales          | 034, 044, 080, 082           |
| NFR9 | macOS + Linux + WSL (pas de chemins platform-specific) | 034, 044, 063, 080           |

### Commandes de flux

```bash
# Prendre un ticket
mv aidd_docs/backlog/todo/NNN_short_name.md aidd_docs/backlog/doing/

# Terminer un ticket
mv aidd_docs/backlog/doing/NNN_short_name.md aidd_docs/backlog/done/
```

---

## Format des tickets

Chaque fichier ticket suit ce format :

```yaml
---
id: NNN
milestone: MX
title: "Titre court"
stories: [US-XXX] # Stories couvertes, ou []
points: X
blockedBy: [NNN] # IDs des tickets bloquants, ou []
---
```

Suivi de sections : Context, Scope, Acceptance Criteria, Technical Notes, Files to Create/Modify, Tests, Done When.

---

## Vue d'ensemble des Milestones

| Milestone | Objectif                         | Points | Sprint | Scope | Tickets              |
| --------- | -------------------------------- | ------ | ------ | ----- | -------------------- |
| **M0**    | Project Foundation               | 0      | 0      | MVP   | 001 -- 003           |
| **M1**    | Domain Layer                     | 0      | 1      | MVP   | 010 -- 016           |
| **M2**    | Infrastructure -- Framework Res. | 13     | 1-2    | MVP   | 020 -- 025           |
| **M3**    | Init & Install Commands          | 15     | 2      | MVP   | 030 -- 034           |
| **M4**    | Lifecycle Commands               | 14     | 3      | MVP   | 040 -- 044           |
| **M5**    | Cross-Cutting & Polish           | 20     | 3      | MVP   | 050 -- 056           |
| **M6**    | Update & Restore                 | 17     | 4      | v3.1+ | 060 -- 064           |
| **M7**    | Cross-Tool Sync                  | 10     | 5      | v3.1+ | 070 -- 072           |
| **M8**    | Ergonomics & Tooling             | 10     | 6      | v3.2+ | 080 -- 083           |

**Chemin critique :** M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6 -> M7 -> M8

---

## Couverture des User Stories

Chaque story est couverte par au moins un ticket. Aucune story n'est omise.

| Story  | Points | Milestone | Ticket(s)     |
| ------ | ------ | --------- | ------------- |
| US-001 | 5      | M2        | 020, 021, 023 |
| US-002 | 3      | M2        | 023           |
| US-003 | 3      | M2        | 021           |
| US-004 | 2      | M2        | 023           |
| US-005 | 2      | M5        | 051           |
| US-006 | 3      | M3        | 031           |
| US-007 | 2      | M3        | 031           |
| US-008 | 8      | M3        | 032, 033      |
| US-010 | 2      | M3        | 033           |
| US-011 | 2      | M5        | 052           |
| US-012 | 3      | M5        | 053           |
| US-013 | 3      | M4        | 040           |
| US-014 | 5      | M4        | 041, 056      |
| US-015 | 1      | M5        | 052           |
| US-016 | 3      | M4        | 042           |
| US-017 | 3      | M4        | 043           |
| US-018 | 2      | M5        | 050           |
| US-019 | 5      | M6        | 060, 064      |
| US-020 | 5      | M6        | 061           |
| US-021 | 5      | M6        | 062           |
| US-023 | 5      | M7        | 071           |
| US-024 | 3      | M7        | 072           |
| US-025 | 2      | M7        | 071           |
| US-026 | 2      | M5        | 051           |
| US-027 | 2      | M5        | 050           |

---

## Graphe de dependances des tickets

```
M0: 001 -> 002 -> 003

M1: 003 -> 010 -> 011 -> 012 -> 013 -> 014 --\
                   010 -> 015 -----------------+--> 016

M2: 016 -> 020 -> 021 --\
                  022 ---+--> 023 -> 024 -> 025

M3: 025 -> 030 -> 031 -> 032 -> 033 -> 034

M4: 034 -> 040 -> 041 -> 042 -> 043 -> 044

M5: 044 -> 050 -> 051 -> 052 -> 053
         025 -> 054 (manifest migration, parallelisable avec M3-M5)
         054 -> 055 (release pin, parallelisable avec M6)
         054 -> 056 (status update check, parallelisable avec M6)

M6: 053 -> 060 -> 061 -> 062 -> 063
         060 -> 064 (update dry-run, parallelisable avec 061)

M7: 063 -> 070 -> 071 -> 072

M8: (parallelisable entre eux, debloquable apres M5)
    056 -> 080 (cache management)
    056 -> 081 (config management)
    056 -> 082 (init --force)
    056 -> 083 (doctor --fix)
```

Note : les branches paralleles sont visibles dans M1 (015 et 014 convergent vers 016) et M2 (021 et 022 convergent vers 023). L'agent ne doit pas attendre 014 pour commencer 015, ni 021 pour commencer 022. Les tickets M8 (080-083) sont independants entre eux et peuvent etre pris dans n'importe quel ordre.

Les dependances sont par ID de ticket (pas par milestone). L'agent doit verifier que chaque `blockedBy` est dans `done/` avant de demarrer.

---

## Tickets supplementaires (post-audit et gap analysis)

| Ticket | Milestone | Titre                                     | Points | blockedBy | Justification                                           |
| ------ | --------- | ----------------------------------------- | ------ | --------- | ------------------------------------------------------- |
| 054    | M5        | Manifest format migration auto            | 2      | [025]     | Constitution Decision Rule #6, DoD #13                  |
| 055    | M5        | Add --release global option               | 2      | []        | Reproducible installs, version pinning for teams        |
| 056    | M5        | Status update-available check             | 2      | [054]     | Spec/impl gap: ux_copy defines this, status.ts omits it |
| 064    | M6        | Add --dry-run flag to aidd update         | 2      | [060]     | UX consistency with aidd clean dry-run convention       |
| 080    | M8        | Cache management (list + clear)           | 2      | []        | Self-service troubleshooting for corrupted/stale cache  |
| 081    | M8        | Config management (get / set / list)      | 3      | []        | Ergonomic alternative to manual settings.json editing   |
| 082    | M8        | Add --force to aidd init (docs re-init)   | 2      | []        | Refresh docs templates without full clean+reinit        |
| 083    | M8        | Add --fix to aidd doctor (auto-repair)    | 3      | []        | Close feedback loop: detect then auto-remediate issues  |
