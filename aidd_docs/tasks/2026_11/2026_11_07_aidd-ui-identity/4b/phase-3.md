---
status: done
---

# Instruction : skills, `02-brand` propose toujours et évolue, 03 et 04 sur demande ; pilote

## Goal

`02-brand` propose au moins deux directions, chacune avec son intention et ses axes, fait comparer, garde la retenue, et fait évoluer une marque existante ; `03-foundations` et `04-components` font de même sur demande. Le skill guide la décision sans prescrire de style.

## Architecture projection

```txt
.
├── plugins/aidd-ui/
│   ├── README.md ✏️
│   └── skills/
│       ├── 02-brand/
│       │   ├── SKILL.md ✏️
│       │   ├── actions/
│       │   │   ├── 01-prepare.md ✏️
│       │   │   ├── 02-propose.md ✅ (remplace 02-write.md)
│       │   │   ├── 03-choose.md ✅
│       │   │   └── 04-conclude.md ✏️ (ex 03-conclude.md)
│       │   └── references/
│       │       ├── cases.md ✏️
│       │       ├── engine.md ✏️
│       │       └── variants.md ✅
│       ├── 03-foundations/
│       │   ├── SKILL.md ✏️
│       │   ├── actions/02-write.md ✏️
│       │   └── references/{engine,variants}.md ✏️ ✅
│       └── 04-components/
│           ├── SKILL.md ✏️
│           ├── actions/02-write.md ✏️
│           └── references/{engine,variants}.md ✏️ ✅
├── docs/CATALOG.md ✏️
└── scripts/
    ├── aidd-ui-pilot.cjs ✏️
    └── __tests__/aidd-ui/
        ├── skill.test.js ✏️
        └── pilot.test.js ✏️
```

## Contenu

- `02-brand`, `01-prepare` : l'arrêt sur `brand.md` existant disparaît ; `cases.md` gagne « évolution » : la marque existe, la demande dit ce qui change.
- `02-propose` : au moins deux directions, tirées du sujet et de l'échange ; une intention et ses valeurs d'axe chacune ; un aperçu par direction ; comparer, corriger jusqu'à ce que le moteur accepte.
- `03-choose` : donner la page ; attendre le retour ; lire `feedback.json`, sinon écrire le retour collé ; garder la direction choisie.
- `04-conclude` : inchangé hors renumérotation.
- `references/variants.md`, un par skill, jamais identiques : ce qu'est un axe pour ce skill, comment lire notes et écarts, aucun style, aucune palette, aucune police nommés.
- 03 et 04, `02-write` : une étape « si la personne demande des variantes, proposer et choisir per [variants] » ; rien d'autre ne bouge.
- Ligne « Write only » : `02-brand` ajoute `aidd_docs/ui/drafts/brand/` ; 03 et 04 ajoutent `drafts/`.
- `engine.md` : lignes d'étape `compare` et `keep` ; aucun texte de `help` répété.
- README : étape 3 dit que la marque propose des directions comparées ; diagramme inchangé sauf besoin.
- Pilote : `ENGINE_FILES["02-brand"]` devient `["drafts/.gitignore"]` ; la requête de marque vierge demande trois directions. Un brouillon laissé derrière sort déjà par `stepBreaks`.

## Tests to write first (red, then green)

| Scenario | Action | Observable outcome |
| --- | --- | --- |
| Table d'étapes | `WHAT` de `skill.test.js` gagne `compare` (« compar ») et `keep` (« keep ») | chaque ligne d'`engine.md` pointe une étape qui dit ce que fait sa commande |
| Structure | tests existants | 12 mots, actions sans commande, aucun skill nommé, aucun lien hors dossier, aucune référence en double, tables dues |
| Pilote | `pilot.test.js` | `ENGINE_FILES` figé avec `drafts/.gitignore` pour `02-brand` ; un brouillon restant nommé par `stepBreaks` ; la requête vierge dit « three » ; lignes « Write only » épinglées |
| Teardown | dossiers temporaires | effacés |

## Mutations, une à la fois, son propre test rouge

Aucune garde sur la formulation : « au moins deux » et « sans style » se prouvent au pilote et à la relecture, pas par un test.

- Une ligne `compare` d'`engine.md` pointée sur une étape qui ne compare pas.
- `drafts/.gitignore` retiré de `ENGINE_FILES["02-brand"]`.
- « three » retiré de la requête vierge.

## Done-when

- La suite enveloppée passe ; `node scripts/check-architecture-rules.js $(git ls-files plugins/aidd-ui)` et `node scripts/check-doc-duplication.js` sortent 0.
- Chaque mutation rougit son propre test.
- Le nombre de mots des skills (`cat plugins/aidd-ui/skills/*/*.md plugins/aidd-ui/skills/*/*/*.md | wc -w`) est relevé avant et après.
