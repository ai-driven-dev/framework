---
objective: "V11 vérifie aussi un texte sans fond propre, sur le fond hérité. Le code d'un écran réel ne noie plus C3."
status: done
---

# Plan : aidd-ui 4c, fond hérité et bruit C3

Prolonge [4c](../4c/plan.md) : lève sa limite « pas d'héritage ». Réduit le bruit C3 du pilote réel.

## Phases

| #   | Phase | Depends on |
| --- | ----- | ---------- |
| 1   | Moteur : éléments et imbrication d'un render | none |
| 2   | Moteur : V11 sur le fond hérité | 1 |
| 3   | Skill `03-foundations` : racines et `ignore` | none |
| 4   | Docs, pilote, `run-4c-heritage.md`, gates | 2, 3 |

Phase 3, texte seul, court en parallèle de 1 et 2.

## Données réelles observées

Lues sur les écrans des pilotes Gouvernail et Kairos. Jamais recopiées dans les fixtures.

- Règles avec `color` seul : Gouvernail 69 contre 34 paires. Kairos 59 contre 45.
- Imbrication bien formée : aucune balise non fermée, orpheline ou auto-fermante.
- Balises vides observées : `meta`, `link`, `input`, `img`.
- Sélecteurs descendants fréquents : `.m-tableau-libelles td`, `.practice-card small`.
- `>` deux fois, sur des règles sans couleur ni fond.
- `+` seulement devant `::before`. Aucun `#id`, aucune virgule, aucun `:not()`.
- `::before` porte des fonds : pastilles, frises. Pas un fond derrière le texte.
- Filtres d'état : `.practice-card[aria-pressed="true"] { background }`, `tr[data-state="hover"] td`.
- Pseudo-classes : `:focus-visible`, `:first-child`, `:disabled`. Aucun `:disabled` avec `color` seul.
- Composé de droite seul : chaque `span` prend le fond d'une barre. Faux.
- Chaîne descendante entière, sans `::` : chaque règle trouve son élément.
- Fond trouvé : Gouvernail 4 sur soi, 62 chez un ancêtre. Kairos 6, 22, puis 30 sur `body`.
- Règles tombant sur plusieurs fonds : Gouvernail 4, Kairos 2.
- Fond le plus proche d'état seul : Gouvernail 26, `tr[data-state="hover"] td`.
- Fond le plus proche `transparent` : présent sur Kairos.
- C3 Gouvernail : 3297 avertissements. `code-roots: [src]` couvre `src/server`, `src/prisma-generated`, `src/modules`.
- C3 Kairos : 643, racines déjà UI. Le bruit vient de `hooks`, `application/useCases`, `stores`.
- Dette couleur Gouvernail : littéraux dans `src/server/email` et `src/features`.

## Phase 1 : éléments d'un render

- Un parcours des balises, ouvrantes et fermantes, sur le HTML sans `NOT_MARKUP`.
- Une pile : une ouvrante empile, une fermante dépile. Les balises vides n'empilent pas.
- Chaque élément : balise, classes, parent.
- Un sélecteur vise par sa chaîne descendante entière, de droite à gauche.
- Composé : balise et classes. Filtres d'attribut et pseudo-classes ne restreignent rien.
- `>` lu comme un descendant ; un composé vide vise tout élément.
- Une règle à `::` n'est ni texte ni fond.
- V12 garde `targets()` : sa sortie réelle ne change pas.

Tests dans `screen-renders.test.js`, par V11 : la pile n'a pas d'API propre.

## Phase 2 : V11 hérité

- Une paire reste vérifiée comme aujourd'hui, message inchangé.
- Une règle à `color` seul : chaque élément qu'elle vise est lu.
- Remontée : de l'élément lui-même vers `body` inclus.
- Un fond d'état, sélecteur à `[` ou `:`, est vérifié ; la remontée continue.
- Un fond `transparent`, alpha nul, est sauté ; la remontée continue.
- Le premier fond de base arrête la remontée ; il est vérifié.
- Plusieurs fonds de base sur cet élément : chacun est vérifié.
- Fond translucide : composé sur le fond de `body`, comme aujourd'hui.
- Un élément porté par une paire couleur et fond de base n'est lu que par elle.
- Aucun fond jusqu'à `body` inclus : règle non vérifiée.
- Thèmes : la boucle actuelle, inchangée.
- Message, forme de la paire plus la source :
  `<thème>: <règle>: <texte> on <fond> behind <règle du fond> is <ratio>:1, below 4.5`
- Un message par règle, thème et règle du fond ; doublons retirés.
- Le JSDoc de `contrastProblems` et l'en-tête de `renders.cjs` suivent.

Tests, couleurs synthétiques, chacun avec sa mutation :

| Cas | Mutation qui le rougit |
| --- | --- |
| fond d'un ancêtre opaque, sous le seuil | ne lire que les paires |
| fond propre posé par une autre règle | partir du parent |
| ancêtre proche gagne sur un lointain | prendre le plus lointain |
| `.a .b` ignore un `.b` hors de `.a` | composé de droite seul |
| `::before` d'un ancêtre ignoré comme fond | retirer le filtre `::` |
| `input` vide : son frère n'est pas son enfant | retirer la liste des vides |
| ancêtre translucide composé sur `body` | ne pas composer |
| aucun fond jusqu'à `body` : rien | fond par défaut blanc |
| deux fonds sur un élément : deux messages | garder le dernier seul |
| même règle, deux conteneurs, même règle de fond : un message | retirer le dédoublonnage |
| fond d'état seul proche, fond de base plus haut : deux messages | arrêter au fond d'état |
| fond `transparent` proche : l'ancêtre est lu | ne pas sauter l'alpha nul |
| `<style>` aux `>` et `::before` : aucun élément lu | lire le HTML brut |
| élément porté par une paire : la règle à `color` seul le saute | retirer le bouclier de la paire |

