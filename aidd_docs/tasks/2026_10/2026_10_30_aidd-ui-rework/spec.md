# aidd-ui : un design system qui vit avec le code

## Target

Dans un projet, un dev qui conçoit l'UI avec une IA obtient un design system versionné, relié à ses écrans et à son code, dont chaque changement est tracé, propagé et vérifiable sans IA.

## Hard constraints

### Arborescence

Tout le design system vit dans `aidd_docs/ui/`, un fichier par élément, rien à côté du code. C'est la norme du projet, quelles que soient ses plateformes et ses technos : un design system déjà présent dans le code sert de matière à l'extraction, puis n'est plus qu'une implémentation confrontée à la norme, jamais une seconde source.

```txt
aidd_docs/ui/
├── system.md                 racine du design system
├── brand.md                  identité de marque
├── tokens.json               tokens du thème de base, format W3C DTCG 2025.10
├── tokens.resolver.json      thèmes et breakpoints, module Resolver de DTCG 2025.10
├── themes/<thème>.json       valeurs qui changent pour un thème
├── breakpoints/<nom>.json    valeurs qui changent à un breakpoint
├── tokens.css                généré depuis les tokens, jamais écrit à la main
├── assets/<id>.md            icône, image, illustration, avec son fichier à côté
├── components/<id>.md        atome, molécule ou composition
├── components/<id>.html      rendu du composant, toutes variantes et tous états
├── screens/<id>.md           écran
├── screens/<id>.html         maquette de l'écran, tous ses états dans un seul fichier
├── journeys/<id>.md          parcours utilisateur
├── reviews/<id>.md           verdicts d'une review du design system
└── showcase/                 vitrine générée, jamais écrite à la main, ignorée par git
```

Le contrat UI d'une feature, `ui.md`, vit dans le dossier de sa tâche, à côté du plan. Il n'est jamais versé dans `aidd_docs/ui/`.

### Fiches

Chaque fiche porte en tête : `id` (égal au nom du fichier, unique), `kind`, `status`, `version`.

| Fiche | Contient en plus |
| --- | --- |
| `system.md` | version du format des fiches, version du design system, plateformes, breakpoints, thèmes, langues et sens d'écriture, groupes de tokens primitifs, dossiers UI du code, chacun rattaché à une plateforme, fichier(s) où le code consomme les tokens, chemins ignorés, librairies de composants utilisées ; règles transverses s'il y en a |
| `brand.md` | projet, utilisateurs, domaine, plateformes, personnalité et ton, charte imposée s'il y en a une, références et anti-références ; glossaire (mot à employer, mots interdits) s'il y en a un |
| asset | type (icône, image, illustration), fichier, texte alternatif attendu |
| atome, molécule, composition | quand l'utiliser et quand ne pas l'utiliser, éléments utilisés, tokens sémantiques utilisés, variantes, états (au moins défaut ; focus quand il est interactif ; survol, désactivé, chargement ou erreur quand ils existent), comportement clavier et rôle accessible, plateformes où il existe (toutes par défaut), un lien vers le code par plateforme |
| écran | éléments utilisés, tokens sémantiques utilisés, états (au moins défaut, vide, chargement, erreur, sans droits quand ils existent), breakpoints couverts, route ou fichier réel, plateformes où il existe, un lien vers le code par plateforme |
| parcours | persona, étapes ordonnées, chaque étape un écran et l'action qui mène à la suivante |
| review | écrans revus, verdict OK ou pas OK par écran, par état et par version revue, commentaire, écrans restants |

### Cycle de vie

Deux axes, jamais mêlés : où en est le design, et quelle version le code implémente.

