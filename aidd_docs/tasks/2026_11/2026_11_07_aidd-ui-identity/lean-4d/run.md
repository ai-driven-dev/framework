# Run : passe lean après 4d

Preuve du [plan](plan.md), révisé après challenge.

## Mesures

| Mesure | Avant | Après | Cible |
| --- | --- | --- | --- |
| mots des skills | 7345 | 7495 | 7350, manquée : F1' et F6 ajoutent plus que les coupes ne retirent |
| lignes du moteur | 5545 | 5581 | 5570, manquée de 11 |

## Suites

- Suite enveloppée : 1844 pass, 0 fail.
- `pnpm exec lefthook run pre-commit` : vert avant chaque commit.
- Chaque mutation du plan rougit son test. Quand d'autres tests rougissent, ils gardent le même comportement.

## Pilote

```text
blank errors none warnings R18 wireframes all screens missing 1 code untouched steps ok published 24/24 coded 0/6 showcase reachable stable review ids clean
kairos errors none warnings C3,V6 wireframes all screens all code untouched steps ok published 88/88 coded 0/9 showcase reachable stable review ids clean
```

- Kairos `coded 0/9` : 05 répond « these are new designs, so the rule "the app does not show it yet" applies ». F1' tient.
- Vierge, `screens missing 1` : le wireframe `welcome` attend un `logo`. 04 refuse de l'inventer, 05 refuse de l'habiller. Sortie 1 voulue.
- Vierge, écart vu par 05 : `system.md` ne déclare que des tokens sémantiques de couleur. Les écrans n'ont ni espacement, ni échelle de type, ni rayon, ni `min-height`.

## Navigateur

Playwright sur `file://`, accueil `fr` d'une copie Kairos sans revue. Aucune erreur JS.

| Critère | Résultat |
| --- | --- |
| section | « Encore à juger », 88 fiches cochées |
| bouton | « Tout OK, copier » |
| une fiche décochée | absente de la copie, 87 fiches restent |
| verdicts copiés | tous `ok`, sans commentaire |
| rien de coché | bouton désactivé |

## Suites à donner

- Vierge : les fondations doivent poser des tokens sémantiques d'espace, de type, de rayon et de taille de contrôle.
- Accueil : 88 lignes à plat, sans regroupement par sorte ni nombre d'états, et le bouton est tout en bas.
- Hors plan : le pont vers le code, la capture après codage, les assets sans états, le prototype cliquable.
