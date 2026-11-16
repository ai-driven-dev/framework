# aidd-ui : feuille de route

Sept pull requests, chacune planifiée, codée et revue à son tour. Le contrat est dans [spec.md](./spec.md).

## Skills

| Skill | Fait | Produit |
| --- | --- | --- |
| `01-system` | pose la marque, les tokens, les assets et les composants, depuis rien ou en les extrayant du code ; conduit un changement de l'impact jusqu'aux nouvelles versions | `system.md`, `brand.md`, `tokens.json`, `assets/`, `components/` |
| `02-journeys` | écrit les parcours d'un persona du brief et dessine leurs wireframes, sans token | `journeys/`, `wireframes/` |
| `03-screens` | habille un wireframe en écran avec ses états, sans créer de composant | `screens/` |
| `04-review` | ouvre la page de review et reprend à partir des verdicts ; un écran codé exige la capture du réel | `reviews/` |
| `05-feature` | écrit le `ui.md` d'une feature, puis vérifie son code et met à jour les liens | `ui.md` dans le dossier de la tâche |
| `06-audit` | constate les écarts sans rien corriger, accessibilité comprise | un rapport |

Un skill ne nomme jamais un autre skill ; seul l'orchestrateur UI d'`aidd-orchestrator` propose l'ordre de l'un à l'autre. Les frontières sont dans [le brainstorm de la suite](../../2026_11/2026_11_06_aidd-ui-journeys/brainstorm.md).

La vérification est un hook, déclenché à chaque écriture dans `aidd_docs/ui/` : chaque skill en hérite et voit l'erreur pendant qu'il travaille. Elle se lance aussi à la main. Un seul moteur, livré avec le hook, porte la lecture des fiches et chaque génération ; les skills l'appellent par sous-commande : `tokens.css` pour `01-system`, la vitrine pour `03-screens`, la page de review pour `04-review`.

## Pull requests

| # | Contenu | Fini quand |
| --- | --- | --- |
| 1 | Socle : règles de chaque fiche, vérification complète en hook et à la main | chaque règle de la spec a un cas qui la fait échouer ; un projet exemple complet passe |
| 2 | `01-system` : marque, tokens, assets, composants, extraction depuis le code, génération de `tokens.css`, flux de changement | sur le pilote vierge, puis sur Gouvernail et Kairos, le design system est posé, puis un changement de token produit son impact et ses versions |
| 3 | `02-journeys` | sur le pilote vierge, chaque parcours voulu a ses wireframes, sans token |
| 4 | `03-screens`, `04-review`, vitrine, contraste | sur le pilote vierge, tous les écrans voulus sont validés en review, vitrine générée deux fois identique |
| 5 | `05-feature`, la lecture du `ui.md` par le plan et l'implémentation, capture du réel | une feature du pilote passe du `ui.md` au code vérifié, liens à jour |
| 6 | `06-audit`, retrait du volet UI de l'audit dev | l'audit du pilote signale chaque écart semé exprès, et rien d'autre |
| 7 | orchestrateur UI, étape UI de l'onboarding | depuis rien, l'orchestrateur propose à chaque étape la suivante |

## Limites connues

- Le retour du hook à l'agent est garanti sur Claude Code. Codex ne lance le hook qu'une fois approuvé ; Copilot ne le lance que dans un dossier approuvé ; Kilo et opencode le reçoivent et relancent l'agent en fin de tour, une fois. Cursor n'est pas vérifié. Ailleurs, la commande à la main est la garantie.
