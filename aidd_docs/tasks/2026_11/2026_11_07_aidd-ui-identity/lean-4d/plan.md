---
objective: "Après 4d, les six skills et leur moteur repassent en lean. Cinq défauts vus au pilote 4d sont corrigés, chacun par un test écrit d'abord : lien `code` des écrans, nom et statut de la revue, mesures du pilote, « Tout OK » sur l'accueil."
status: done
---

# Plan : passe lean après 4d, et correctifs du pilote

Méthode : celle du [plan lean](../lean/plan.md), règles 1 à 9. Aucune coupe sans l'une d'elles (règle 9). Contexte : [plan 4d](../4d/plan.md), [run 4d](../4d/run-4d.md), [spec.md](../spec.md).

## Mesure de départ

| Mesure | Commande | Avant | Après visé |
| --- | --- | --- | --- |
| mots des skills, sans `\|` | `find plugins/aidd-ui/skills -name '*.md' \| xargs cat \| tr -d '\|' \| wc -w` | 7345 | ≤ 7350, ou ≤ 7260 avec O1 |
| lignes du moteur, hors copie partagée | `cat plugins/aidd-ui/hooks/aidd-ui.cjs $(ls plugins/aidd-ui/hooks/lib/*.cjs \| grep -v common-rules) \| wc -l` | 5545 | ≤ 5570 |

Les correctifs ajoutent du texte et du code : l'accueil prend environ 40 lignes, et les règles de route environ 45 mots. Les coupes compensent sans plus. Le gain visé est la justesse : un seul lecteur de verdicts, aucune sortie laissée à Haiku. Le volume vient après.

## Moteur

| # | Fichier | Coupe | Règle | Delta lignes | Garde et mutation |
| --- | --- | --- | --- | --- | --- |
| E0 | tous sauf `common-rules.cjs`, `host.cjs` | Lancer `node --test --experimental-test-coverage 'scripts/__tests__/aidd-ui/*.test.js'`. Chaque bloc jamais exécuté est soit coupé, soit muni d'un test | 7 | à mesurer | chaque bloc gardé reçoit un test et sa mutation |
| E1 | `lib/page.cjs` | Retirer `options` et `frameOf` de `module.exports` : aucun appelant, ni moteur ni test. Exports seuls, aucune logique touchée | 7 | 0 | aucune |
| E2 | `lib/model.cjs`, `lib/bump.cjs`, `lib/showcase.cjs`, `lib/records.cjs` | Les verdicts se lisent à un seul endroit : `verdictRows(project)` et `stateVerdict(rows, record, state)`, avec `REVIEW_KIND` et `VERDICTS_SECTION`, définis une fois dans `model.cjs`. Ils remplacent les trois `VERDICTS_SECTION`, les littéraux `"review"`, `rowsOf` et `verdictOf` de la vitrine et la lecture d'`unreviewedState` | 4 | ≈ −12 | voir F5 : le changement de priorité y a son test |
| E3 | `lib/showcase.cjs` | Renommer `isReviewed` en `hasRender` et `byId` en `byRecordId`. Dériver `LEVELS` de `model.cjs`. Trois noms masquaient un autre sens ailleurs | 4 | −1 | aucune |
| E4 | `lib/showcase.cjs` | `stateDocument` : supprimer la branche sans `</head>`. Les trois gabarits de rendu ont un `<head>` | 7 | 0 | aucune |
| E5 | `lib/bump.cjs` | Supprimer `withFingerprintColumn`. Aucun historique à cinq colonnes observé : les trois pilotes partent de rien, et le plugin est en alpha. Supprimer aussi le test `publish.test.js` « written before the Fingerprint column » | 7 | ≈ −7 | aucune ; le test de lecture de `records.test.js` reste |

## Skills

| # | Fichier | Coupe ou déplacement | Règle | Delta mots |
| --- | --- | --- | --- | --- |
| S1 | `06-review/actions/01-prepare.md`, `02-propose.md`, `05-conclude.md` | Supprimer l'étape 5 de prepare (langue, `en` ou `fr` sinon `en`), sa puce d'Output et « the language » en Input de propose. Propose 1 et conclude 5 disent « in the project memory's language », comme 01 à 05. Le repli sur `en` appartient au moteur (`languageOf`). Les étapes de prepare se renumérotent, et `engine.md` n'en cite aucune | 4, 5 | ≈ −25 |
| S2 | `06-review/actions/02-propose.md` | Supprimer « The user saves it: the engine never runs the app. » : la règle transversale « Never write a capture » le dit | 4 | −10 |
| S3 | `06-review/references/review.md` | Supprimer la ligne `pending` (choose 1 dit déjà de demander) et `written once` (titre de write). Fusionner `Screen`, `Version`, `Verdict` et `Comment` en une ligne « as pasted » | 4 | ≈ −25 |
| S4 | `06-review/SKILL.md` | Supprimer « Every path written in a record starts there. » : une revue n'écrit aucun chemin | 4 | −8 |
| O1 | `01` à `05`, `actions/*conclude.md` et `references/engine.md` | **Option, décision de l'utilisateur.** Retirer l'étape `showcase` des cinq conclude et ses cinq lignes : `06-review` propose 1 la réécrit de toute façon. Ce choix défait une décision de 4d (vitrine à jour après chaque skill). Il touche aussi `ENGINE_FILES` du pilote pour 01 à 05 et le test « lets every step leave the showcase ». Par défaut, non retenue : règle 6 | 6 | ≈ −90 |

