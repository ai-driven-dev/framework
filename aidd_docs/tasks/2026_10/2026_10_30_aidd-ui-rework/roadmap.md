# aidd-ui : feuille de route

Cinq pull requests empilées, chacune planifiée, codée et revue à son tour. Le contrat est dans [spec.md](./spec.md).

## Skills

| Skill | Fait | Produit |
| --- | --- | --- |
| `01-system` | pose la marque, les tokens, les assets et les composants, depuis rien ou en les extrayant du code ; conduit un changement de l'impact jusqu'aux nouvelles versions | `system.md`, `brand.md`, `tokens.json`, `assets/`, `components/` |
| `02-screens` | dessine les parcours, les wireframes puis les écrans avec leurs états | `journeys/`, `screens/` |
| `03-review` | ouvre la page de review et reprend à partir des verdicts | `reviews/` |
| `04-feature` | écrit le `ui.md` d'une feature, puis vérifie son code et met à jour les liens | `ui.md` dans le dossier de la tâche |
| `05-audit` | constate les écarts sans rien corriger | un rapport |

Un skill ne nomme jamais un autre skill.

La vérification est un hook, déclenché à chaque écriture dans `aidd_docs/ui/` : chaque skill en hérite et voit l'erreur pendant qu'il travaille. Elle se lance aussi à la main. Chaque skill porte ses propres scripts de génération : `tokens.css` pour `01-system`, la vitrine pour `02-screens`, la page de review pour `03-review`.

`01-hello` disparaît avec la PR 2.

## Pull requests

| # | Contenu | Fini quand |
| --- | --- | --- |
| 1 | Socle : règles de chaque fiche, vérification complète en hook et à la main | chaque règle de la spec a un cas qui la fait échouer ; un projet exemple complet passe |
| 2 | `01-system` : marque, tokens, assets, composants, extraction depuis le code, génération de `tokens.css`, flux de changement | sur le pilote vierge, puis sur Gouvernail et Kairos, le design system est posé, puis un changement de token produit son impact et ses versions |
| 3 | `02-screens`, `03-review`, vitrine | sur le pilote vierge, tous les écrans voulus sont validés en review, vitrine générée deux fois identique |
| 4 | `04-feature`, et la lecture du `ui.md` par le plan et l'implémentation | une feature du pilote passe du `ui.md` au code vérifié, liens à jour |
| 5 | `05-audit`, retrait du volet UI de l'audit dev | l'audit du pilote signale chaque écart semé exprès, et rien d'autre |

## Limites connues

- Le retour du hook à l'agent est garanti sur Claude Code. Codex ne lance le hook qu'une fois approuvé ; Copilot ne le lance que dans un dossier approuvé ; Kilo et opencode le reçoivent et relancent l'agent en fin de tour, une fois. Cursor n'est pas vérifié. Ailleurs, la commande à la main est la garantie.
