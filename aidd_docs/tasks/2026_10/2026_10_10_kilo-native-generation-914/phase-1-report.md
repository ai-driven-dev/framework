# #914 — Rapport phase 1

Reconnaissance Kilo et mémoire partagée implémentées, tests et runtime mémoire validés. Phases 2–6 non commencées. Aucun push, PR ou changement de branche. Les commits locaux sont enregistrés séparément après validation de leur tâche.

## Plan et autorisation

[Ajustements ciblés](plan-adjustments.md) : progression tests/preuves/statut par tâche ; décision si #979 reste Draft ; phase 2 sans moteur transactionnel générique ; support plateformes/runner à vérifier avant toute extension CI. Le snapshot exact précédent reste dans plan-before-phase-1.json. Seize AC conservés verbatim ; challenge 90 % demeure une appréciation historique du plan. Pas de nouvelle planification complète.

La clarification ultérieure autorise les commits locaux par tâche validée et prime sur l’interdiction de commit dans la demande collée. Le contrat installé implement prévoyait un commit par phase ; la préférence utilisateur par TASK prévaut. Plan global in-progress, phase 1 seule livrée, autres phases pending ; aucune action finalize du plan complet ni step-end global.

## Changement fonctionnel

TASK 1 : deux contrats de reconnaissance, six signaux Kilo et fixtures positives/négatives. AGENTS et configs OpenCode seuls ne détectent pas Kilo. La détection OpenCode reste `.opencode/`. `.kilocode/` est seulement historique, jamais une nouvelle destination.

TASK 2 : Kilo rejoint TOOL_FILES et le Set existant vers AGENTS ; TARGET_FILES inchangé. Sync prévalide avant Upsert, puis le hook prévalide le jeu complet avant Fill. Refus des marqueurs incomplets, doubles, imbriqués, inversés, mixtes et destinations non régulières, symlinks ou non inscriptibles. README contrôlé seulement si opt-in. Scanner partagé ; exemples hors bloc ignorés. Préservation des bytes utilisateur, BOM/CRLF/indentation, imports Claude et liens Copilot. Mode automatique best-effort et staging conservés. README plugin et cas skill-eval associés mis à jour.

TASK 3 : sources/date et preuve de génération/consommation ; fichiers et commandes dans [runtime](phase-1-runtime.md) et [reçu caller Codex](evidence/phase-1/runtime-codex-caller-receipt.json). Le caller natif utilise réellement le routeur installé et l’action candidate, sans mise à jour des plugins utilisateur. Kilo lit architecture.md via le lien et répond au token caché dans cette mémoire, coût 0.

## Validation et limites

| Commande ou preuve | Résultat |
| --- | --- |
| Tests détection avant changement | 24 échecs attendus : ligne Kilo absente |
| Tests mémoire initiaux | 16 pass / 18 fail dans sandbox ; restriction stderr identifiée |
| Rejeu hook initial Git, hors sandbox sur copie | 36 tests, 19 pass / 17 fail, exit 1 |
| Deux défauts de review avant correction | 2 tests, 2 fail : écriture préalable malgré chmod444 ; README sans opt-in refusé |
| Tests ciblés finaux | 64 tests : 40 mémoire + 24 détection, tous réussis |
| Mutation détection | omission signal imbriqué => 1 échec ciblé |
| Mutation mémoire | préflight désactivé => ancien contexte modifié, assertion échoue |
| make check final | exit 0, 606 tests / 604 pass / 2 skips / 0 fail |
| Architecture et JSON explicites | exit 0, 3 fichiers sans violation et 2 JSON valides |
| Runtime Kilo mémoire | read réel, réponse exacte, exit 0, deux coûts 0 |

Les [assertions AIDD](assertions-phase-1.md) et la [review](review.md) complètent ces preuves. Les deux skips sont des tests existants du formateur Biome, pas des validations Kilo converties en pass. Aucun fichier CLI modifié : lint/typecheck/knip CLI non requis ici.

Claude : tests hors ligne des vrais artefacts, ESM, marqueurs, imports, migration et idempotence. Aucun runtime Claude avec modèle authentifié. CONTRIBUTING demande de tester dans Claude et un autre outil : sa partie Claude reste non accomplie, explicitement signalée pour la future contribution. Codex CLI a sélectionné le skill mais ses trois runs sont bloqués par `codex-code-mode-host` absent ; le code 0 n’est pas un succès. Génération effective = caller natif actuel. OpenCode absent ; contrats partagés vérifiés par sous-processus, aucun runtime OpenCode. Kilo Linux seulement ; il ajoute `$schema` au kilo.json de fixture au démarrage, sans changer AGENTS ni mémoire.

Le préflight empêche les écritures sur les erreurs connues testées. Aucune transaction multi-fichiers face à crash, course concurrente ou erreur d’écriture imprévisible n’est promise. Aucun nouveau moteur générique.

Deux cas skill-eval sont ajoutés au corpus existant ; son runner Claude authentifié n’a pas été exécuté ici. Le parcours positif est validé dans Codex natif et Kilo ; le refus avant création est validé par les sous-processus et la revue du contrat, sans prétendre une seconde inférence CLI réussie.

## Traçabilité et suite

AC5 validé ; AC1–4, 13–16 partiels ; AC6–12 non implémentés. [Matrice détaillée](coverage-matrix.md), sans valider les critères transversaux trop tôt. L’onboarding autonome et tous les autres générateurs restent à prouver dans leurs phases.

#979 reste une dépendance future à revalider avant phase 2 ; pas d’attente ni de code Draft intégré en phase 1. Réutiliser sa version fusionnée ou obtenir une décision explicite si Draft. #971 déjà intégrée ; #744/#868 inchangées. Attendre une autorisation distincte avant toute autre phase.

Commits locaux : `4eed91c3` (TASK 1 reconnaissance, 24 tests), `9179e60d` (TASK 2 mémoire, 40 tests et runtime), puis `docs(aidd-context): record validated Kilo memory phase` (TASK 3 preuves/reprise ; SHA = HEAD à la livraison). [Registre](commits-phase-1.json). Les deux premiers hooks ont passé 604 tests, 2 skips et commitlint ; le troisième conserve les documents approuvés et l’historique dans le même dossier. Aucun fichier fonctionnel des autres phases.
