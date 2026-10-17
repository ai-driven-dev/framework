# Correction sécurité #992 — accès aux fichiers

Cette correction réduit les substitutions de chemins observables dans le lecteur de configuration Kilo et le hook mémoire. Elle ne promet pas une protection contre un processus hostile qui modifie puis restaure les mêmes répertoires entre les vérifications.

## Garanties mises en place

- `kilo-config.cjs` ouvre chaque configuration existante en lecture seule, lit depuis le descripteur, vérifie qu'il désigne un fichier régulier et compare l'identité `dev`/`ino` du descripteur et de chaque composant du chemin avant et après l'ouverture. Un fichier absent reste absent et aucun fichier n'est créé.
- `update_memory.js` ouvre les destinations existantes en lecture/écriture sans `O_TRUNC`, vérifie les composants et le descripteur, puis conserve le descripteur validé pour la mise à jour. Il écrit le contenu complet à l'offset zéro avant de tronquer l'ancien suffixe. Il garde l'inode et les métadonnées attachées au fichier; les bits de permission ordinaires restent inchangés, tandis que le système peut effacer des bits spéciaux lors d'une écriture. Les destinations avec plusieurs liens physiques sont refusées pour ne pas modifier un alias extérieur au projet.
- Les liens symboliques finaux et intermédiaires observés sont refusés. En mode automatique, une README mémoire symlink reste ignorée si elle n'est pas une destination opt-in; en mode explicite, une README opt-in dangereuse interrompt le préflight avant toute écriture.
- Les erreurs de préflight explicite arrivent avant les écritures. Le mode automatique reste best-effort entre fichiers, comme défini en phase 1.

## Modèle de menace et limites

Le modèle couvre les symlinks statiques et les substitutions de fichier ou de répertoire qui persistent assez longtemps pour être observées pendant les vérifications. Les tests injectent ces changements immédiatement après `open` et vérifient que les témoins extérieurs ne changent pas.

`O_NOFOLLOW` est utilisé sur les systèmes non Windows pour refuser un lien symbolique sur le dernier composant ouvert. Il ne protège pas les répertoires parents. Windows n'offre pas ce flag via les options portables de Node; l'identité du descripteur et les vérifications `lstat` avant/après sont donc les contrôles applicables. Node ne fournit pas ici un parcours portable de chaque parent relativement à un descripteur de répertoire (`openat`/équivalent). Un adversaire concurrent capable de substituer puis restaurer rapidement un parent peut encore gagner une fenêtre de course. Ce scénario n'est pas une garantie AIDD de cette fonctionnalité.

L'écriture sur le descripteur évite la troncature prématurée, le suivi d'un nouveau symlink final et le remplacement de l'inode, mais une erreur d'E/S après le début de l'écriture ou une interruption brutale peut laisser un contenu partiel. Il n'y a pas de transaction multi-fichier ni de rollback après panne; les limites déjà documentées en phase 1 restent applicables. Le refus des hardlinks peut interrompre la synchronisation d'un fichier utilisateur lié physiquement à un autre chemin.

## Preuves ciblées

- Remplacements du fichier et du parent juste après ouverture, en automatique et explicite : `scripts/__tests__/update-memory.test.js`.
- Mode et inode conservés, hardlink refusé, témoins extérieurs inchangés : `scripts/__tests__/update-memory.test.js`.
- Échec d'écriture injecté avant le premier octet : destination et témoin extérieur inchangés, en automatique et explicite : `scripts/__tests__/update-memory.test.js`.
- Remplacements du fichier et du parent pendant l'ouverture du lecteur de configuration : `scripts/__tests__/kilo-rule-publication.test.js`.
- Assertions de destinations Markdown exactes et refus des textes URL/lookalike hosts : `scripts/__tests__/context-kilo-detection.test.js` et `scripts/__tests__/context-skill-artifacts.test.js`.

La phase 2 de #914 reste `in-progress`. Cette correction sécurise seulement la lecture isolée de configuration; elle n'intègre pas le writer de #979 et ne valide aucun critère de publication finale. La phase 6 n'est pas exécutée par cette correction.
