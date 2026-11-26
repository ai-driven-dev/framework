# Run : aidd-ui 4d et 4e

Preuve du [plan](plan.md) : un pilote vierge puis Kairos, une sonde de capture, la vitrine dans un navigateur.

## Pilote

`node scripts/aidd-ui-pilot.cjs --only blank`, puis `--only kairos`, sur des copies `git archive`.

```text
blank errors none warnings none wireframes all screens all code untouched steps ok
kairos errors none warnings C3,V6 wireframes all screens all code untouched steps ok
```

| Pilote | Fiches revues | États | Publiées | `validate` |
| --- | --- | --- | --- | --- |
| vierge | 25 : 8 wireframes, 8 écrans, 9 composants | 40 | 25 `validated` | VALID |
| Kairos | 55 : 9 wireframes, 9 écrans, 37 composants | 93 | 55 `validated` | 0 erreur, 102 avertissements C3 et V6 |

- Les deux revues n'écrivent qu'une fiche sous `reviews/`, puis l'historique et la vitrine.
- La vitrine est écrite en `en` : aucune langue dans la mémoire des copies.

## Capture

Le pilote ne l'a pas prouvée : 05 n'a mis aucun lien `code` sur les écrans Kairos.
Sa réponse : « I did not trace the route files' exports ». La ligne « no file found » lui laisse cette sortie.

Sonde à la main, dans la copie Kairos :

1. `duel-live-screen` monte en v2, avec `code: apps/mobile/app/(app)/agon/active.tsx#default@2`.
2. Le fichier réel ne fait que réexporter : `export { default } from …`. C1 l'accepte.
3. `publish` sans verdict : `has no ok verdict for state default at version 2, review it first`.
4. Avec une revue OK sur les deux états : `default has no capture at screens/duel-live-screen.default@2.png`.
5. Avec la capture de `default` seule : `loading has no capture at screens/duel-live-screen.loading@2.png`.

## Navigateur

Playwright sur `file://`, page `duel-live-screen` de la copie Kairos, en `fr`. Aucune erreur JS.

| Critère | Résultat |
| --- | --- |
| capture présente | l'image se charge à côté du rendu de `default` |
| capture absente | le cadre nomme `screens/duel-live-screen.loading@2.png` |
| libellés | OK, À revoir, Copier la revue, Côte à côte |
| À revoir sans commentaire | bouton de copie désactivé, message affiché |
| navigation | 60 liens |
| compteur | `2/2 OK`, après correctif |

Vitrine régénérée deux fois : octets identiques sur les deux copies. Chaque page est liée depuis l'accueil.

## Correctif trouvé par le pilote

- Vu : la vitrine affichait `0/2 OK`, alors que `publish` voyait les deux OK.
- Cause : `bump` ajoute une ligne `pending` à l'ancienne revue, et la nouvelle revue trie avant.
- Correctif : une ligne `pending` ne cache jamais un verdict posé à la même version.
- Test : « never lets a pending row hide a verdict set at the same version ».
- Mutation : revenir à la dernière ligne seule rougit ce test, et lui seul.

## Écarts au plan

- `reportLine` ne compte ni fiches validées, ni vitrine atteignable, ni génération identique. Mesuré à la main ci-dessus.
- Done-when Kairos « écran codé refusé » : prouvé par la sonde, pas par le pilote.
- Les deux revues portent un id daté : le skill ne dit pas comment nommer une revue.
- La fiche de revue reste `proposed` : aucun statut final n'est défini.

## Suites

- Suite enveloppée : 1822 pass, 0 fail.
- `pnpm exec lefthook run pre-commit` : vert.
