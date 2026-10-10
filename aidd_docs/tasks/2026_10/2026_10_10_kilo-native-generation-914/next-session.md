# Reprise après phase 1 #914

Phase 1 terminée et revue, commits locaux par TASK explicitement autorisés. Plan global in-progress ; phases 2–6 pending et non autorisées. Aucun push, PR ou changement de branche. Ne pas recommencer l’installation ni la planification complète. Attendre l’autorisation utilisateur avant toute nouvelle phase.

## État et preuves

Branche attendue `feat/kilo-native-generation-914`, base initiale `41e91691b5837a8c27475d0115725131bb53bf41`. Lire `git status` et les trois derniers commits, sans changer de branche. [Rapport](phase-1-report.md), [review](review.md), [assertions](assertions-phase-1.md), [runtime](phase-1-runtime.md), [matrice](coverage-matrix.md) et [commits par tâche](commits-phase-1.json).

TASK 1 : six signaux dans les deux contrats de reconnaissance et 24 tests. TASK 2 : mémoire racine AGENTS, Set partagé, preflight explicite avant Upsert/Fill, conservation des bytes et automatic hook best-effort, 40 tests. TASK 3 : sources/date, génération Codex natif, lecture réelle et usage dans Kilo, coût 0, preuves et reprise. Phase 1 done seulement après ces validations. Aucun finalize du plan complet.

`make check` final : 606 tests, 604 pass, 2 skips existants Biome, 0 fail. Contrôles JSON et architecture exécutés aussi explicitement car leurs globs locaux les omettaient. Hooks pré-commit et commitlint exécutés à chaque commit. Les logs sont conservés sous evidence/phase-1 ; aucune inférence Claude authentifiée n’a été exécutée.

## Runtimes et limites

Codex principal : capacité native installée `02-project-memory`, action candidate effectivement exécutée dans le caller de cette session, fixture synthétique et hook final hashé. Trois évaluations Codex CLI ont sélectionné le skill local mais échoué à exécuter ses actions : `codex-code-mode-host` absent. Aucun outil réinstallé ; sorties 0 distinguées d’un succès. Le reçu caller est dans runtime-codex-caller-receipt.json.

Kilo 7.8.8 Linux : modèle explicite `kilo/cohere/north-mini-code:free`, metadata isFree et coûts 0 vérifiés avant usage. Zero credentials dans XDG isolé. Il découvre AGENTS, lit architecture.md et répond au jeton seulement disponible dans la mémoire. Kilo ajoute lui-même `$schema` au kilo.json de fixture ; AGENTS et banque sont inchangés. Aucun achat ni fallback payant.

Claude 2.1.296 : artefacts/synchronisation testés hors ligne, aucun accès Anthropic. CONTRIBUTING demande encore un test avec Claude dans un environnement authentifié existant ; signaler cette exception avant une future PR. OpenCode absent : contrats partagés testés, runtime non validé. Seul AC5 est entièrement acquis ; les critères transversaux restent partiels selon la matrice.

Les fichiers /tmp sont temporaires, les preuves utiles ont été archivées. Ne pas restaurer aveuglément les sauvegardes d’installation. Historique du plan/reprise conservé dans plan-before-phase-1.json, documents de planning conservés.

## Suite sous autorisation distincte

Avant phase 2, revalider #979 : snapshot historique Draft/open, next, head `303e17a1ba995dd19ec769381f7bbb594fbd1d7c`. Réutiliser le writer réellement fusionné ; si Draft, obtenir une décision explicite pour la dépendance. Aucun writer concurrent ni code Draft anticipé. Phase 1 n’attendait pas la réponse du mainteneur. #971 est déjà intégrée ; profil #744 et flat #868 restent hors scope.

Maintenir tests rouges pertinents, implémentation minimale, documentation, validation runtime et preuves par TASK. JSONC : préserver doublons/ordre/commentaires, prévalider toutes les destinations, limites crash honnêtes, aucun moteur générique. Phase 6 : vérifier plateformes supportées et contraintes runner avant adaptation ciblée de la CI existante. Ne pas commencer une phase seulement parce qu’elle serait indépendante.
