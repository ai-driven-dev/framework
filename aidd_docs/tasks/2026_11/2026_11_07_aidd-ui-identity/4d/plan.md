---
objective: "La revue se fait dans la vitrine. OK ou à revoir par état et par version, copiés vers l'IA. Un écran codé se juge à côté de sa capture réelle, puis se publie."
status: todo
---

# Plan : aidd-ui 4d et 4e, revue dans la vitrine

Remplace l'ancien plan 4d : plus de commande `review`, plus de `drafts/review.html`. La vitrine (4e) porte la revue (4d). Une page par fiche : élément, wireframe, écran.

## Phases

| #   | Phase | Depends on |
| --- | ----- | ---------- |
| 1   | Moteur : verdicts `ok` et `revise`, commentaire exigé | none |
| 2   | Moteur : un écran se publie ; capture exigée s'il est codé à sa version | 1 |
| 3   | `page.cjs` : exports seuls | none |
| 4   | Moteur : commande `showcase`, accueil et une page par fiche | 3 |
| 5   | Moteur : revue dans la page d'une fiche | 1, 2, 4 |
| 6   | Skills : `06-review`, publication hors de 03 et 04, `showcase` en fin de skill, `code` dans 05 | 5 |
| 7   | Specs : 4d, 4e et le contrat d'octobre | none |
| 8   | Pilote, `run-4d.md`, gates | 6, 7 |

- `help.cjs` est touché par 1, 2 et 4 : ces phases passent en série.
- Phase 3 seule touche `page.cjs`. Elle attend la fusion de l'autre branche.
- Phase 7, texte seul, court en parallèle de tout.

## Données réelles observées

Lues sur les copies des pilotes Gouvernail, Kairos et vierge. Jamais recopiées dans les fixtures.

- Gouvernail : 8 écrans, tous avec `route`, aucun avec `code`. `platforms: [web]`.
- Kairos : 9 écrans, tous avec `route`, aucun avec `code`. `platforms: [mobile]`.
- Vierge : 6 écrans avec `route`. `platforms: [web, mobile]`, `code-roots: []`.
- Aucun écran ne porte de clé `platforms`. Aucune revue, aucune capture.
- États par écran : 1 à 3 sur Gouvernail, 1 à 4 sur Kairos.
- Kairos : 25 états d'écran au total, pas 36. Ses 9 wireframes en ajoutent 25.
- Gouvernail : 15 états d'écran, 15 de wireframe.
- Kairos : 18 fiches écran et wireframe, toutes `proposed`.
- Routes résolues en fichier : 12 sur 17. Kairos 5 sur 9, Gouvernail 7 sur 8.
- Sans fichier littéral : `/agon/result/[duelId]` face à `agon/results.tsx`, `/trainings/$trainingId/termes`.
- Kairos range ses routes sous un segment de groupe `(app)`, absent de la route.
- Kairos : `/agon/waiting/[duelId]` donne `apps/mobile/app/(app)/agon/waiting/[duelId].tsx`.
- Gouvernail : `/admin/accounts/$accountId/accreditation` donne `src/routes/admin/accounts/$accountId/accreditation.tsx`.
- Ces chemins portent `(`, `)`, `[`, `]` et `$`.
- La plupart des écrans sont donc codés. L'ancien plan disait le contraire : faux.
- Un écran sans fichier trouvé reste non codé : aucune capture exigée.
- Cause : `05-screens` ne remplit jamais `code`. Ni `screens.md` ni le gabarit n'ont la clé.
- Aujourd'hui `publish` ne couvre qu'élément et wireframe : `isReviewed` exclut l'écran.

## Phase 1 : verdicts

- `VERDICTS` de `records.cjs` devient `["ok", "revise", "pending"]`.
- `pending` reste la valeur que `bump` écrit. Jamais proposée à la personne.
- `ko` devient une erreur R13, sans migration. Aucune revue réelle ne l'utilise.
- Nouvelle garde R13 : une ligne `revise` au commentaire vide est une erreur.
- Valeurs stockées : `ok` et `revise`, clés fixes, sans langue.
- Libellés affichés dans la langue de la personne, lue dans sa mémoire.
- `help.cjs` et le registre `FIXES` suivent.
- Tests tenant `ko` réécrits : `records.test.js`, `publish.test.js`.

| Cas | Mutation qui le rougit |
| --- | --- |
| `revise` accepté | retirer `revise` de `VERDICTS` |
| `ko` refusé | garder `ko` dans `VERDICTS` |
| `revise` sans commentaire refusé | retirer la garde du commentaire |
| `ok` sans commentaire accepté | exiger un commentaire pour tout verdict |
| `pending` sans commentaire accepté | étendre la garde à `pending` |

