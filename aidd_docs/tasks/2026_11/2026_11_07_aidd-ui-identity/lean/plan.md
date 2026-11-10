---
objective: "Avant la tranche 4c, les quatre skills d'aidd-ui et leur moteur suivent les règles lean : aucune commande muette, aucun arrêt interactif manquant, chaque règle dans l'action qui l'applique, aucun code mort ; les lignes qui invoquent le moteur restent intactes."
status: done
---

# Plan : passe lean sur aidd-ui

Modèle : `plugins/aidd-refine/skills/01-brainstorm/`. Contexte : [spec.md](../spec.md), [plan 4b](../4b/plan.md), [run 4b](../run-4b.md).

Les règles sont numérotées comme dans le brief de la passe (1 à 9). Aucune coupe sans l'une d'elles (règle 9).

## Mesure de départ

| Mesure | Commande | Avant | Après visé |
| --- | --- | --- | --- |
| mots des skills, `.md`, sans `\|` | `find plugins/aidd-ui/skills -name '*.md' \| xargs cat \| tr -d '\|' \| wc -w` | 5052 | ≈ 4975 |
| mêmes fichiers avec `\|` (le 5668 annoncé) | même commande sans `tr` | 5668 | - |
| lignes du moteur, hors copie partagée | `cat plugins/aidd-ui/hooks/aidd-ui.cjs $(ls plugins/aidd-ui/hooks/lib/*.cjs \| grep -v common-rules) \| wc -l` | 4419 | ≈ 4390 |

`common-rules.cjs` (602 lignes) est hors périmètre : copie octet pour octet tenue par `scripts/check-hook-rule-copies.js`. Le 5021 l'incluait.

Le gain en mots est faible, et c'est voulu. Les skills ont déjà la forme du modèle. La passe vise la justesse (règles 2, 4, 8) plus que le volume. Le vrai gain en jetons : deux fichiers `reply.md` en moins à lire par passe.

## Audit des commandes à vide (règle 2)

Mesuré sur trois racines : sans `aidd_docs/ui`, avec un `aidd_docs/ui` vide, et le projet fixture des tests.

| Commande | Cas vide | Sortie actuelle | Code | Verdict |
| --- | --- | --- | --- | --- |
| `validate` | pas de `aidd_docs/ui` | rien | 0 | **muette**, à corriger |
| `tokens` | pas de `aidd_docs/ui` | rien | 0 | **muette**, à corriger |
| `impact <ref>` | pas de `aidd_docs/ui` | rien | 0 | **muette**, à corriger |
| `validate`, `tokens` | `aidd_docs/ui` vide | `T1 => write tokens.json by hand, or run node <engine> extract` | 1 | correction donnée |
| `impact <ref>` | ref inconnue | `no token or element named "<ref>"` | 2 | correction donnée |
| `extract` | pas de dossier, pas de `system.md`, `tokens.json` présent | message de refus, dont `--force replaces it` | 2 | correction donnée |
| `bump` | pas de dossier, id inconnu | refus nommant la cause | 2 | correction donnée |
| `bump --change` | refs déjà levées par la tâche | `changed: []`, `left` avec `why: already raised for this task` | 0 | dit pourquoi rien n'a changé |
| `publish` | aucune tâche non publiée | `no unpublished task, nothing to publish` | 2 | correction donnée |
| `publish <id>` | déjà validé | `raise its version with bump to change it` | 2 | correction donnée |
| `compare`, `keep` | pas de `variants.md` | `Write it, then run compare <set>.` | 2 | correction donnée |
| `tokens` relancé | rien n'a changé | le chemin de `tokens.css` | 0 | sortie présente |
| sans commande, commande inconnue | - | usage de `help` et liste, sur stderr | 2 | correction donnée |
| `hook` | entrée vide, projet sans `aidd_docs/ui` | rien | 0 | **exempté** : contrat `0 always` de l'hôte, un plugin global se tait hors projet UI |

## Moteur

