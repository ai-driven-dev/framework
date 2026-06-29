---
objective: "Le memory bank généré ne duplique plus un fait entre fichiers, et le fill ne re-écrit plus un fait déjà capturé."
status: pending
---

# Plan: dédup des templates mémoire (02-project-memory)

## Overview

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| **Goal**   | Supprimer la duplication cross-fichiers du memory bank : templates à responsabilité unique + fill non aveugle. |
| **Source** | `aidd_docs/tasks/2026_06/2026_06_29-memory-duplication-diagnosis.md`  |

## Phases

| #   | Phase                          | File                         |
| --- | ------------------------------ | ---------------------------- |
| 1   | Templates à responsabilité unique | [`phase-1.md`](./phase-1.md) |
| 2   | Fill non aveugle + règle dédup | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                       | Verified                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| docs Anthropic skills + agentskills.io                       | `@` = import CLAUDE.md, pas le standard skill (chemins relatifs)  |
| `aidd framework build --target codex` (test scratchpad)      | le build convertit `@../x` → un lien `x` vers `../x` ; la dup est structurelle |
| Les 22 templates `assets/templates/memory/`                  | matrice des faits dupliqués, table de dominance réduite           |

## Decisions

| Decision                                                          | Why                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| Pas de pointer mémoire↔mémoire généralisé                         | casse l'auto-suffisance d'un fichier lisible seul ; gain < coût     |
| `integration` reframé en intégrations externes, pas juste coupé   | le fichier mélangeait 2 responsabilités (interne ≡ architecture)    |
| On garde les dups mineures (framework, environnements, release)   | un mot re-nommé coûte moins qu'un renvoi                            |
| Le vrai levier = casser le fill parallèle aveugle (03.6)          | même templates parfaits, le fill aveugle re-écrit le même fait      |
| Check dédup = review sémantique, pas un script grep               | preuve empirique : le substring sur-compte (label de zone ≠ dup)    |
| Règle dédup explicitée fort + points fact→owner                   | la dédup dépend du fill agent ; la règle doit être sans ambiguïté   |
| Symptôme A (Codex `@` brut) hors scope                            | dépend du chemin de distribution réel, à tracer séparément          |
| Gate `integration` (sans service externe → fichier vide) hors scope | trouvaille empirique ; fix dans `capability-signals` séparément   |