## Phase 2 : publier un écran, capture comprise

- `isReviewed` couvre l'écran : élément, wireframe ou écran.
- H6 et H8 s'appliquent donc à l'écran validé. Message H8 inchangé.
- Capture : `screens/<id>.<état>@<version>.png`, à côté de la fiche.
- PNG seul. Aucun axe plateforme : un seul observé par projet réel.
- Exigée seulement si le lien `code` de l'écran est à la version de la fiche.
- Sinon une refonte ne pourrait jamais se valider avant que le code suive.
- Un seul endroit : le refus de `publish` dans `bump.cjs`, près de `unreviewedState`.
- Un `ok` compte, pour un écran codé à sa version, seulement avec sa capture.
- Refus : `<id>: <état> has no capture at screens/<id>.<état>@<version>.png`.
- Aucune nouvelle règle de `validate` : la capture manque avant la revue, c'est normal.
- La capture reste hors de l'empreinte : la changer ne relève pas la version.
- `load` ignore déjà tout sauf `.md` et `.html` : test pour le figer sur `.png`.
- Le même test vérifie que `validate` ne signale rien pour ce `.png`.

| Cas | Mutation qui le rougit |
| --- | --- |
| écran tout `ok`, non codé : publié | exiger la capture sans `code` |
| écran codé à sa version, capture absente : refusé | retirer la garde capture |
| écran codé à sa version, capture présente : publié | chercher sans `@<version>` |
| capture d'une ancienne version seule : refusé | ignorer la version du nom |
| écran codé à une version antérieure : publié sans capture | comparer sans la version du lien |
| un `.png` dans `screens/` n'est pas une fiche, `validate` muet | lire tout fichier comme fiche |
| écran `revise` sur un état : refusé | compter tout verdict comme `ok` |

## Phase 3 : `page.cjs`, exports seuls

- Seul changement : élargir `module.exports`.
- Ajoutés : `STYLE`, `escaped`, `options`, `documentOf`, `frameOf`, `STYLESHEET_LINK`.
- Aucune ligne de logique modifiée. `drafts.test.js` intact.
- Testé par la vitrine, phase 4 : aucun test propre à cette phase.
- Coordination : attendre la fusion de la branche qui tient `page.cjs`.

## Phase 4 : vitrine

- `showcase.cjs`, pur : reçoit le projet, les problèmes et les tokens, rend des pages.
- Branché dans `COMMANDS` d'`aidd-ui.cjs`, `cli.cjs` et `help.cjs`.
- Écrit `aidd_docs/ui/showcase/`, réécrit en entier, avec `showcase/.gitignore` à `*`.
- `index.html` plus une page par fiche, nommée par son `id`.
- Navigation dans l'ordre des chemins : marque et système, composants par niveau, parcours, templates, pages.
- Templates : wireframes. Pages : écrans.
- Liens « utilise » et « utilisé par », lus par `graph.cjs`.
- `proposed` marqué. `code` et `route` en puces.
- Bascules thème et plateforme. Deux combinaisons côte à côte.
- Habillage neutre de `STYLE`. Rendus en iframe via `frameOf`.
- Déterministe : tri stable, aucune date, aucun hasard.
- `showcase/` est déjà sauté par `load` : aucun changement de hook.

| Cas | Mutation qui le rougit |
| --- | --- |
| chaque fiche atteignable depuis l'accueil | omettre une famille de la navigation |
| wireframe sous templates, écran sous pages | classer par `kind` brut |
| « utilisé par » liste qui cite la fiche | ne lire que `uses` |
| `proposed` marqué | ne marquer aucun statut |
| deux générations identiques à l'octet | ajouter l'heure dans la page |
| une page retirée quand sa fiche disparaît | écrire sans vider le dossier |

## Phase 5 : revue dans la page d'une fiche

Sur chaque page d'élément, wireframe ou écran :

- Le rendu par état. Pour un écran codé, la capture à côté.
- Capture absente : un cadre nomme le chemin à enregistrer.
- Par état : OK ou à revoir. À revoir exige un commentaire, sinon la copie est bloquée.
- Libellés de la page : une table par langue, `en` et `fr`, `en` par défaut.
- `showcase --lang <code>` choisit la table ; le skill la lit en mémoire.
- Les verdicts déjà posés à la version courante sont affichés.
- Un verdict plus ancien s'affiche « ancien, vN ». Il ne compte pas.
- États `pending` ou sans verdict en premier.
- Contrôles du moteur : `problemsOf` filtré sur la fiche et ses rendus.
- Une copie par page, tous les états : bloc `json`.
- Forme : `{"record", "version", "verdicts": [{"state", "verdict", "comment"}]}`.
- Presse-papiers comme la page compare. Page `file://` statique, aucun serveur, aucun réseau.
- Aucun `localStorage` : il ne suit pas d'une page `file://` à l'autre.
- Le script client est propre à la vitrine : isolement d'état, mise à l'échelle, copie.
- Compare garde Keep, Revise, Discard. Sa note de 1 à 5 reste hors périmètre.