- Renommer « skips a rule without both colours ».
- Nouveau nom : « skips a colour that names no element ».
- Le registre `FIXES` reçoit chaque nouveau message.

## Phase 3 : racines et `ignore`

Fichier : `03-foundations/references/extraction.md`. Aucune ligne ajoutée ; une ligne en moins.

| Ligne | Aujourd'hui | Après |
| --- | --- | --- |
| racines | `UI folder` | `UI folder, never a whole source tree` |
| `ignore` | `generated output under a code root` | fusionnée dans la ligne C3 |
| C3 | `file no record links (C3), not a component` | `file no record links (C3): server, generated, domain, state, not a component` |
| C3, cible | `ignore` | `` `ignore`, its narrowest folder; its colour literals named to the user `` |
| littéral | `colour literal in the code` … `Never a narrower code root` | `colour literal in UI code` … `Never ignore. A literal never decides a root` |

- Deux lignes `ignore` deviennent une : plus de règle parallèle.
- Un littéral serveur sort de la dette, nommé à l'utilisateur.
- `skill.test.js:446` ne lit pas `03-foundations` : rien n'épingle ces lignes.
- Chaque cellule tient en douze mots ; `skill.test.js:310` le vérifie.
- Aucun nom de skill, aucun lien hors du dossier.

## Phase 4 : preuve

- `05-screens/references/screens.md` : `each text reaches 4.5:1 on what lies behind it`.
- La limite « Pas d'héritage » de `4c/plan.md` renvoie vers ce plan.
- Un pilote : `node scripts/aidd-ui-pilot.cjs --only blank`, puis `--only gouvernail`.
- Done-when Gouvernail : règles héritées vérifiées par V11, plus de zéro.
- Done-when Gouvernail : aucun C3 serveur ou généré ; compte noté.
- Un C3 serveur restant est un constat chiffré, sans relance du pilote.
- La sonde est refaite depuis les hooks neufs avant de compter.
- Une erreur V11 réelle est un constat, pas un échec du pilote.
- Chaque erreur héritée est tracée : vraie, ou artefact de filtre.
- Si les artefacts dominent, lire les filtres d'attribut devient la suite.
- `run-4c-heritage.md`, à côté de `run-4c.md` : sortie, comptes avant et après, mutations.
- Gates : suite enveloppée, `pnpm exec lefthook run pre-commit`.

## Rules

| Rule | Why it applies |
| --- | --- |
| test d'abord, chaque garde avec la mutation qui rougit son propre test | parcours, appariement et fond hérité sont des gardes |
| aucun code pour une entrée jamais observée | `+`, `~`, `:not()`, auto-fermante : limites |
| fixtures aux couleurs synthétiques | jamais les valeurs d'un projet client |
| skill : douze mots par phrase, aucun autre skill nommé | tests de structure existants |
| suite des scripts toujours enveloppée | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` |
| un seul pilote, à la fin : vierge puis Gouvernail | `claude -p` tourne avec `--no-session-persistence`, aucun chat à supprimer |

## Decisions

| Decision | Why |
| --- | --- |
| Pile de balises, sans parseur DOM | imbrication observée bien formée ; le plugin n'a aucune dépendance |
| Une fermante dépile, sans chercher sa paire | aucune balise orpheline observée ; moins de code |
| Chaîne descendante entière, pas le composé de droite | le composé seul colle le fond d'une barre sur chaque `span` |
| `::` exclu des deux côtés | les fonds de `::before` sont des pastilles, pas un fond de texte |
| Tous les fonds d'un élément vérifiés | la cascade n'est pas calculée ; le pire cas reste visible |
| Un message par règle, thème et fond | une règle tombe sur plusieurs fonds réels ; un seul en cacherait |
| Le message nomme la règle du fond | il se distingue d'une paire et dit où corriger |
| V12 inchangée | le seul écart mesuré porte une taille en `calc()`, illisible par V12 |
| Racines choisies par l'UI, pas par les littéraux | `src` entier donne 3297 C3 |
| Littéraux serveur hors de la dette | un e-mail ne lit pas les tokens ; voulu, dit à l'utilisateur |
| `run-4c-heritage.md` neuf | `run-4c.md` clôt une tranche terminée |

## Accepted limits

- La cascade et la spécificité ne sont pas calculées.
- Filtres et pseudo-classes ignorés : un état prête son fond à tous.
- `:disabled` vérifié comme un autre état, bien que WCAG l'exempte.
- `>` lu comme un descendant ; `+` et `~` non lus.
- Une balise mal fermée décale l'imbrication. Auto-fermante non lue.
- Un fond translucide se compose sur `body`, pas sur ses ancêtres.
- Une couleur héritée d'un ancêtre n'est pas vérifiée.
- Un fond en image, dégradé ou `color-mix()` arrête la remontée, non vérifié.
- V12 garde son appariement par composé : `.a .b` vise encore `.a`.
- `ignore` est un préfixe : chaque dossier de logique s'y nomme.
- Kairos n'est pas rejoué : son bruit C3 reste non mesuré après.