| # | Fichier | Coupe | Règle | Delta lignes | Garde et mutation |
| --- | --- | --- | --- | --- | --- |
| E1 | `lib/project.cjs`, `aidd-ui.cjs`, `lib/bump.cjs`, `lib/extract.cjs`, `lib/help.cjs` | Une fonction `required(root)` charge ou lève `Refusal(NO_UI_FOLDER)`. Elle remplace les cinq `if (project === null) throw` de `bump.cjs` et celui d'`extract.cjs`. `validate`, `tokens` et `impact` passent par `refusing` au lieu de `return EXIT_VALID`. `HELP` de `validate` et `tokens` gagne la sortie `REFUSED` ; celle d'`impact` nomme le cas | 2, 7 | ≈ −4 | la carte `runs` de `help.test.js` gagne un `2` pour `validate` et `tokens` sur une racine sans `aidd_docs/ui`. `impact` a déjà son `2` (ref inconnue) : un test à part dans `impact.test.js`. Mutation : remettre `return EXIT_VALID` dans chacune ; son test rougit |
| E2 | `lib/graph.cjs`, `lib/code.cjs` | Supprimer `reached`, `ownerOf`, `isShared`, `SHARED_FILES`, `SHARED_DIRS`, puis `codeOwner` (seul appelant : `ownerOf`) et les imports devenus inutiles. Réécrire l'en-tête de `graph.cjs` : plus de « after a write ». Aucun appelant en production : les deux imports ne prennent que `usages`, et la couverture marque `graph.cjs:33-40` jamais exécuté | 7 | ≈ −22 | le `describe("a write")` d'`impact.test.js` part avec, aucune garde ne reste |
| E4 | `lib/hook.cjs` | Supprimer les `try/catch` internes de `stateFolder` (75-76) et `writePairs` (122-123) : jamais couverts, entrée jamais observée (dossier temporaire non inscriptible). Le `catch` de `hook()` garde le code de sortie 0. Le hook parle avant d'écrire son état (`answer` avant `leaveTurn`, `continueTurn` avant `leaveBaseline`) : un état non inscriptible ne coûte jamais le retour ni le blocage du Stop | 7 | ≈ −6 | limite écrite ci-dessous |
| E5 | `lib/hook.cjs` | Garder le `catch` de `hook()` (329-330) : contrat `0 always` envers l'hôte. Lui donner un test si une entrée réelle fait lever `run()` ; sinon, limite écrite | 7 | 0 | mutation : retirer le `catch` ; le nouveau test rougit |
| E6 | `lib/css.cjs` | Garder `return text.length` (ligne 51, bloc jamais fermé) : un fichier en cours d'édition est réel, le hook le lit après chaque écriture. Ajouter le test | 7 | 0 | mutation : `return -1` ; le nouveau test rougit |

Règle 5, auditée : aucune liste par stack dans `lib/`. `SCRIPT_EXTENSIONS`, `STYLESHEET_EXTENSIONS`, `RAW_EXTENSIONS` et `SKIPPED_EXTENSIONS` disent quels formats le moteur sait lire ; `SKIPPED_EXTENSIONS` a son test, et `holdsNul` ne remplace pas une liste de fichiers texte. Rien à couper.

## Skills

| # | Fichier | Coupe ou déplacement | Règle | Delta mots |
| --- | --- | --- | --- | --- |
| S1 | les quatre `SKILL.md` | `Run every command from the project root, the working directory.` devient `Run the engine from the project root; never read its source.` Après E1, le moteur dit lui-même quand la racine est fausse | 1, 2 | +4 |
| S2 | les quatre `SKILL.md` | Ajouter `After asking, wait for the answer.` sous `Speak only to ask…`, comme le modèle | 8 | +24 |
| S3 | `02-brand/SKILL.md` | Le routeur n'a pas de nœud `user` à `choose`, alors que `choose` attend le retour de la personne. Ajouter `choose -->\|"give the page, wait"\| user` et `user --> choose` | 8 | +8 |
| S4 | `03-foundations/actions/02-write.md` étape 2, `04-components/actions/02-write.md` étape 3 | Ajouter la sous-étape `Give the user the page, and wait for the feedback.` entre compare et keep | 8 | +20 |
| S5 | `03-foundations/references/reply.md`, `04-components/references/reply.md` | Supprimer ; leurs lignes deviennent les puces de l'étape 5 de `03-conclude.md`, comme le font déjà 01 et 02. La ligne `that the user publishes each per [engine](…)` passe telle quelle, lien ajusté. Le test « end saying the user validates » lit `actions/03-conclude.md` | 4 | ≈ −36 |
| S6 | `02-brand/references/variants.md` | Supprimer `Its folder holds variants.md…` et `A rating runs from 1 to 5…` : `help compare` les dit. Les autres puces de `## Feedback` passent sous l'étape 4 de `03-choose.md` | 4, 5 | ≈ −20 |
| S7 | `03-foundations/references/variants.md`, `04-components/references/variants.md` | « mirrors `aidd_docs/ui/` » sort : `help compare` le dit. En 04, la phrase d'ouverture répète la puce `It holds the record and the render, side by side.`, une seule reste. `## Feedback` passe dans la sous-étape variantes de `02-write.md` | 4, 5 | ≈ −15 |
| S8 | `03-foundations/references/tokens.md` | Supprimer les lignes `breakpoint media query`, `tokens.resolver.json`, `tokens.css` : ce que le moteur écrit et lit, déjà exclu par la ligne `Write only` | 5 | ≈ −46 |
| S9 | `04-components/references/elements.md` | Supprimer la ligne `## Keyboard` : le commentaire du modèle de composant la porte, là où elle s'applique | 4 | −6 |
| S10 | `03-foundations/references/extraction.md` | Retirer `Listed as a warning.` de la ligne colour literal : sévérité du moteur | 5 | −4 |
| S11 | lignes « per [x] » sans moteur | `Name the case per [cases]` (étape 2 des quatre `01-prepare.md`) devient « Name the case », le lien posé sur `case`. De même `read it per [extraction]` (03 et 04 write 1) et `Deprecate per [versions]` (04 write 4) | 3 | ≈ −6 |