- `status` dit le design : `proposé` (créé, pas encore validé), `validé` (rendu approuvé en review), `déprécié` (ne doit plus être utilisé, nomme son remplaçant ou dit pourquoi il n'en a pas).
- Chaque lien vers le code porte la version de l'élément que ce code implémente. Une plateforme est à jour quand elle égale `version`, en retard quand elle est plus petite ; un élément sans lien n'est codé nulle part, sauf une molécule ou une composition implémentée par ce qu'elle utilise.
- Modifier un élément implémenté monte sa `version` et le repasse à `proposé` ; les versions de ses liens ne bougent pas, et le retard de chaque plateforme reste visible jusqu'à ce que la feature fasse suivre son code.
- Un élément non déprécié n'utilise jamais un élément déprécié.

### Lien avec le code

- Un élément a au plus un fichier d'entrée par plateforme, identifié par son chemin, le nom exporté quand sa techno en a un, et la version qu'il implémente. La plateforme d'un lien est celle du dossier UI qui le contient, et figure parmi celles de l'élément. Quand ce fichier est dans un dossier qui porte son nom, le lien couvre tout le dossier (styles, hooks, tests) ; sinon, seulement les fichiers de même nom.
- Un élément utilise des éléments de son niveau ou d'un niveau inférieur, jamais lui-même.
- Un composant de librairie est lié à son paquet et à son nom exporté.
- Chaque fichier sous un dossier UI déclaré est lié à une fiche ou couvert par un chemin ignoré.
- Les usages se lisent dans les fiches : un token mène aux composants qui le déclarent, un composant aux compositions et écrans qui l'utilisent, un écran aux parcours, chaque élément à son fichier de code. Le rapport d'impact suit ce chemin.

### Versions et historique

- Chaque élément a une version entière et un historique : une ligne par version, avec le changement, s'il est cassant, et la tâche qui l'a fait.
- Une tâche se nomme par le chemin de son dossier, `aidd_docs/tasks/…` : historiques, `ui.md` et plan se rejoignent sur cette valeur.
- Est cassant : retirer une variante, un état ou une propriété, renommer ou supprimer un token, déprécier un élément.
- Le design system a sa propre version dans `system.md`, qui ne bouge qu'à une publication : une ligne liste les tâches publiées ; elle est cassante, et monte la majeure, quand une de ces tâches a cassé un élément ou quand elle le dit elle-même, pour un changement de tokens seuls ; sinon elle monte la mineure. Une tâche pas encore publiée n'est pas une erreur, et deux features parallèles sur des éléments distincts n'entrent jamais en conflit.
- Deux lignes d'historique qui revendiquent la même version d'un élément sont signalées, pour que la personne tranche, comme un conflit git.
- `system.md` porte la version du format des fiches ; une version que le validateur ne connaît pas donne un seul message, jamais une avalanche.

### Changements

- Un changement produit d'abord un rapport d'impact : éléments, écrans, parcours et fichiers de code touchés, et les tokens de même valeur sans alias.
- Le moteur applique ensuite les versions et l'historique de ce que le rapport atteint, par la sous-commande `bump` : l'IA n'y décide que le texte du changement et s'il est cassant.
- Après validation, les rendus HTML touchés sont régénérés, revus si leur aspect change, puis versions et historiques sont mis à jour.
- Le code suit dans la feature qui porte le changement, jamais en dehors.

### Feature

- Une feature qui touche l'UI a son `ui.md` : écrans et éléments réutilisés, créés ou modifiés, et ce que le code doit respecter.
- Une feature sans UI n'en a pas, et rien ne se déclenche.
- Une feature qui ne fait que réutiliser ne change aucune version.
- Une fois la feature implémentée, son code est vérifié contre son `ui.md` et les liens vers le code sont mis à jour.

### Rendus

- Écrans et composants sont rendus en HTML avec les vrais tokens, sans valeur en dur.
- Une valeur de token propre à une plateforme est un contexte `platform` du Resolver, comme un thème ou un breakpoint.
- Les tokens ont deux niveaux : les primitifs (la palette) et les sémantiques, qui pointent vers eux. Un composant ou un écran n'utilise que des sémantiques, et son rendu n'emploie que les tokens que sa fiche déclare et ceux des éléments qu'il utilise : le rapport d'impact, qui suit `uses`, n'en oublie aucun.
- Les tokens sont la seule source ; aidd-ui génère `aidd_docs/ui/tokens.css` et n'écrit jamais dans le code. `system.md` nomme le ou les fichier(s) où le code consomme les tokens ; la feature les fait suivre, l'audit compare les deux.
- Les thèmes suivent le module Resolver de DTCG : `tokens.json` porte le premier thème déclaré, la base ; chaque autre thème a son fichier, qui ne redéfinit que des tokens de la base, avec le même type. Un rendu pose `data-theme` et `data-platform` sur `<html>` seul, avec les mêmes noms de variables : un autre thème ou une autre plateforme est un autre document, ou la bascule de cet attribut, jamais une région imbriquée.
- Une valeur qui dépend de la largeur suit le même module : `tokens.json` porte le breakpoint de départ, contexte par défaut et vide ; chaque autre breakpoint a son fichier, qui ne redéfinit que des tokens de la base avec le même type, et sa media query telle quelle dans une extension du modificateur. `tokens.css` la porte dans un bloc `@media` après les thèmes. Quand plusieurs modificateurs (thème, plateforme, breakpoint) redéfinissent le même token, l'ordre du `resolutionOrder` du Resolver décide : le dernier l'emporte. `tokens.css` résout chaque combinaison par cet ordre, tout sur l'élément racine, et n'écrit que ce que les blocs précédents ne donnent pas déjà à cette racine.
- Une valeur que DTCG ne sait pas porter (`color-mix()`, `%`, `em`) est gardée en CSS brut dans une extension du token ; les `var()` qu'elle cite sont des tokens existants et comptent comme des dépendances.
- Un écran montre tous ses états dans un seul fichier, avec un sélecteur d'état.
- Une variante est une valeur nue, montrée par `data-variant`, ou `axe=valeur` pour une propriété qui varie seule (`size=sm`), montrée par `data-<axe>` ; `state`, `variant` et `theme` ne sont jamais des axes.
- La vitrine est générée sans IA, à partir des fiches et de gabarits fixes : identique à chaque génération, elle montre chaque élément, ses variantes, ses états, ses usages et son lien vers le réel.
- La vitrine affiche la version validée d'un écran et un lien vers le réel.

### Review

- La review design se fait dans une page HTML statique, sans serveur : OK ou pas OK par écran et par état, avec un commentaire ; la page produit la fiche review, que la personne enregistre.
- Un verdict porte la version revue : il ne vaut plus pour une version suivante.
- Les verdicts sont enregistrés dans une fiche review, qui vit avec ce qu'elle revoit : `aidd_docs/ui/reviews/` pour une review du design system, le dossier de la tâche pour une review de feature. Quand la personne dit qu'elle a fini, l'IA lit la fiche et continue.
- Une review partielle garde les écrans restants, et l'IA reprend là où elle s'est arrêtée.

### i18n et accessibilité

- `system.md` déclare les langues et les sens d'écriture.
- Les rendus utilisent des propriétés logiques plutôt que physiques quand un sens droite-gauche est déclaré, et aucune largeur fixe sur du texte.
- Dates et nombres suivent la langue.
- Base d'accessibilité : WCAG 2.2 AA, mobile d'abord, texte qui suit la taille choisie par la personne, aucun comportement qui n'existe qu'au survol sur écran tactile.

### Vérification

- La structure se vérifie à chaque écriture dans le design system, quel que soit le skill qui écrit, et à la main, par des scripts déterministes, sans IA, qui tournent sur toute machine où tourne Node :
  - format de chaque fiche et du fichier de tokens ;
  - éléments utilisés et alias de tokens qui existent ;
  - cycle de vie respecté ;
  - liens vers le code valides et cohérents avec leurs plateformes, couverture des dossiers UI ;
  - aucune valeur en dur dans les rendus, aucune couleur en dur nouvelle dans le code, quelle que soit sa techno (documents, données et images exclus) : erreur dans un fichier modifié ou non suivi par rapport à `HEAD`, ou quand git ne sait pas répondre ; avertissement dans un fichier identique à `HEAD`, dette existante ;
  - aucun token primitif dans un composant ;
  - versions en double dans un historique ;
  - propriétés physiques quand un sens droite-gauche est déclaré.
- Chaque problème porte sa règle et sa gravité. Une erreur bloque la fin du tour ; un avertissement informe sans bloquer : fichier de code sans fiche, couleur en dur déjà committée, trait fin en px, échec de git. Après une écriture, l'IA voit les problèmes des fichiers écrits et de ceux qui en dépendent (le rendu de l'élément écrit, les fiches qui le citent), ou tous quand elle a écrit un fichier partagé (tokens, thèmes, `system.md`), et le nombre des autres erreurs ; en fin de tour, toutes les erreurs ; la sortie du hook est plafonnée, la commande à la main montre tout.
- Une règle qui plante devient un problème qui la nomme, jamais un silence.
- Un seul moteur porte la lecture des fiches, la vérification et, plus tard, le graphe, la génération des tokens, la vitrine et la page de review ; chaque skill l'appelle par sous-commande.
- Le moteur écrit aussi les fichiers de tokens depuis le code que `system.md` désigne, par la sous-commande `extract`, et liste ce qu'il laisse sans le deviner.
- L'IA juge le sens : le code fait-il ce que disent `ui.md` et les fiches ?
- L'audit UI constate et ne corrige rien : élément sans code, code sans élément, écart entre le validé et le réel, doublons proches, valeurs en dur autres que les couleurs dans le code, écart entre `tokens.json` et les tokens du code, mots interdits par le glossaire, textes trop longs dans la langue la plus longue, accessibilité.

