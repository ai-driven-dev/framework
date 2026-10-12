# Rapport de phase 2 — Règles Kilo

## Résultat et statut

L’implémentation de phase 2 étend le writer partagé intégré par #979. Kilo utilise les sources canoniques existantes et le même cycle de publication, les mêmes contrôles de propriété, de préservation et de rollback. `kilo-config.cjs` sélectionne et prépare l’édition JSONC ; il n’effectue pas une seconde publication.

Les critères techniques propres à la phase sont satisfaits. Le statut reste **`in-progress`** : `CONTRIBUTING.md` demande `make reload`, le redémarrage des sessions et un test dans Claude et un autre outil. Kilo est l’autre outil testé ; aucune validation runtime Claude authentifiée n’est disponible. Aucune exception explicite du mainteneur n’est documentée. Ne pas marquer `completed` avant cette validation ou cette exception. Le plan global reste `in-progress`, la phase 6 étant toujours ouverte.

## Tests et portée des preuves

- [Tests ciblés](evidence/phase-2/focused-corrections.txt) : **90/90 passés**. Ils couvrent le writer de #979 et l’intégration Kilo, génération/publication, préflight, refus sans mutation, préservation JSONC, idempotence, erreurs simulées et rollback. Ils démontrent le comportement du code dans les fixtures de test, pas le chargement par un client Kilo.
- [Suite scripts](evidence/phase-2/scripts-full-corrections.txt) : **795/795 passés**. Ce résultat est une validation automatisée du dépôt, pas une validation runtime des autres hôtes.
- [Observation runtime Kilo](evidence/phase-2/runtime-report.md) : Kilo CLI 7.8.8 sous Linux a répondu avec le marqueur de la règle publiée ; en retirant uniquement `instructions`, une session neuve n’a pas reçu le marqueur. Cette preuve concerne cette fixture et cette version. Les sorties publiques sont expurgées ; les captures brutes restent hors des livrables.
- Les tests de fichier démontrent la préservation des commentaires, du formatage, des doublons, de l’ordre et des valeurs sans rapport. Ils ne constituent pas une preuve de résolution runtime dans Kilo.

## Limites

- Claude Code authentifié : non testé ; exigence `CONTRIBUTING.md` encore ouverte.
- Windows : non testé ; sémantique des modes de fichiers non validée sur Windows.
- Le mécanisme ne garantit pas l’absence de courses entre vérification et appel système, ni la restauration après mutation externe concurrente, arrêt brutal ou panne machine. Le fan-out multi-fichiers n’est pas une transaction globale.
- Le runtime Kilo n’est prouvé que sur Linux avec Kilo 7.8.8 et le modèle disponible au moment de l’essai.

## Mise à jour du plan

La matrice de couverture distingue les tests de fichier des observations runtime. La phase reste `in-progress` jusqu’au contrôle Claude exigé ou à une exception explicite du mainteneur ; la phase 6 est ouverte et distincte de ce bilan.