Fatigue, la plus petite parade :

- Une copie par fiche, pas par état : 9 collages pour les écrans Kairos, pas 25.
- Les états sans verdict d'abord ; une revue partielle reste permise par le contrat.
- Les clics par état restent : limite acceptée.

| Cas | Mutation qui le rougit |
| --- | --- |
| état `ok` à la version courante affiché `ok` | ignorer la version |
| verdict ancien affiché « ancien » | afficher tout verdict |
| écran codé : capture à côté du rendu | ne jamais lire la capture |
| capture absente : chemin nommé | taire l'absence |
| problème d'une autre fiche absent de la page | ne pas filtrer `problemsOf` |
| états sans verdict d'abord | garder l'ordre de la fiche |
| page sans fiche revue : aucun bloc de verdict | rendre les verdicts partout |

Le blocage de copie sans commentaire est client, non testé. R13 rattrape un verdict `revise` muet à l'écriture.

## Phase 6 : skills

Nouveau skill `06-review`. Pourquoi un skill et pas un pli :

- L'amendement de `spec.md` liste déjà `06-review`.
- Un auteur par sorte de fiche : la revue est une fiche, `reviews/`.
- 03, 04 et 05 créent ; aucun ne juge le travail d'un autre.
- Ordre des actions comme les autres skills : prepare, propose, choose, write, conclude.
- La fiche de revue s'écrit une fois, après les collages : aucune ligne `pending` à poser.

Actions, chaque phrase en douze mots au plus :

| Action | Fait |
| --- | --- |
| `01-prepare` | fiches `proposed` avec rendu ; périmètre choisi ; chemins de capture à enregistrer |
| `02-propose` | lance `showcase`, donne les pages, attend les collages |
| `03-choose` | lit chaque collage ; un `revise` renvoie au skill créateur |
| `04-write` | fiche de revue depuis le gabarit, verdicts collés, `bump --created` |
| `05-conclude` | `publish <id>` pour chaque fiche toute OK, `validate`, `showcase` |

Publication hors de 03 et 04 :

- Retirer la ligne `publish <id>` de leur `engine.md`.
- Réécrire l'étape 3 de conclude : la revue publie.
- Finir par « `proposed` until its review ».
- `skill.test.js` 356-361 suit ces lignes.

Fin de chaque skill :

- Chaque conclude gagne une étape `showcase`. Cinq `engine.md`.
- `WHAT` : ligne `[/^node <engine> showcase\b/, /showcase/]`. `HELP` : entrée `showcase`.
- `showcase/` dans chaque entrée `ENGINE_FILES` du pilote.

`05-screens` lie `code` :

- Ligne `code` dans `screens.md` : `the route's file, linked at the screen's version`.
- Clé `code` dans `screen-template.md`.
- C1 vérifie déjà le fichier et la version. Aucun code moteur.
- Test : `parseLink` lit `(`, `)`, `[`, `]` et `$`, fixture synthétique.

Manifeste :

- `plugin.json` : `skills` liste 01 à 06.
- Description : « or for reviews » devient « or for code reviews ».
- `FOLDERS`, `OWNER` et la liste des skills de `skill.test.js` suivent.
- Aucun skill nommé dans un autre, aucun lien hors de son dossier.

## Phase 7 : specs

- `spec.md`, 4d : la page de revue est la vitrine. Verdicts `ok` et `revise`, libellés dans la langue de la personne.
- `spec.md`, 4d : capture exigée quand `code` est à la version de l'écran.
- `spec.md`, 4e : la vitrine porte la revue ; plus de page à part.
- `spec.md`, 4d : capture `screens/<id>.<état>@<version>.png`, PNG, sans axe plateforme.
- Contrat d'octobre, section Review : la page de revue est la vitrine. Rien d'autre.

## Phase 8 : preuve

