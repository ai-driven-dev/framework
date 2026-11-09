---
status: pending
---

# Instruction : moteur, brouillons ignorés, `compare` vérifie, `keep` tranche

## Goal

Le moteur seul porte la mécanique des variantes : il ignore les brouillons à la validation, refuse un jeu sans intention ou sans différence, et fait de la variante retenue une fiche.

## Architecture projection

```txt
.
├── plugins/aidd-ui/hooks/
│   ├── aidd-ui.cjs ✏️
│   └── lib/
│       ├── project.cjs ✏️
│       ├── drafts.cjs ✅
│       ├── hook.cjs ✏️
│       ├── cli.cjs ✏️
│       └── help.cjs ✏️
└── scripts/__tests__/aidd-ui/
    ├── drafts.test.js ✅
    ├── help.test.js ✏️
    └── validate.test.js ✏️
```

## Format d'un jeu

```txt
aidd_docs/ui/drafts/<id>/
├── variants.md        | Variant | Intent | <axe> | <axe>… |
├── <variante>/        miroir de aidd_docs/ui/ : brand.md, components/x.md, components/x.html…
│   └── preview.html   facultatif, jamais promu
└── compare.html       écrit par le moteur (phase 2)
aidd_docs/ui/drafts/.gitignore   écrit par le moteur : *
```

| Rule | Signale |
| --- | --- |
| D1 | moins de deux lignes dans `variants.md` |
| D2 | une ligne sans intention |
| D3 | aucune colonne d'axe, ou une cellule d'axe vide |
| D4 | deux lignes aux mêmes valeurs sur chaque axe (casse et espaces normalisés), ou deux dossiers identiques octet pour octet |
| D5 | une ligne dont le dossier manque ou est vide |

Problèmes imprimés comme `validate` (`formatAll`), fichier `drafts/<id>/variants.md`.

## Tests to write first (red, then green)

| Scenario | Action | Observable outcome |
| --- | --- | --- |
| Setup | le projet fixture, plus un jeu `drafts/brand/` de trois variantes valides, chacune `brand.md` et `preview.html` | prêt |
| Brouillons ignorés | un brouillon au `kind` inconnu sous `drafts/brand/a/` | `validate` imprime `VALID` ; le hook ne signale rien sur ce fichier |
| Jeu valide | `compare brand` | exit 0, JSON `variants` : chaque `name` et `intent`, dans l'ordre de la table ; `drafts/.gitignore` vaut `*` |
| D1 | une seule ligne | exit 1, `D1`, rien d'écrit |
| D2 | une intention vide | exit 1, `D2` nommant la variante |
| D3 | table sans colonne d'axe ; puis une cellule d'axe vide | exit 1, `D3` chaque fois |
| D4 | deux lignes aux mêmes valeurs d'axe, à la casse près ; puis deux dossiers copiés | exit 1, `D4` chaque fois |
| D5 | une ligne sans dossier ; puis un dossier vide | exit 1, `D5` chaque fois |
| Refus | `compare` sans `drafts/<id>/variants.md` ; sans `aidd_docs/ui` | exit 2, message, rien d'écrit |
| Keep | `keep brand b` | exit 0 ; `aidd_docs/ui/brand.md` égale `drafts/brand/b/brand.md` ; aucun `preview.html` promu ; `drafts/brand/` effacé ; `drafts/.gitignore` reste ; JSON `kept` et `written` |
| Keep miroir | un jeu de composant, `b/components/x.md` et `x.html` | les deux atterrissent sous `components/` |
| Keep écrase | `brand.md` existe déjà | remplacé par la variante retenue |
| Keep refusé | variante inconnue ; jeu en D2 | exit 2, rien d'écrit, `drafts/brand/` intact |
| Hook | `keep` lancé par un shell | le tour est marqué, comme `bump` ; `compare` ne marque rien, il n'écrit que sous `drafts/` |
| Help | `help compare`, `help keep` | usage, effets, sortie, codes ; douze mots par phrase |
| Teardown | dossiers temporaires | effacés |

Tests existants à suivre, rouges d'abord :

- `help.test.js` : une entrée par commande ; la carte `runs` gagne `compare` (0, 1, 2) et `keep` (0, 2).
- `help.test.js` : drapeaux des lignes d'usage, `COMPARE_USAGE` et `KEEP_USAGE` exportés par `cli.cjs`.
- E11 de `validate.test.js` : `ENGINE_COMMANDS` gagne une ligne `keep`.
- E9 de `validate.test.js` si la liste des commandes y est figée.

## Tasks

1. `project.cjs` : `drafts` rejoint `showcase` dans le saut de `walk` ; `DRAFTS_DIR` exporté.
2. `drafts.cjs` : `check(root, id)` rend les problèmes D1 à D5 ; `keep(root, id, variant)` revérifie puis copie et efface.
   - Lit `variants.md` par `table` de `markdown.cjs` ; `Refusal` pour ce qui refuse.
3. `aidd-ui.cjs` : `compare` et `keep` dans `COMMANDS`, analysés par `parse`, `--root` comme les autres.
4. `hook.cjs` : `keep` rejoint `ENGINE_WRITES`.
5. `cli.cjs` : `COMPARE_USAGE`, `KEEP_USAGE`. `help.cjs` : deux entrées, le format du jeu dans `help compare`.

## Mutations, une à la fois, son propre test rouge

- `drafts` retiré du saut de `walk`.
- D1 à deux lignes devient « une ligne suffit ».
- D2 ignoré ; D3 ignoré ; D4 sans normalisation de casse ; D4 sans comparaison des dossiers ; D5 ignoré.
- `.gitignore` non écrit.
- `keep` promeut `preview.html` ; `keep` laisse `drafts/<id>/` ; `keep` écrit malgré un jeu invalide.
- `keep` retiré d'`ENGINE_WRITES`.

## Done-when

- La suite enveloppée passe ; `drafts.test.js` a échoué avant le code.
- Chaque mutation ci-dessus rougit son propre test, inscrite plus tard dans `run-4b.md`.
