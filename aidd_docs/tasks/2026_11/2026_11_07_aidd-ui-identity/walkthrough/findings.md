---
objective: "Lancer chaque skill d'aidd-ui à la main, de 01 à 06, sur un projet vierge puis sur une copie de Kairos, et noter chaque écart avant de corriger quoi que ce soit."
status: in-progress
---

# Passage : chaque skill à la main

Gel : aucune règle ni page nouvelle pendant le passage. Les corrections viennent après, par lots, d'après ce tableau.

Ensuite : `feature`, `audit`, puis l'orchestrateur, selon la [feuille de route](../../../2026_10/2026_10_30_aidd-ui-rework/roadmap.md).

## Écarts

| Projet | Skill | Seul | Dans le flow | Écart | Gravité |
| --- | --- | --- | --- | --- | --- |

## Frontières entre skills, vues par la machine

Lecture des skills contre la spec et la feuille de route. Aucun skill ne refait le travail d'un autre : chacun écrit ses propres fichiers.

| Skill | Écart | Preuve | Gravité |
| --- | --- | --- | --- |
| 02 à 05 | La boucle comparer, garder, réviser est copiée quatre fois, avec quatre règles de départage différentes. | `02-brand/actions/03-choose.md`, `03-foundations/actions/02-write.md`, `04-components/actions/02-write.md`, `05-screens/actions/03-choose.md` | moyenne |
| 03, 04, 05 | Après un changement de token, aucun skill ne répare un écran qui cite un token disparu. 03 renvoie V3 à « another skill », 05 dit « Nothing owed ». | `03-foundations/references/engine.md`, `05-screens/references/engine.md` | haute |
| 06 | Une review partielle est impossible : un état sans verdict bloque l'écriture. La spec veut garder les écrans restants et reprendre. | `06-review/actions/03-choose.md`, spec « Review » | moyenne |
| 06 | Pas de ligne d'accessibilité par état, que le brainstorm prévoyait. | `06-review/references/review.md` | basse |
| 01 | Un écran sans wireframe donne un avertissement, mais aucun skill ne déduit le wireframe depuis l'écran, comme la spec le demande. | `hooks/lib/records.cjs`, spec décision 4 | basse |
| aucun | `publish` sans identifiant, qui monte la version du design system, n'est lancé par aucun skill. | `06-review/references/engine.md` | moyenne |
| 03, 04 | Arrêt dur sans le skill précédent, alors que le brainstorm laisse la personne libre de l'ordre. | `03-foundations/actions/01-prepare.md`, `04-components/actions/01-prepare.md` | à trancher |
| 04, 05 | Écrivent un lien `code` à l'extraction : ce n'est pas encore le travail de `feature`, qui met ces liens à jour après le code. | `04-components/references/extraction.md`, `05-screens/references/screens.md` | aucune, à garder en tête |

## Pilote, vu par la machine

Pilote relancé de 01 à 06, traces gardées, sur un projet vierge puis sur une copie de Kairos. Le pilote répond seul aux questions : les points d'attente d'un humain n'y apparaissent pas.

| Projet | Skill | Écart | Preuve | Gravité |
| --- | --- | --- | --- | --- |
| vierge | 03 → 04, 05 | 03 écrit `type.body` et `type.heading` en composites `typography` portés par `$extensions` seul. `tokens.css` en sort `--type-body: font-family: …;;`, une valeur inutilisable. 04 et 05 veulent un token sémantique, jamais une primitive : ils retirent toute la typo, et les écrans prennent la police du navigateur. Vérifié : `dressed 0/7`. | `03-foundations/references/tokens.md` (« each with family, size, line height, weight »), `04-components/references/elements.md`, `05-screens/references/screens.md`, `tokens.css` du pilote | haute |
| les deux | 01 à 06 | Le hook refuse selon l'ordre d'écriture : H1 et V1 avant `bump`, R12 avant les wireframes. Sur Kairos 04, ids en points contre tirets : douze fiches réécrites trois fois. | traces `*.04-components.trace.jsonl` | haute |
| Kairos | tous | Bruit persistant : T1 après 01 et 02, R18, environ 250 avertissements C3, C4 et V6 ; `validate` sort en 1. | traces, `walk-kairos.log` | moyenne |
| les deux | 06 | Les parcours ne sont jamais publiés. | `*.06-review.trace.jsonl` | moyenne |
| les deux | 04, 05 | La règle « never read its source » est violée : lecture de `hooks/aidd-ui.cjs` et grep dans `hooks/lib`. | `blank.04-components.trace.jsonl`, `blank.05-screens.trace.jsonl` | moyenne |
| Kairos | 03, 04, 06 | Lectures sous `~/.claude/projects`. | traces Kairos | moyenne |
| les deux | tous | Une dizaine de commandes bash composées bloquées par projet. | traces | basse |
| Kairos | 03 | `extract` refuse, l'assistant écrit quand même, puis relance avec `--force`. | `*.03-foundations.trace.jsonl` | moyenne |
| les deux | 05 | Premier `compare` sans `--root`, sortie 2. Sur Kairos, `compare && keep` enchaînés sans pause pour la personne. | `*.05-screens.trace.jsonl` | moyenne |
| les deux | 02 | `brand.md` sans front matter après `keep` (R1) ; `help brand` sort en 2. | `*.02-brand.trace.jsonl` | basse |

Seule la première ligne est revérifiée sur pièces ; les autres viennent de la lecture des traces par un agent.
