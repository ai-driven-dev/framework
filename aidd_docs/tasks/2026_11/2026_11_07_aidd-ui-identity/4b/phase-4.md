---
status: pending
---

# Instruction : une passe pilote, une passe navigateur, `run-4b.md`, gates

## Goal

Prouver le done-when une fois, sans boucle de relance : trois directions distinctes sur le vierge, la retenue devenue `brand.md`, la page manipulée dans un vrai navigateur, `feedback.json` écrit une fois.

## Architecture projection

```txt
.
└── aidd_docs/tasks/2026_11/2026_11_07_aidd-ui-identity/
    └── run-4b.md ✅
```

## Tests to write first (red, then green)

Aucun test neuf : cette phase prouve, elle ne garde rien.

| Scenario | Action | Observable outcome |
| --- | --- | --- |
| Setup | phases 1 à 3 sur la branche, arbre propre | la suite enveloppée passe |
| Pilote | `node scripts/aidd-ui-pilot.cjs --gouvernail <checkout> --kairos <checkout>`, une fois | chaque ligne `errors none`, `wireframes all`, `code untouched`, `steps ok` |
| Trois directions | la trace `blank.02-brand.trace.jsonl` | un `compare brand` sorti 0 listant trois variantes et trois intentions ; un `keep brand <v>` sorti 0 |
| Retenue | la copie vierge | `aidd_docs/ui/brand.md` existe et valide ; plus aucun fichier sous `drafts/` hors `.gitignore` |
| Signalé | `drafts.test.js` | les cas D2 et D4 passent : la seconde moitié du done-when |
| Page | dans un dossier du scratchpad, un jeu de trois variantes de marque et un de composant sur la fixture ; `compare` | deux pages |
| Navigateur | `npx --yes @playwright/cli@0.1.17` sur chaque page, `file://`, avec `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1` (sans elle : « Access to "file:" protocol is blocked ») | bascule A/B/C, deux côte à côte, écart, état, thème (composant), notes ; le JSON copié suit le format de `help compare` ; console sans erreur |
| Écriture réelle | la personne, dans son Chrome : aucun agent ne clique le sélecteur natif. Page de marque, « Enregistrer » dans `drafts/brand/` | `feedback.json` présent, au format |
| Teardown | copies du pilote, dossiers du scratchpad | effacés ; aucun chat laissé pour une copie |

## Tasks

1. Gates : suite enveloppée ; `pnpm exec lefthook run pre-commit`.
2. Pilote, une passe : lignes, extraits de trace, mots des skills.
3. Passe navigateur : une vidéo ou des captures par page, gardées hors dépôt ; ce qui a été vu, écrit.
4. `run-4b.md` : lignes du pilote, extrait de trace des trois directions, verdict de la passe navigateur, écriture réelle, tableau des mutations des phases 1 à 3. Aucun chemin machine, aucune date.
5. Un écart du pilote : lire ses sorties, corriger dans le skill ou l'écrire en limite. Pas de seconde passe sauf correction du moteur.

## Done-when

- Les gates sortent 0.
- `run-4b.md` montre trois directions comparées par le moteur, la retenue devenue `brand.md`, le vierge et les réels sans erreur.
- La page est manipulée dans un navigateur ; `feedback.json` a été écrit une fois par Chrome, de la main de la personne.
- Aucune copie ni chat de pilote ne reste.