## Correctifs, test d'abord

| # | Défaut vu | Changement | Test écrit d'abord | Mutation qui le rougit |
| --- | --- | --- | --- | --- |
| F1 (a) | 05 laisse `code` vide : « I did not trace the route files' exports » | `screens.md` : `code` devient `the route's file, as path#Export@version, at the screen's version`. Lignes ajoutées : `route file` (search it before writing: the route mirrors the file path) ; `folder in parentheses` (a group: the route leaves it out) ; `re-export` (`export { default } from …` counts: link `path#default@version`) ; `no file found` (only after that search: leave `code` out, say why). Commentaire du gabarit : « Delete the `code` line only when no file answers the route. » Puce de reply dans conclude : « each screen left without `code`, and why » | aucune garde de texte. Prouvé par le pilote : `coded` mesuré par F4 | - |
| F1 bis | avertissement moteur, écran à `route` sans `code` | **Non retenu.** C3 nomme déjà chaque fichier de route non lié. Et 5 routes sur 17 n'ont pas de fichier littéral : un avertissement resterait à vie sur des écrans à bon droit sans code | - | - |
| F2 (b) | revue nommée `review-<date>` | Ligne `id` de `review.md` : `what the round reviewed, then -review: screens-review`. Puis `taken: add -2, then -3` et `never a date`. Jamais l'id d'une fiche revue : R4 exige des ids uniques | `pilot.test.js` : `reviewIds` signale un id daté | rendre `[]` toujours |
| F3 (c) | la revue reste `proposed` | Gabarit et ligne `status, version` : `validated` et `1`, car les verdicts sont ceux de la personne. R16 accepte déjà `validated`. H8 et H6 ne lisent que `isReviewed` (élément, écran, wireframe), jamais une revue. Une ligne `pending` ajoutée par `bump` ne viole aucune règle. Les fixtures `proposed` restent valides | `skill.test.js` « validates once filled » vérifie `status: validated` dans le gabarit rempli | remettre `proposed` dans le gabarit |
| F4 (d) | `reportLine` ne mesure ni publication, ni vitrine | `aidd-ui-pilot.cjs`, après le dernier instantané : `published V/T` (fiches `validated` parmi les `isReviewed` à états, pour info) ; `coded N/M` (écrans à `route` qui ont un `code`, pour info) ; `showcase reachable` ou `unreached N` ; `stable` ou `unstable` ; `review ids clean` ou `dated N`. `stable` régénère deux fois avec le `lang` du `<html>` de l'`index.html` existant, puis compare les instantanés de `showcase/`. Pages hors d'atteinte, instable ou id daté : sortie 1 | `pilot.test.js` : les deux lignes de `reportLine` réécrites ; `published` sur la fixture ; une page retirée de l'index est nommée ; un `run` qui écrit deux contenus différents donne `unstable` | compter toute fiche ; rendre `[]` pour les pages ; rendre `stable` toujours |
| F5 (e) | 55 collages sur Kairos | Voir la section suivante | voir la section suivante | voir la section suivante |

## F5 : « Tout OK » sur l'accueil

Priorité des verdicts, un seul prédicat (E2), lu par `publish` et par la vitrine. À la version de la fiche : un `revise` l'emporte, puis un `ok`, puis `pending`, puis rien.

Aujourd'hui, n'importe quelle ligne `ok` publie : un « Tout OK » de l'accueil effacerait un `revise` voulu. Deux parades :

- Moteur : un `revise` à la version bloque la publication. Une fiche avec un `revise` à sa version ne figure pas dans la liste de l'accueil.
- Skill : `06-review` choose 1 gagne « A paste may list several records. » et « A record's own page paste wins over the home page's. »
- Propose 2 gagne « Give the home page first: it copies each record listed as OK. » et « A record to revise is judged on its own page. »

