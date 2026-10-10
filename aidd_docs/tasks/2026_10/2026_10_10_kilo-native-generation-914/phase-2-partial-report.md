# Phase 2 — tranche de configuration indépendante

Statut : `in-progress`. Autorisation du 10 octobre 2026 limitée aux fixtures, tests, module de configuration et sondes Kilo sans publication. Le writer #979 et ses fichiers restent intacts.

## Réalisation

`plugins/aidd-context/skills/05-rule-generate/scripts/kilo-config.cjs` exporte deux opérations sans écriture : `inspectProject(projectRoot, instructionPath, chosenPath?)` inventorie et valide les quatre configurations projet puis retourne les candidates et le choix, et `prepareInstructionEdit(content, instructionPath)` retourne le texte JSONC projeté et `changed`. Une seule entrée exacte propriétaire est réutilisée ; zéro config propose `.kilo/kilo.jsonc` ; plusieurs sans propriétaire unique imposent un choix. Les clés `instructions` échappées sont reconnues, mais les clés dupliquées, valeurs non-tableau, éléments non-string, JSONC malformé, UTF-8 invalide, chemins non canoniques et liens symboliques sont refusés. Les fonctions ne créent ni config, ni règle, ni source.

Les fixtures `scripts/__tests__/fixtures/context-generation/kilo-config/` couvrent commentaires, virgules finales, URL `//`, clé échappée et configurations invalides. `scripts/__tests__/kilo-rule-publication.test.js` exerce la sélection avec filesystem réel, la conservation des octets hors insertion, les doublons, le second passage identique, les refus sans mutation et le module copié dans un projet ESM sans CLI. Le nom de la suite réserve la future publication ; ses tests actuels portent uniquement sur le module isolé.

## Preuves

- [Suite ciblée](evidence/phase-2/focused-tests.log) : 13/13 passés. Le premier passage avant implémentation échouait sur `Cannot find module .../kilo-config.cjs` ; le test a été écrit avant le module.
- [Mutation propriétaire multiple](evidence/phase-2/owner-mutation.log) : remplacer `owners.length === 1` par `>= 1` dans une copie `/tmp` fait échouer le test nommé, sans modifier la source suivie par Git.
- [Suite scripts finale](evidence/phase-2/scripts-tests.log) : 652/652 passés après les derniers ajustements du parseur. La [sortie des assertions pré-commit](evidence/phase-2/pre-commit.log) est conservée séparément.
- [Sonde Kilo 7.8.8](evidence/phase-2/kilo-config-probe.json) et son [script](evidence/phase-2/kilo-config-probe.cjs) : les quatre `instructions` sont fusionnées dans l’ordre observé racine JSON, racine JSONC, `.kilo` JSONC, `.kilo` JSON. Le JSONC commenté avec doublons et référence exacte est produit par `prepareInstructionEdit`, puis apparaît dans la config résolue ; avec le même fichier règle mais sans référence, `instructions` est vide. La sonde ne prouve pas encore que le corps est transmis au modèle. `kilo debug config` reformate les configs temporaires et crée `.kilo/.gitignore` ; ces effets propres au binaire sont consignés dans `changedPaths`, et les projets temporaires sont supprimés après chaque run.

## Restant bloqué

Le rendu et l’intégration au writer #979, le préflight de toute publication, les garanties d’échec source + règle + configuration, le chargement effectif du corps Kilo et les régressions des autres cibles. Aucun critère de publication complet de phase 2 n’est déclaré satisfait par cette tranche.
