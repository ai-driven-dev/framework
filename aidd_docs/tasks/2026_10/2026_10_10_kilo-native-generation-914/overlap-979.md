# Chevauchement avec #979

Lecture GitHub du 10 octobre 2026 : [#979](https://github.com/ai-driven-dev/framework/pull/979) open, draft=true, merged=false, base next, base_sha 7f0b344b4ae37c083aa9473e0e6347b196b630ef, head 303e17a1ba995dd19ec769381f7bbb594fbd1d7c. Le merge_commit_sha fourni pour une PR ouverte n'est pas une fusion réalisée. Base locale #914 : 41e91691b5837a8c27475d0115725131bb53bf41. Ne pas supposer que next distant correspond encore à cette base.

Patch réellement inspecté : actions/02-write-rule.md et nouveau scripts/write-rule.cjs, après listing des fichiers modifiés (197). Métadonnées, description et listing archivés dans remote-state.json. Pas de revue exhaustive des 197 fichiers de #979 prétendue ici.

Le writer de #979 produit sources aidd_docs/rules, sorties Claude/Cursor/Copilot et contribution signée dans AGENTS.md pour Codex/OpenCode. Il exclut Kilo. Préflight global des destinations et ownership, puis renommages atomiques par fichier ; sa description exclut explicitement le rollback global après panne disque. Donc extension par simple ajout de kilo dans TOOLS insuffisante : il faut gérer config + règle + source comme une publication cohérente.

## Décision proposée

Avant l’intégration de phase 2, recontrôler état/head de #979. Si fusionnée, projeter #914 sur le writer intégré et conserver intégralement ses sorties non Kilo. Tant que #979 reste Draft, l’autorisation du 10 octobre 2026 permet seulement les fixtures, tests, module isolé `kilo-config.cjs` et validations Kilo sans publication décrits dans phase-2.md. L’intégration au writer, la publication source + règle + configuration et ses régressions restent suspendues jusqu’à nouvelle décision explicite et revalidation de la base. Aucun cherry-pick, rebase ou changement de branche. Ne pas copier le writer Draft ou construire un writer concurrent. Une décision de poursuivre l’intégration sur l’ancienne base devra amender ce plan explicitement.

Après disponibilité du writer : ajouter un rendu Kilo au même flux autonome, un module d'édition Kilo local au skill, préflight de toute entrée et staging avant publication. Réutiliser les 59 tests annoncés de #979 seulement après vérification de leur présence réelle dans la base ; ce chiffre est une déclaration de PR, pas notre résultat de test. N'importer ni le resolver CLI strict ni des dépendances du checkout dans un skill installé.

## Risques et contrôles

- Conflit élevé : actions et références de 05-rule-generate, tests de publication, ownership et docs ; aucun conflit attendu sur profils CLI.
- Régression élevée : contribution AGENTS.md des règles versus bloc mémoire ; invariants de deux blocs disjoints, user bytes intacts, sélection Kilo-only n'ajoute pas deux fois une contribution commune.
- Les anciens contrats .codex/rules et .opencode/rules dans HEAD ne deviennent pas corrects par un snapshot. Établir une baseline de la base effectivement retenue ; les corrections #979 sont des deltas acceptés, pas des régressions Kilo.
- Réexécuter les cas standalone copiés hors checkout, projet ESM, sans binaire aidd, native et flat existant ; vérifier seulement la livraison de nos assets, pas ajouter la distribution de règles flat #868.
- Aucun merge de #979, commentaire ou PR distante dans cette session.

[#971](https://github.com/ai-driven-dev/framework/pull/971) : merged=true, base next, fusion le 8 octobre 2026 ; commit 12777d03808cee29f611e18d3816ae62ebc5c969 déjà dans HEAD. Garder ses adaptateurs et tests, sans nouvelle conversion de hooks. Ses preuves antérieures Kilo 7.7.5 ne remplacent pas les futures preuves #914 sur 7.8.8.
