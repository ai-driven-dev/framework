---
objective: "Un projet Kilo peut utiliser les artefacts natifs générés par AIDD selon les seize critères de #914, sans perte de contenu utilisateur ni régression des autres cibles."
status: in-progress
---

# Plan: Génération native Kilo dans aidd-context

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Détection et mémoire Kilo, règles liées à la config, skills, agents, workflows et guidance hooks avec preuves de conservation et runtime. |
| **Source** | [Issue #914](https://github.com/ai-driven-dev/framework/issues/914), [demande conservée](./user-request.md), instructions actualisées du 10 octobre 2026 et [gather](./gather.md). |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Reconnaissance et mémoire partagée | [phase-1.md](./phase-1.md) |
| 2 | Publication des règles et configuration sans perte | [phase-2.md](./phase-2.md) |
| 3 | Skills natifs ou portables choisis | [phase-3.md](./phase-3.md) |
| 4 | Agents et workflows natifs | [phase-4.md](./phase-4.md) |
| 5 | Guidance hooks et relances sûres | [phase-5.md](./phase-5.md) |
| 6 | Preuves de génération et runtime sur plateformes supportées | [phase-6.md](./phase-6.md) |

Plan général validé avec les précisions de [la demande phase 1](./phase-1-request.md). Phase 1 clôturée par l’utilisateur avec ses limites conservées. La demande du 10 octobre 2026 autorise la phase 4, indépendante du writer de phase 2, et son commit local après validation. Les phases 2, 5 et 6 restent pending et exigent une autorisation distincte. Avant phase 2 : revalider #979, réutiliser sa version effectivement intégrée ; si encore Draft, demander une décision explicite. Aucune date de fusion supposée, aucun writer concurrent.

Chaque tâche suit la même progression : test pertinent rouge avant changement lorsque possible, implémentation minimale, documentation associée, validations automatisées et runtime pertinent, preuves conservées puis statut réel actualisé. Les régressions des cibles concernées se vérifient dès cette tâche. Preuve obligatoire manquante => tâche non entièrement validée. La phase 6 consolide, sans remplacer ces vérifications. Aucun push, PR ou changement de branche autorisé.

Éléments de revue joints : [exploration](./explore.md), [matrice des 16 critères](./coverage-matrix.md), [stratégie de tests](./test-strategy.md), [contrats officiels](./official-sources.md), [chevauchement #979](./overlap-979.md), [preuves d’environnement](./environment-evidence.md), [challenge](./challenge.md). Ces artefacts développent les contraintes du plan sans changer la structure de son template.

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/ai-driven-dev/framework/issues/914 | Corps courant et seize critères, date contractuelle 2026-09-25. |
| https://github.com/ai-driven-dev/framework/pull/971 | Fusionnée dans next et présente dans HEAD ; bridge déjà étendu. |
| https://github.com/ai-driven-dev/framework/pull/979 | Draft ouverte, base next, writer autonome excluant Kilo ; revalidation avant phase 2. |
| https://kilo.ai/docs/customize/agents-md | Surface mémoire et approbation de modification. |
| https://kilo.ai/docs/customize/custom-rules | Règles config-backed. |
| https://kilo.ai/docs/customize/skills | Agent Skills et chemins compatibles. |
| https://kilo.ai/docs/customize/custom-subagents | Agents Markdown, nom fichier et champs supportés. |
| https://kilo.ai/docs/customize/workflows | Commandes Markdown et options. |
| https://kilo.ai/docs/automate/extending/plugins | Plugins JS/TS et événements prouvés. |
| https://kilo.ai/docs/getting-started/settings | Fusion des configs et priorité .kilo. |
| https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md | Legacy et chemins compatibles. |

## Decisions

| Decision | Why |
| --- | --- |
| Production Kilo dans aidd-context, aucun nouveau profil/distributeur CLI | #744 livré, #868 hors scope ; préserver les frontières d’architecture. |
| Sources/templates Claude conservés ; branches de rendu et validation par cible | Évite d’affaiblir les contrats canoniques pour ajouter Kilo. |
| Extension du writer règles #979 après alignement de base | Évite deux mécanismes concurrents de publication et protège les sorties Codex/OpenCode corrigées. |
| JSONC édité localement et publication config/règle prévalidée ensemble | Préserver octets utilisateur et éviter artefacts non découvrables après erreur. |
| Mémoire partagée AGENTS.md dédupliquée ; portable skills uniquement sur choix | Contrat explicite #914 et absence de copies concurrentes. |
| Hooks Kilo donnent guidance terminale sourcée ; bridge existant seulement dans sa portée prouvée | Aucun hook déclaratif ou runtime plugin générique inventé. |
| Artefacts Claude offline + génération réelle via Codex ; runtime Claude authentifié déclaré indisponible | Couverture rigoureuse sans achat Anthropic ni fausse équivalence de preuves. |
