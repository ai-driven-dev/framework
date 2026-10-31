---
status: approved
---

# aidd-ui : un design system qui vit avec le code

Pour un dev qui conçoit l'UI avec une IA : le plugin crée, fait évoluer et versionne un design system, et le relie aux écrans et au code, pour que chaque changement soit tracé et propagé sans travail manuel.

## Clair

### Périmètre

- Tout est dans le périmètre de la première version, versionnage par élément compris. Les étapes forment une seule chaîne, pas des outils séparés.
- La chaîne : marque et identité (projet, utilisateurs, domaine, plateformes), tokens, atomes, molécules, compositions, parcours et wireframes, écrans finis, code.
- La marque part du contexte réel (utilisateurs, domaine, plateformes), pas d'un style par défaut.
- Deux points de départ : un projet vierge, où le DS est construit, et un projet existant, où le DS est extrait du code.
- Les skills suivent le format lean de brainstorm, plan et implement : chaque mot a sa place.

### Emplacement

- Tout vit dans `aidd_docs/ui/`, un dossier dédié avec un fichier par élément. Les parcours vont dans `ui/journeys/`. Rien n'est posé à côté du code.
- L'IA écrit les fiches, chacune suivant son template : token, atome, molécule, composition, écran, parcours.
- Les artefacts ne dépendent d'aucune techno. Les tokens suivent le format W3C DTCG 2025.10. Figma et Claude Design se branchent, le contrat du projet fait foi.

### Lien

- Le lien entre le design system, les écrans et le code est le cœur du plugin. On relie composants et écrans, pas chaque token.
- Chaque élément correspond à un seul fichier de code, identifié par son chemin et le nom du composant.
- Les usages se lisent dans les compositions du DS, et le rapport d'impact remonte cet arbre.

### Feature

- Chaque feature a son `ui.md`, le contrat UI de la feature. Une fois la feature implémentée, le code est vérifié contre ce contrat et l'index est mis à jour.
- Quand un élément change : rapport d'impact, validation, régénération de ce qui est touché, nouvelle validation si besoin, puis nouvelle version du DS.

### Vitrine

- Un script génère la vitrine à partir des fiches et de templates HTML fixes, sans IA : le rendu est identique à chaque fois et se régénère à volonté.
- Elle montre les éléments, leurs liens et l'endroit où chacun est utilisé.
- Les écrans y apparaissent dans leur version validée, la maquette HTML créée par l'IA avec les vrais tokens, et chacun porte un lien vers le réel (route ou fichier).

### Vérifications

- Des scripts Node déterministes, qui tournent partout sans IA, vérifient le format de chaque fichier généré (écrans HTML compris), un lien vers un fichier absent, un fichier UI absent de l'index, une composition qui utilise un élément inexistant, et une valeur en dur dans le code.
- Une fiche mal formée bloque la construction de la vitrine.
- Des hooks (`SessionStart`, `PostToolUse` sur `aidd_docs/ui/`) lancent ces scripts. Ce sont les mêmes scripts qu'on lance à la main, donc ils marchent aussi dans les outils sans hooks.
- L'IA juge le sens : le code fait-il ce que dit le `ui.md` ?

### Audit et review

- L'audit UI appartient au plugin. Il constate et ne corrige rien. Il compare le validé et le réel : capture d'écran sur le web, fiche contre code ailleurs. Le volet UI de l'audit dev est retiré une fois cet audit en place.
- La review design se fait dans une page HTML interactive : OK ou pas OK par écran, avec un commentaire, et les verdicts sont enregistrés dans un fichier du projet. Quand l'utilisateur dit qu'il a fini, l'IA lit le fichier et continue.
- La review code reste dans dev. L'accessibilité fait partie du plugin.

### Signal de réussite

Sur un projet vierge comme sur un projet existant :

- le flow complet passe de bout en bout jusqu'à tous les écrans voulus ;
- les features générées ensuite sont liées, sans dérive, et testées ;
- les mises à jour et le cycle de vie s'enchaînent de façon cohérente.

## Supposé

- On repart de zéro et l'ancienne PR aidd-ui est fermée. Seules ses idées sont gardées : boucle delta, ordre de priorité entre sources, classes de dérive.
- La vitrine s'inspire d'un outil propriétaire vu en démo : DS, liens et usages visibles, tout normé et vérifié par script.
- Le réel n'est rendu que sur le web. Ailleurs, l'audit compare la fiche au code.

## Ouvert

- Projet pilote : Gouvernail ou Keros pour le cas vierge. Le cas existant demande un projet qui a déjà du code UI.