Contrat DOM de `index.html`. Sortie déterministe : fiches triées par id, états dans l'ordre de la fiche.

```html
<section class="batch" data-records="N">
  <h2>{batch}</h2><p>{batchHint}</p>
  <ul><li data-record="id" data-version="v" data-states='["etat"]'>
    <label><input type="checkbox" checked> <a href="id.html">id</a></label></li></ul>
  <button type="button" id="copy-all" data-copied="{copied}">{allOk}</button><span id="note" role="status"></span>
</section>
```

- Fiche listée : elle a des états et un rendu. Au moins un état n'est pas `ok` à sa version, et aucun n'est `revise`.
- `data-states` liste seulement ces états-là.
- Aucune fiche : ni section `batch`, ni script sur l'accueil.
- Copie : un bloc `json`, liste des objets de la page d'une fiche. Chaque objet vaut `{record, version, verdicts: [{state, verdict: "ok", comment: ""}]}`. Une case décochée est omise. Aucune case cochée : le bouton est désactivé.
- Le script de l'accueil est séparé : `SCRIPT` appelle `review.querySelectorAll` sans garde et lèverait sur l'accueil.
- La copie et son repli en `textarea` deviennent un fragment commun aux deux scripts. Aucun stockage navigateur.
- Libellés `en` et `fr` ajoutés aux deux tables `LABELS`. `batch` : « Still to review » et « Encore à juger ». `batchHint` : « Uncheck a record to review it on its page. » et « Décochez une fiche pour la juger sur sa page. » `allOk` : « All OK, copy » et « Tout OK, copier ».
- La requête `REVIEW` du pilote devient « pasted from the home page: All OK for every record listed ».

| Cas, `showcase.test.js` sauf mention | Mutation qui le rougit |
| --- | --- |
| état sans verdict listé, case cochée ; `data-states` sans l'état déjà `ok` | lister tous les états |
| fiche toute `ok` à sa version : absente | retirer le filtre |
| un `revise` à la version : fiche absente | ignorer `revise` |
| `ok` d'une version plus ancienne seul : listée | comparer sans la version |
| rien à juger : ni `batch` ni `<script>` sur l'accueil | toujours rendre la section |
| `--lang fr` : « Tout OK, copier » | prendre `LABELS.en` |
| `publish.test.js` : `ok` et `revise` au même état et à la version : refusé | « un `ok` suffit », comme aujourd'hui |
| vitrine : `ok` puis `revise` à la version, affiché `revise` | garder la dernière ligne non `pending` |

## Ne pas toucher

- **Règle 6** : chaque ligne d'invocation et chaque cellule de commande des six `engine.md`. Cela inclut l'étape `showcase` de chaque conclude, sauf si O1 est retenue.
- **Gardes de `skill.test.js`** : `WHAT`, une seule ligne `Write only`, douze mots par phrase, aucune commande dans une action, table d'installation, aucune référence en double.
- **Pilote** : la carte `OWNED` recopie chaque ligne `Write only`.
- **Points d'appui des tests** : `HEADER`, `pathsOf`, les `*_LINE`, `LABELS`, `feedbackOf` et `copiedOf`. Exports lus par les tests.
- **`page.cjs`** : exports seuls (E1). Le `localStorage` de compare reste hors de la vitrine.
- **`common-rules.cjs`** (copie partagée), **`host.cjs`** (contrat des adaptateurs) et **C3** (couvre déjà les routes non liées).
- **Gardes existantes** : chacune garde sa mutation.

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| regression | moyen : un `revise` à la version bloque désormais `publish`, même à côté d'un `ok`. Aucune revue réelle ne porte de `revise` | F5 |
| regression | faible : un historique à cinq colonnes ne gagne plus sa colonne. Jamais observé | E5 |
| tests | `publish.test.js`, `showcase.test.js`, `skill.test.js` (gabarit de revue), `pilot.test.js` (`reportLine`, `REQUESTS`) | E2, E5, F3 à F5 |
| pilote Kairos | les écrans liés à leur version sont refusés faute de capture : moins de 55 fiches publiées, ce qui est attendu | F1, F4 |

## Accepted limits

- Le blocage de la copie sans case cochée, et le repli, sont côté client. Prouvés par Playwright seulement.
- Une route sans fichier littéral, comme `[duelId]` face à `results.tsx`, reste sans `code`. La reply le dit.
- `-2` et `-3` comptent les tours, sans dire quand. Voulu : aucune date.
- Un `revise` reste à sa version : changer d'avis sans correctif demande une montée de version.
- Le pilote simule le collage de l'accueil : la lecture humaine n'est pas mesurée.
- Si le pilote montre une dérive sur une ligne coupée par S1 à S4, la ligne revient (règle 9).

