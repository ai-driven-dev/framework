---
objective: "La vitrine présente le design system : galerie des tokens sur la page système, rendus sans police serif par défaut, cadre de téléphone pour une plateforme mobile, hauteur ajustée au contenu. Sur un projet vierge, 03 donne aux écrans des tokens sémantiques d'espacement, de typo, de rayon et de hauteur de contrôle."
status: done
---

# Plan : la vitrine présente le design system

Contexte : [spec](../../../2026_10/2026_10_30_aidd-ui-rework/spec.md), décision 4 (vitrine point d'entrée, habillage neutre, seuls les rendus portent les tokens). Plan précédent : [lean-4d](../lean-4d/plan.md).

## Défauts vus

Vus sur la copie Kairos du pilote et sur le dernier pilote vierge.

| # | Défaut | Cause lue |
| --- | --- | --- |
| D1 | Rendus en Times | Ni token de famille (Kairos, React Native), ni `font-family` dans le rendu. Les rendus vierges n'en posent aucun non plus |
| D2 | La page `system` ne montre que les breakpoints | `specOf` seul ; aucune lecture de `tokens.json` |
| D3 | Écran mobile dans un cadre d'environ 1100px sur 320px | `LAYOUT` : `.render iframe { height: 320px }`, largeur fluide |
| D4 | Écrans vierges sans espacement ni typo | Seul `color.*` est sémantique. T8 interdit de citer une primitive, V6 interdit le littéral : aucune issue |
| D5 | Habillage terne, ids en titre | `<h1>${id}</h1>` |

## Mesure de départ

| Mesure | Commande | Avant | Visé |
| --- | --- | --- | --- |
| mots des skills, sans `\|` | `find plugins/aidd-ui/skills -name '*.md' \| xargs cat \| tr -d '\|' \| wc -w` | 7495 | ≤ 7570 |
| lignes du moteur, hors copie partagée | `cat plugins/aidd-ui/hooks/aidd-ui.cjs $(ls plugins/aidd-ui/hooks/lib/*.cjs \| grep -v common-rules) \| wc -l` | 5581 | ≤ 5680 |

## Décisions

- **Police : défaut du moteur dans le document de rendu, pas un token.**
  - Le défaut est `:where(html) { font-family: system-ui, sans-serif; }`, posé là où le rendu chargeait `../tokens.css`, donc avant ses propres styles.
  - Spécificité nulle : toute `font-family` du rendu l'emporte.
  - Ce n'est pas de l'habillage. Une app React Native sans famille montre la police système : `system-ui` est le rendu fidèle, Times est la fuite.
  - L'empreinte H8 hache le fichier de rendu, pas le cadre : aucune version ne bouge.
  - Rejeté : un token tiré de 03. L'extraction n'invente rien, et une règle de rendu n'aurait aucun correctif sur Kairos.
- **Galerie dans un cadre.**
  - Un `<iframe srcdoc>` porte `tokens.css` en ligne, et chaque spécimen lit `var(--x)`.
  - Les tokens restent dans un cadre, comme la spec le veut. La barre thème et plateforme existante l'habille sans code neuf.
  - Noms et types viennent de `tokens.json` : le CSS perd les types. Valeurs affichées : `resolvedValues`, contexte de base.
- **Cadre par plateforme.**
  - Largeur : `data-platform` sur chaque `iframe`, valant la première plateforme de `system.md`. `dress()` le met à jour.
  - Seul `mobile` est observé : 390px. Tout autre nom reste fluide.
  - Hauteur : celle du contenu, mesurée côté client. Le `320px` fixe disparaît.
- **Sémantique d'un projet vierge.**
  - Le moteur vérifie la structure : chaque couple groupe primitif et `$type` a au moins un token sémantique qui le cite (T11).
  - Les noms exacts ne vivent que dans le skill.

## Moteur, test d'abord

| # | Fichier | Changement | Test écrit d'abord | Mutation qui le rougit |
| --- | --- | --- | --- | --- |
| E1 | `lib/page.cjs`, `lib/showcase.cjs` | Un seul `inlined(doc, tokens)` exporté par `page.cjs` remplace les deux `replaceAll(STYLESHEET_LINK, …)`. Il pose `FONT_FLOOR`, la règle `:where(html)` ci-dessus, puis les tokens, même quand `tokens` est null. `stateDocument` et `frameOf` l'appellent | `showcase.test.js` « renders each state… » : le `srcdoc` contient `:where(html) { font-family: system-ui, sans-serif; }`, avant la première règle propre du rendu. `drafts.test.js` : même chose pour un cadre de compare | retirer `FONT_FLOOR` ; écrire `html` sans `:where` ; poser la règle avant `</head>` ; `frameOf` garde son ancien remplacement |
| E2 | `lib/showcase.cjs` | `SCRIPT` se scinde en `FRAMES` (frames, dress, watch, toolbar, sides, ajustement) et `REVIEW`. Une page relue reçoit `FRAMES + REVIEW`, la page système `FRAMES` seul | « carries a script that compiles » couvre aussi `system.html`, qui ne contient pas `document.querySelector(".review")` | donner `FRAMES + REVIEW` à la page système |
| E3 | `lib/showcase.cjs` | Chaque `iframe` porte `data-platform="<première plateforme>"` quand `system.md` en déclare. `dress()` copie `pick.platform` dans `frame.dataset.platform`. `LAYOUT` : `.render iframe[data-platform="mobile"] { flex: 0 0 390px; inline-size: 390px; }` | plateformes `[mobile]` : chaque cadre porte `data-platform="mobile"`. `[web, mobile]` : `web`. `platforms: []` : aucun attribut | ne pas émettre l'attribut ; prendre la dernière plateforme |
| E4 | `lib/showcase.cjs` | `height: 320px` remplacé par `min-block-size: 120px`. `fit(frame)` vide la hauteur, puis pose `documentElement.scrollHeight`. Appelé à la fin de `dress()` | aucun test node : comportement client. Prouvé par Playwright (Done when 7) | - |
| E5 | `lib/tokens.cjs` | Exporter `catalog(project)` : `[{name, type, property}]` dans l'ordre de `tokens.json`. `type` vaut `typeOf` ; absent pour un CSS brut sans `$type`, comme les ombres de Kairos. Moins de 5 lignes | `tokens-renders.test.js` : un token aliasé hérite du type de sa cible ; un token `$extensions` seul n'a pas de type | rendre `token.node.$type` au lieu de `typeOf` |
| E6 | `lib/showcase.cjs` | `galleryOf` sur la page `system`, sous les puces, avant le texte, seulement si `tokens !== null`. Une section par type dans l'ordre `TYPES`, puis `css` pour les non typés. Ligne : nom, valeur de base, spécimen. `color` : pastille. `dimension` : barre `inline-size: min(var(--x), 100%)`. `fontFamily`, `fontWeight` : « Aa ». Autres : valeur seule. Barre de thème et plateforme reprise. Libellé ajouté : `tokens` (« Tokens », deux langues) | page `system` : une ligne par token de la fixture ; une couleur a sa pastille `var(--…)` ; le cadre contient le texte de `tokens`. Un token CSS brut est sous `css`. `tokens: null` : aucune galerie | ne pas émettre la pastille ; filtrer les non typés ; retirer `min(` ; toujours rendre la galerie |
| E7 | `lib/tokens.cjs` | **T11**, erreur, dans `RULES` mais pas dans `BASE_RULES`, donc il ne bloque pas `tokens.css`. Pour chaque entrée de `primitives` et chaque `$type` de ses tokens : un token hors primitives doit le citer via `citations()`. Sinon : `primitives "<g>": no semantic token cites its <type> tokens, so no record can use them`. Correctif : `add a semantic token citing one, in a group primitives does not list` | `tokens-renders.test.js` : un groupe primitif dont un type n'est cité par aucun sémantique est nommé ; cité par alias ou par `var()` d'un CSS brut, silence ; `primitives: []`, silence. La ligne T11 rejoint la table de toutes les règles | ne regarder que les alias ; regrouper par groupe sans le type ; toujours rendre `[]` |
| E8 | `scripts/aidd-ui-pilot.cjs` | `reportLine` gagne `dressed N/M`, pour info : les écrans à rendu dont `tokens` cite un `fontFamily` et une `dimension`, via `catalog` | `pilot.test.js` : un écran de la fixture qui ne cite que des couleurs est compté dehors | compter tout écran |

## Skills

| # | Fichier | Changement | Delta mots |
| --- | --- | --- | --- |
| S1 | `03-foundations/references/tokens.md` | Ligne `semantic set, blank project` : `color`: background, surface, text, text-muted, accent, text-on-accent, border, focus. Ligne `type` : body and heading, each with family, size, line height, weight. Ligne `spacing` : inset, gap. `corner` : control, surface. Ligne `control.min-height` : at least each platform's touch floor. Ligne `other primitive type` : one semantic token, named by its role | ≈ +50 |
| S2 | `04-components/references/elements.md`, `05-screens/references/screens.md` | Une ligne `text` : `font family, size and line height from tokens, set on body` | ≈ +20 |

Aucune ligne `Owed` : T11 porte sur `tokens.json`, que seul 03 écrit, et sa boucle de conclude le traite.

## Option

| # | Changement | Test | Mutation |
| --- | --- | --- | --- |
| O1 | Le `<h1>` d'une page est le premier titre `# ` du texte de la fiche, retiré de `specOf`. L'id devient une puce `id`. La navigation garde les ids, triés. Retenue par défaut, dernier commit | la page `home` a pour `<h1>` son titre et une puce `id` | rendre l'id en titre |

## Ne pas toucher

- `common-rules.cjs`, `host.cjs`.
- `STYLE` de `page.cjs`, hors `inlined`. Le `localStorage` de compare reste hors de la vitrine.
- Les gardes de `skill.test.js` : douze mots par phrase, `Write only`, aucune commande dans une action, aucun nom d'autre skill.
- Les gardes existantes : chacune garde sa mutation.

## Impact

| Catégorie | Verdict et preuve | Traité dans |
| --- | --- | --- |
| régression | faible : un rendu qui comptait sur la police du navigateur passe en `system-ui`. Aucun ne la veut | E1 |
| régression | moyen : T11 rougit tout projet aux primitives non citées. Observé seulement sur les pilotes vierges ; Kairos et Gouvernail silencieux | E7 |
| tests | `showcase.test.js`, `drafts.test.js`, `tokens-renders.test.js` (table des règles), `pilot.test.js` | E1 à E8 |
| déterminisme | la galerie suit l'ordre de `tokens.json`, et la largeur une constante : deux générations identiques | E3, E6 |

## Accepted limits

- La hauteur ajustée, la mise à jour de `data-platform` et le jumeau côte à côte sont côté client : prouvés par Playwright seulement.
- Seule la plateforme `mobile` a une largeur de téléphone. Un autre nom reste fluide jusqu'à ce qu'un pilote l'observe.
- Un écran plus court qu'un téléphone n'en a pas la hauteur : le cadre suit le contenu.
- La galerie classe par type, jamais par rôle.
- Le libellé de valeur suit le contexte de base ; le spécimen suit la combinaison choisie.
- T11 vérifie qu'un sémantique existe, pas qu'un rendu le cite : le pilote le mesure (`dressed`).

Hors plan :

- les noms de famille entre guillemets dans les valeurs (`"'Source Serif 4'"`, pilote vierge) ;
- un groupe de `primitives` qui ne correspond à aucun chemin (Gouvernail) ;
- la navigation enrichie.

## Commits

1. `test(aidd-ui): report screens dressed with type and spacing tokens` : E8.
2. `fix(aidd-ui): render frames fall back to the system font, never the browser serif` : E1.
3. `feat(aidd-ui): size each render frame to its platform and its content` : E2, E3, E4.
4. `feat(aidd-ui): show every token on the system page` : E5, E6.
5. `feat(aidd-ui): require a semantic token for each primitive type` : E7, S1, S2.
6. `feat(aidd-ui): title each showcase page with its record's heading` : O1.

## Done when

1. Mots des skills ≤ 7570 ; lignes du moteur ≤ 5680.
2. Chaque mutation de E1 à E8 et de O1 rougit son propre test, puis est annulée.
3. Suite verte : `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`.
4. Pre-commit vert : `pnpm exec lefthook run pre-commit`.
5. Pilote vierge `--only blank` : `errors none`, `dressed M/M`, `published T/T`, `showcase reachable stable`, `review ids clean`, `code untouched`, `steps ok`.
6. Pilote Kairos `--only kairos` : `errors none`, `showcase reachable stable`, `steps ok`.
7. Playwright sur `file://`, copie Kairos, `fr` : police du cadre `system-ui`, cadre d'écran 390px, hauteur ≥ `scrollHeight`, page `system` avec pastilles, barres, « Aa » et ombres sous `css`, côte à côte à deux cadres, aucune erreur JS.
8. Playwright sur la copie vierge : `web` fluide, `mobile` 390px ; `fontFamily` du `body` d'un écran égal au token `type.body.family`.
