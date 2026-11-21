# Run : la vitrine présente le design system

Preuve du [plan](plan.md).

## Mesures

| Mesure | Avant | Après | Cible |
| --- | --- | --- | --- |
| mots des skills | 7495 | 7569 | ≤ 7570, tenue |
| lignes du moteur | 5581 | 5696 | ≤ 5680, manquée de 16 : la grille de pastilles et le refus des noms de police entre guillemets, ajoutés après revue visuelle |

## Suites

- Suite enveloppée : 1866 pass, 0 fail.
- `pnpm exec lefthook run pre-commit` : vert avant chaque commit.
- Chaque mutation de E1 à E8 et de O1 rougit son test. Hors plan : la grille de pastilles (trois mutations) et le refus des guillemets (une mutation) aussi.

## Pilote

```text
blank errors none warnings V6 wireframes all screens all code untouched steps ok published 19/19 coded 0/6 dressed 6/6 showcase reachable stable review ids clean
kairos errors none warnings C3,C4,V6 wireframes all screens all code untouched steps ok published 62/62 coded 0/9 dressed 9/9 showcase reachable stable review ids clean
```

- Vierge, `dressed 6/6` : chaque écran porte des tokens de type et d'espacement.
- Vierge, `font.family.sans` vaut `["system-ui", …, "\"Segoe UI\"", …]`. Le CSS sort `""Segoe UI""`, invalide : la pile entière tombe sur le plancher `system-ui`. T4 nomme désormais ce cas.

## Navigateur

Playwright sur `file://`, aucune erreur JS.

- Kairos, `fr` : cadre d'écran `mobile` à 390px, hauteur 798 pour `scrollHeight` 796, police `system-ui`. Page `system` : 84 couleurs en grille de pastilles, alpha lu `#ff6b35 · 8%`, 58 dimensions en barres, `fontWeight` en « Aa », `css` en dernier.
- Vierge : cadre `web` fluide, 1110px. Avant correction, `fontFamily` du `body` vaut le plancher et non le token. Après réécriture du nom sans guillemets, il vaut `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`, égal à `type.body.family`.

## Reste

- Lignes du moteur au-dessus de la cible.
- Primitives Gouvernail sans chemin, navigation plus riche : hors plan.
