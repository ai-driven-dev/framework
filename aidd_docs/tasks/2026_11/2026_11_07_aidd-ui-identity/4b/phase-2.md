---
status: pending
---

# Instruction : moteur, la page de comparaison et le format du retour

## Goal

`compare` écrit une page statique, ouverte en `file://`, qui bascule, juxtapose, écarte, change d'état et de thème, note chaque variante, puis rend un retour au format unique.

## Architecture projection

```txt
.
├── plugins/aidd-ui/hooks/lib/
│   ├── drafts.cjs ✏️
│   ├── page.cjs ✅
│   └── help.cjs ✏️
└── scripts/__tests__/aidd-ui/
    └── drafts.test.js ✏️
```

## La page

- Un fichier, `drafts/<id>/compare.html`, CSS et JS en ligne ; aucune requête, aucun serveur.
- Par variante : son nom, son intention, ses valeurs d'axe, chaque `.md` en texte, chaque `.html` en iframe `srcdoc`.
- Le lien `../tokens.css` d'un rendu devient un `<style>` de `aidd_docs/ui/tokens.css` quand il existe.
- Contrôles : une variante ou deux côte à côte ; écarter ; état parmi les `data-state` trouvés ; thème parmi les `themes` de `system.md`, absent sans système.
- Chaque variante : une note de 1 à 5, un commentaire.
- Retour : « Enregistrer » via `showSaveFilePicker`, nom proposé `feedback.json`, quand la fonction existe ; « Copier » partout, plus le JSON visible dans une zone de texte.
- Habillage neutre : la page ne prête aucun style aux variantes.

## Format du retour

```json
{ "draft": "<id>", "variants": [{ "name": "a", "rating": 4, "discarded": false, "comment": "" }] }
```

`rating` vaut 1 à 5 ou `null` ; ordre de `variants.md`. `feedbackOf(state)` le construit : fonction pure de `page.cjs`, sérialisée dans la page par `toString`.

## Tests to write first (red, then green)

| Scenario | Action | Observable outcome |
| --- | --- | --- |
| Setup | le jeu de trois variantes de la phase 1 ; un jeu de composant sur la fixture à deux thèmes | prêt |
| Page écrite | `compare brand` | exit 0 ; JSON `page` vaut `aidd_docs/ui/drafts/brand/compare.html` |
| Contenu | lire la page | chaque nom, intention et valeur d'axe ; une iframe `srcdoc` par `.html` ; aucun `src=` ni `href=` externe |
| Tokens | jeu de composant | `tokens.css` en ligne, plus de `../tokens.css` ; contrôle de thème listant `light` et `dark` |
| Sans système | jeu de marque | aucun contrôle de thème |
| États | un rendu à `data-state="default"` et `"hover"` | les deux proposés, triés |
| Déterminisme | `compare` deux fois | deux pages identiques octet pour octet |
| Format | `feedbackOf` sur un état noté, écarté, commenté | l'objet exact ci-dessus ; `rating` `null` sans note |
| Sérialisation | la page | contient `feedbackOf` tel que `toString` le rend |
| Choix d'écriture | la page | appelle `showSaveFilePicker` seulement si elle existe ; « Copier » toujours présent |
| Réseau | la page | ni `fetch`, ni `XMLHttpRequest`, ni `WebSocket` |
| Teardown | dossiers temporaires | effacés |

Le comportement à l'écran (bascule, côte à côte, écart, état, thème) se prouve en phase 4, dans un navigateur.

## Tasks

1. `page.cjs` : `pageOf(set)` rend le HTML ; `feedbackOf` exporté.
2. `drafts.cjs` : `compare` écrit la page après une vérification sans problème.
3. `help compare` : le chemin de la page, le format du retour, les deux façons de le rendre.

## Mutations, une à la fois, son propre test rouge

- `feedbackOf` sans `discarded` ; `rating` à `0` au lieu de `null`.
- Le lien `../tokens.css` laissé tel quel.
- Thèmes inventés sans `system.md`.
- États laissés dans l'ordre du rendu, non triés.
- Variantes lues dans l'ordre du disque, pas de `variants.md`.
- `showSaveFilePicker` appelé sans test d'existence.

## Done-when

- La suite enveloppée passe ; chaque test a échoué avant son code.
- Chaque mutation rougit son propre test.