### Format

- Les skills suivent le format lean de brainstorm, plan et implement.
- Les artefacts ne dépendent d'aucune techno ; Figma et Claude Design se branchent, le contrat du projet fait foi.

## Non-goals

- Plusieurs design systems concurrents dans un projet : la personne choisit celui qui fait foi, les autres ne sont pas suivis.
- Synchronisation dans les deux sens avec Figma ou Claude Design, et import de maquettes existantes.
- Retour à une version précédente du design system.
- Travail à plusieurs, et parcours pour un designer qui ne code pas.

## Done-when

- Sur un projet vierge puis sur un projet existant, le flow passe de la marque jusqu'à tous les écrans voulus, chacun validé en review.
- Les features générées ensuite sont liées au design system, sans dérive, et leur code est vérifié.
- Un changement de token, de composant et d'écran produit chacun son rapport d'impact, ses régénérations et ses nouvelles versions, sans élément oublié.
- Deux features parallèles sur le même élément aboutissent à une version en double signalée.
- La vitrine générée deux fois de suite est identique.
- Chaque règle de vérification a un cas qui la fait échouer.
- Sur Gouvernail et Kairos, le design system est extrait du code existant.

## Open Questions

- TBD: quel projet pilote pour le cas vierge, sachant que Gouvernail et Kairos, pilotes du cas existant, ont déjà une identité ? Gouvernail a déjà ses propres contrôles de tokens et aucune couleur en dur : il éprouve l'extraction facile, pas le cas d'une app qui dérive.