## Ne pas toucher

- **`host.cjs`** : contrat avec les adaptateurs `cli/assets/hooks-runtime/host-*.cjs`, qui le remplacent par hôte. Sa branche `level === 2` reste.

- **Règle 6, lignes d'invocation, mot pour mot** :
  - 01-journeys : prepare 1, write 3 et 4, conclude 1, 3 et 5.
  - 02-brand : prepare 1, propose 4 et sa sous-étape, choose 5, conclude 1, 3 et 4.
  - 03-foundations : prepare 1, la sous-étape « Measure… » de prepare 6, les sous-étapes compare et keep de write 2, write 4, 5, 7 et 8, conclude 1, 3 et 4 avec ses puces.
  - 04-components : prepare 1, la sous-étape « Measure… » de prepare 5, write 2, les sous-étapes compare et keep de write 3, write 5 et 6, conclude 1, 3 et 4 avec ses puces.
  - Chaque ligne d'étape et chaque cellule de commande des quatre `references/engine.md`.
  - La règle 6 prime sur la règle 3 : ces lignes gardent leur « per [engine] ».
- **Gardes de structure de `skill.test.js`** :
  - la table `WHAT` relie chaque ligne d'`engine.md` au verbe de son étape (`/Validate/` est sensible à la casse) ;
  - une seule ligne `Write only` par skill ;
  - douze mots par phrase au plus ;
  - aucune commande ni drapeau dans une action ;
  - l'en-tête de la table d'installation ;
  - aucun fichier de référence en double.
- **Couplage avec le pilote** : la carte `OWNED` de `scripts/aidd-ui-pilot.cjs` recopie chaque ligne `Write only`. Ces lignes ne bougent pas.
- **Table d'installation** répétée dans les quatre `engine.md` : un skill ne lie rien hors de son dossier, l'en-tête est testé. Dédoublonner serait sans gain (règle 9).
- **`need not exist` des trois `01-prepare.md`** : redit l'aide de `bump`, mais le modèle en a besoin avant tout appel, et un test l'exige (règle 4).
- **`common-rules.cjs`** : copie partagée.
- **Gardes existantes** : chacune garde sa mutation. E1, E5 et E6 en ajoutent une.

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| regression | moyen : `validate`, `tokens` et `impact` sortent en 2 hors projet UI, au lieu de 0 en silence. Aucun appelant hors tests ne compte sur ce 0 : `hooks.json` n'appelle que `hook`, le pilote ne valide qu'après une étape | E1 |
| tests | `help.test.js` (carte `runs`), `impact.test.js` (bloc « a write »), `skill.test.js` (chemin de `reply.md`) | E1, E2, S5 |
| catalogue | `plugins/aidd-ui/CATALOG.md` liste les deux `reply.md` ; le pre-commit le régénère | S5 |
| pilote | le prompt non interactif du pilote répond à la place de la personne ; les arrêts S2 à S4 ne le bloquent pas | S2 à S4 |

## Accepted limits

- Dossier temporaire non inscriptible : le retour et le blocage du Stop sortent quand même (E4), l'état n'est simplement pas gardé. Jamais observé.
- Les arrêts interactifs (S2 à S4) ne sont pas prouvés par le pilote, qui tourne sans personne. Une passe à la main avec Haiku le prouverait.
- Les coupes S5 à S10 retirent des rappels. Si le pilote montre une dérive sur une ligne coupée, la ligne revient (règle 9).

## Done when

1. Mots des skills, sans `|`, sous 4990. Non tenu : 5047. La revue a remis trois consignes dont une étape suivante avait besoin, et deux sous-étapes de retour. Mesure : `find plugins/aidd-ui/skills -name '*.md' | xargs cat | tr -d '|' | wc -w`.
2. Lignes du moteur, hors copie partagée, sous 4400 (commande de la mesure de départ).
3. `node <engine> validate`, `tokens` et `impact x` lancés hors projet UI sortent en 2 avec le message `no aidd_docs/ui folder at this root`.
4. Chaque mutation de E1, E5 et E6 rougit son propre test, puis est annulée.
5. Suite des scripts verte : `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`.
6. Pre-commit vert : `pnpm exec lefthook run pre-commit`.
7. Une passe pilote : `node scripts/aidd-ui-pilot.cjs --gouvernail <checkout> --kairos <checkout> --only blank`. Les deux checkouts restent exigés même avec `--only blank`. Chaque étape affiche `steps ok`, `errors none`, `code untouched`. Le pilote efface lui-même ses chats.

## Résultat

- Moteur : 4381 lignes. Hors projet UI, `validate`, `tokens` et `impact` sortent en 2.
- Pilote vierge, deux passes : `steps ok`, `errors none`, `code untouched`. Warnings `none` puis `V6`, selon les choix du modèle.
- Suite des scripts : 1649 tests, 0 échec. Pre-commit vert.