- Un seul pilote : `node scripts/aidd-ui-pilot.cjs --only blank`, puis `--only kairos`.
- `CHAIN` gagne `["06-review", "review"]`. `OWNED` gagne `reviews/`. `pilot.test.js` suit.
- `REQUESTS` gagne une part `review` par pilote. Elle porte les verdicts.
- Vierge : « every state OK ». Kairos : idem, sans capture fournie.
- Même voie que le choix de compare aujourd'hui : la requête tient lieu de collage.
- `reportLine` ajoute : fiches validées, vitrine atteignable, deux générations identiques.
- Done-when vierge : un écran et son wireframe revus OK, publiés, `validated`.
- Verdict d'une version plus ancienne : prouvé par les tests des phases 2 et 5, pas par le pilote.
- Done-when Kairos : wireframe validé. Écran codé refusé, message capture.
- Haiku ne capture pas : ce refus est le résultat attendu.
- Done-when : chaque fiche atteignable depuis l'accueil ; deux générations identiques.
- `run-4d.md` : sortie, comptes, refus capture, mutations.
- Gates : suite enveloppée, `pnpm exec lefthook run pre-commit`.

## Rules

| Rule | Why it applies |
| --- | --- |
| test d'abord, chaque garde avec la mutation qui rougit son propre test | verdict, commentaire, capture et vitrine sont des gardes |
| aucun code pour une entrée jamais observée | plateforme de capture, format autre que PNG : limites |
| fixtures aux valeurs synthétiques | jamais un chemin ou une couleur d'un projet client |
| skill : douze mots par phrase, aucun autre skill nommé, aucun lien sortant | tests de structure existants |
| suite des scripts toujours enveloppée | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` |
| un seul pilote, à la fin : vierge puis Kairos | `claude -p` tourne avec `--no-session-persistence`, aucun chat à supprimer |
| Sonnet implémente, Haiku vérifie | modèles des agents |
| `page.cjs` : exports seuls, phase 3 seule | une autre branche le tient |

## Decisions

| Decision | Why |
| --- | --- |
| Revue dans la vitrine, pas de page à part | une page par fiche existe déjà ; une seconde dupliquerait rendu et navigation |
| Stocké `ok` et `revise` | `ok` déjà lu par le moteur ; `revise` dit déjà « changement demandé » sur compare |
| Libellés affichés dans la langue de la personne, lue en mémoire | décision de l'utilisateur : la langue dépend de sa mémoire, pas du plugin |
| Tables `en` et `fr` seules | les deux langues observées : plugin et utilisateur |
| `ko` en erreur, sans migration | aucune revue réelle ; précédent `composition` |
| Commentaire exigé sur `revise`, par R13 | un verdict à revoir muet ne dit pas quoi changer |
| Capture à côté de la fiche, version dans le nom | le contrat d'octobre la pose à côté avec sa version |
| Capture exigée seulement au `code` de même version | sinon une refonte ne se valide jamais avant le code |
| Contrat « par plateforme » resserré : aucun axe plateforme | un projet codé n'a qu'une plateforme ; le vierge en a deux mais aucun code |
| Garde capture au refus de `publish`, pas dans `validate` | seul moment où la capture compte ; aucune erreur pendant le travail |
| Capture hors de l'empreinte | une nouvelle prise ne change pas la fiche |
| Une copie par fiche | fatigue : 9 collages Kairos au lieu de 25 |
| `06-review`, pas un pli dans 05 | une fiche, un auteur ; la spec le liste déjà |
| Publication retirée de 03 et 04 | la revue publie ; deux voies feraient double emploi |
| `showcase.cjs` neuf, `page.cjs` exporte seulement | `page.cjs` tenu ailleurs ; la base reste commune |
| Aucun serveur ni stockage | page `file://` statique, comme compare |

## Accepted limits

- Un clic par état reste : Kairos, 25 pour les écrans, 25 pour les wireframes.
- Écran validé en vN quand son `code` est plus ancien : jamais confronté à sa capture ensuite.
- Une route sans fichier littéral n'est pas liée : la personne nomme le fichier, ou l'écran reste non codé.
- Aucun axe plateforme sur la capture : un seul observé par projet réel.
- PNG seul.
- aidd-ui ne lance jamais l'app : la personne fournit chaque capture.
- La capture n'est pas comparée au rendu : la personne juge.
- Une capture d'un état ancien n'est pas détectée si son nom porte la bonne version.
- Le blocage sans commentaire est client ; R13 le rattrape à l'écriture.
- Aucun brouillon de verdict gardé entre deux pages.
- La note de 1 à 5 de compare reste hors périmètre.
- Compare garde ses libellés anglais : `page.cjs` tenu ailleurs, traduit après sa fusion.
- Une autre langue que `en` ou `fr` tombe sur `en`.
- Le pilote simule les collages : la lecture humaine des pages n'est pas mesurée.