## Révision après challenge

Un challenge du parcours entier a trouvé trois cassures. Elles passent avant F5. Ce qui suit remplace F1 et F5 là où ils divergent.

- **Cassure A, capture trop tôt.** F1 lie `code@1` dès qu'un fichier de route existe. La publication exige alors des captures d'une app qui n'implémente pas ce design. La spec dit : le lien porte la version que le code implémente.
- **Cassure B, écran renvoyé sans issue.** 05 n'a ni cas `change`, ni `bump --change`. Un `revise` sur un écran n'a aucun chemin de correction.
- **Cassure C, commentaires perdus.** Aucun skill ne lit les lignes `revise` comme demande. La personne les retape.

| # | Changement | Test écrit d'abord | Mutation |
| --- | --- | --- | --- |
| F1' | `screens.md` : lier `code` seulement si l'écran décrit ce que l'app montre aujourd'hui. Écran neuf ou refondu : pas de `code`, C3 avertit. La règle « la route reflète le chemin du fichier » vaut pour un routeur à fichiers ; sinon demander. Corrige le texte de `254d00ffa` | aucune garde de texte ; le pilote mesure `coded` | - |
| F6 | 05 gagne le cas `change` : une revue porte un `revise` à la version d'un écran. Son commentaire est la demande. Écriture, puis `bump --change`, comme 04. 01 (wireframes) et 04 (composants) lisent aussi les `revise` de leurs fiches comme demande de `change` | `skill.test.js` : la table `cases.md` de 05 a une ligne `change`, et son `engine.md` une commande `bump --task <task folder> --change` | retirer la ligne `change` |
| E2' | E2 tel quel, avec la règle : un `revise` à la version bloque la publication. Cohérent maintenant : F6 donne le chemin de correction, qui monte la version | voir F5 | voir F5 |
| F5' | Accueil : cases cochées par défaut. Une fiche y figure si elle a des états et un rendu, si aucun état n'est `revise` à sa version, et si un état n'y est pas `ok`. **Un écran dont un lien `code` est à sa version n'y figure jamais** : il se juge sur sa page, à côté de sa capture | `showcase.test.js` : écran codé à sa version absent de l'accueil | retirer ce filtre |
| F3' | F3 tel quel. `review.md` dit en une ligne que `bump` y ajoute des lignes `pending` | - | - |
| E4' | Limite écrite : un rendu sans `</head>` montre tous ses états dans chaque cadre | - | - |

Hors plan, plan suivant : le pont vers le code (`ui.md`, rattrapage `code@version` après implémentation), la capture exigée aussi pour un écran déjà validé puis codé, les captures confiées à un plugin qui lance l'app, les assets sans états jamais revus, le prototype cliquable d'un parcours.

## Commits

Faits : `4716ec61e` (E0, E1, E3, E4, E5), `162c39992` (S1 à S4), `254d00ffa` (F1, F2, F3).

4. `test(aidd-ui): report coded screens, published records and a stable, reachable showcase` : F4, pour un avant et après mesuré.
5. `fix(aidd-ui): link a screen's code only when it describes the app today` : F1', F3', E4'.
6. `feat(aidd-ui): carry each revise comment back as a change request` : F6.
7. `feat(aidd-ui): one verdict reading, a revise blocks publication` : E2'.
8. `feat(aidd-ui): approve every record at once from the showcase home` : F5'.

## Done when

1. Mots des skills sous les cibles de la mesure de départ.
2. Lignes du moteur ≤ 5570.
3. Chaque mutation de F2 à F6 rougit son propre test, puis est annulée.
4. Suite des scripts verte : `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`.
5. Pre-commit vert : `pnpm exec lefthook run pre-commit`.
6. Pilote vierge : `node scripts/aidd-ui-pilot.cjs --gouvernail <checkout> --kairos <checkout> --only blank`. Il affiche `errors none`, `published T/T`, `showcase reachable stable`, `review ids clean`, `code untouched`, `steps ok`.
7. Pilote Kairos, `--only kairos` : `errors none`. `coded` et `published` sont rapportés tels quels : chaque écran lié sans capture doit décrire l'app actuelle, sinon F1' a échoué. `showcase reachable stable`, `review ids clean`, `steps ok`.
8. Playwright sur `file://`, accueil `fr` de la copie Kairos :
   - la section `batch` affiche « Tout OK, copier » ;
   - décocher une fiche, puis copier ; le texte lu, via le presse-papiers ou le `textarea` de repli, est une liste JSON sans cette fiche ;
   - chaque verdict de la liste est `ok` ;
   - aucune erreur JS.