## Décisions pour les PR suivantes

| PR | Décision |
| --- | --- |
| 2 | Réalisé : la règle H8 compare un élément validé ou déprécié à sa fiche et son rendu committés (`HEAD`, lus par `git`) ; `status`, `code` (liens et versions) et l'historique ne comptent pas comme une modification, et sans git, sans dépôt ou sans fiche committée la règle se tait. La sous-commande `impact` imprime le graphe d'usages en JSON (tokens, éléments, écrans, parcours, rendus, fichiers de code). |
| 2 | Réalisé : le flux de changement vit dans `01-system`. Un rendu charge `../tokens.css` au lieu de porter les valeurs ; la sous-commande `tokens` régénère ce seul fichier, et le skill réécrit le balisage des rendus touchés, écrans compris, d'après le rapport d'impact. Il s'arrête en disant qu'une review est attendue, sans nommer le skill qui la conduit. |
| 2 | Réalisé : `#Export` est facultatif pour toute techno, un composant Vue, Svelte ou Astro se lie par son chemin et sa version, sans cas particulier. Les couleurs d'un fichier sans lecteur propre sont cherchées dans ses chaînes seulement ; une couleur écrite en nombre, comme le `0xFF…` de Dart, n'est pas trouvée. |
| 3 | La page de review est un fichier statique : elle produit la fiche review à enregistrer, sans serveur. |
| 3 | La review couvre aussi les composants, pour qu'un composant puisse passer à validé. |
| 3 | La review confronte le rendu à une capture de l'app réelle par état et par plateforme, posée à côté de la fiche avec la version qu'elle montre ; aidd-ui ne lance jamais l'app. Capture obligatoire ou non : à trancher. |
| 4 | `ui.md` cite les éléments par `id@version`, pour que la vérification d'après code voie ce qui a bougé pendant la feature. |
| 5 | `system.md` nomme le catalogue de traductions pour les textes trop longs ; l'audit d'une app existante part d'une base d'écarts acceptés, sinon il noie la personne. |
| 5 | Tailwind et Storybook restent hors détection ; l'audit les nomme comme limites quand il les trouve. |

## Context

- Brief approuvé : [brainstorm.md](./brainstorm.md).
- Découpage en pull requests : [roadmap.md](./roadmap.md).
