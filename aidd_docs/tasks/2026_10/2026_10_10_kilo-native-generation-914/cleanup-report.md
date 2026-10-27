# Nettoyage documentaire de la PR #992

Date de l'archive initiale : 12 octobre 2026. Mise à jour de l'inventaire : 27 octobre 2026. Dossier concerné : cette archive de tâche uniquement.

## Résultat

Inventaire initial : 212 fichiers, 2,1 Mo. L'archive issue de la PR #992 comptait 58 fichiers ; cette passe retire trois artefacts redondants et ajoute `review.md`, soit 56 fichiers après nettoyage. L’objectif était une réduction forte vers 42, pas un quota. Les tailles historiques ci-dessous ne sont pas réutilisées comme mesure de l'état courant ; l'inventaire courant est vérifié par les validations de cette passe.

Les plans actifs, les six phases, rapports, matrice, décisions importantes, limites et un minimum de replay de phase 4 sont conservés. Les résultats historiques dont les journaux ont été retirés restent identifiés comme historiques ; aucun succès nouveau n’est revendiqué.

## Provenance et replay

Le texte retrouvé en lecture seule dans `stash@{0}` indique que le backup local B1 conserve l’état documentaire modifié avant nettoyage, pas un original brut distinct. Aucun manifeste ou hash indépendant du backup B1, ni copie externe des exports bruts, n’a été trouvé dans le dépôt. Ne pas interpréter B1 comme une preuve d’intégrité des captures supprimées. Le snapshot machine-readable antérieur à la phase 1 a été supprimé comme doublon du plan/phases conservés et parce qu’il contenait des chemins locaux et des liens historiques obsolètes ; les décisions utiles sont résumées dans `plan-adjustments.md` et `phase-1-report.md`.

Le stash n’a pas été appliqué, dépilé ni supprimé. Ses deux nouveaux journaux phase 2 obsolètes n’ont pas été restaurés. Le changement utile de `replay-kilo.sh` a été reporté manuellement : les sorties masquent maintenant le `$HOME` courant en `$USER_HOME` par remplacement littéral et les répertoires temporaires utilisent `$TMPDIR` lorsqu’il est défini. Cela rend le masquage indépendant d’un home particulier et sûr face aux caractères spéciaux shell, sans ajouter de garantie macOS/Windows. Le script mis à jour n’a pas été exécuté. L’essai `attempt-04` conservé correspond à une version précédente du script. Un futur replay doit utiliser un nom d’essai inédit pour préserver cette capture.

Preuves supplémentaires gardées : jeux d’entrée/sortie expurgés de l’observation phase 2 ; preuve minimale phase 4 avec JSONL réussi, code de sortie, modèle gratuit sélectionné et hashes avant/après ; log de mutations phase 5 utile à l’audit du contrat de sécurité ; description de la correction CodeQL et de ses limites de plateforme. Les exports de session historiques phase 4 ont été retirés car leurs marqueurs conservaient des identifiants techniques ; leur contenu n’est pas reconstruit.

## Limites de validation à conserver

- Phase 2 reste partielle selon ses critères ouverts et `in-progress`.
- Phase 6 reste `in-progress`, verdict **NOT READY**.
- Aucune validation Claude authentifiée n’a été réalisée.
- La couverture macOS/Windows reste incomplète ; Linux seulement pour les observations runtime archivées ici.
- Le scénario runtime des hooks Claude/Codex/Cursor/Copilot n’a pas été validé à cause du sandbox Codex enfant.
- Un test échoué, un test non exécuté et une validation réussie gardent des statuts distincts dans les rapports.

## Vérifications après nettoyage

Le contrôle Markdown de cette passe rapporte 0 lien cassé dans 38 fichiers ; les 43 tests ciblés des vérificateurs documentaires et du contrat de revue passent. `bash -n` accepte `replay-kilo.sh`, les hashes de la fixture correspondent au manifeste et les fichiers de hash avant/après sont identiques selon les vérifications déjà consignées. Le replay lui-même n’a pas été lancé. Aucune archive conservée n’est une dépendance d’un test ou script permanent du dépôt. Aucun code fonctionnel ni test permanent n’a été modifié. Aucun fichier n’a été staged ou commité. `git diff --check` passe.

Le scan de confidentialité n’a détecté aucun motif courant de secret (clés/API tokens, clés privées, mot de passe ou bearer token). L’identité du fork privé et les chemins personnels `$HOME` ont été expurgés ou normalisés dans les fichiers conservés où ils apparaissaient. Les journaux retenus demeurent des traces historiques expurgées, pas des sorties reproductibles.

## Fichiers conservés

- `challenge.md`
- `coverage-matrix.md`
- `environment-evidence.md`
- `evidence/phase-2/runtime-corrections-negative-config.jsonc`
- `evidence/phase-2/runtime-corrections-positive-config.jsonc`
- `evidence/phase-2/runtime-corrections-rule.md`
- `evidence/phase-2/runtime-negative-redacted.jsonl`
- `evidence/phase-2/runtime-positive-redacted.jsonl`
- `evidence/phase-2/runtime-report.md`
- `evidence/phase-2/runtime-request.json`
- `evidence/phase-4/README.md`
- `evidence/phase-4/attempt-04-outside-sandbox/artifact-hashes-consumed-after.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/artifact-hashes-consumed-before.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/selected-free-model.stdout.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/workflow-run.exit.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/workflow-run.redacted.jsonl`
- `evidence/phase-4/caller-receipt.json`
- `evidence/phase-4/extract-free-model.cjs`
- `evidence/phase-4/generated-project/.kilo/agents/assets/agent-payload.txt`
- `evidence/phase-4/generated-project/.kilo/agents/verify-agent.md`
- `evidence/phase-4/generated-project/.kilo/commands/verify-workflow.md`
- `evidence/phase-4/generation-validation.json`
- `evidence/phase-4/replay-kilo.sh`
- `evidence/phase-4/source-contract-hashes.txt`
- `evidence/phase-4/validate-generation.cjs`
- `evidence/phase-5/source-contract-mutations.log`
- `evidence/security-fix/filesystem-access.md`
- `evidence/security-fix/platform-followup.md`
- `gather.md`
- `issue-914.md`
- `official-sources.md`
- `overlap-979.md`
- `phase-1-report.md`
- `phase-1-runtime.md`
- `phase-1.md`
- `phase-2-report.md`
- `phase-2.md`
- `phase-3-report.md`
- `phase-3-runtime.md`
- `phase-3.md`
- `phase-4-report.md`
- `phase-4-runtime.md`
- `phase-4.md`
- `phase-5-report.md`
- `phase-5.md`
- `phase-6-report.md`
- `phase-6.md`
- `plan-adjustments.md`
- `plan.md`
- `planning-validation.md`
- `evidence/stage-b-targeted-validation.md`
- `follow-up-path-scoping.md`
- `review.md`
- `test-strategy.md`
- `user-request.md`
- `cleanup-report.md` (ce manifeste et les décisions de nettoyage)

## Fichiers retirés dans la passe minimale du 27 octobre 2026

- `evidence/phase-4/generated-artifact-hashes.txt` : doublon de la preuve de hashes dans `generation-validation.json` et des sorties de replay conservées ; le nom reste utilisé uniquement pour les sorties générées par le script, pas comme artefact versionné.
- `evidence/phase-5/source-contract-final-sweep.log` : détail redondant avec le résultat final et le log de mutations conservé, désormais référencés depuis `phase-5-report.md` et `coverage-matrix.md`.
- `remote-state.json` : snapshot volumineux et sensible aux métadonnées distantes, remplacé par les faits d'audit minimaux dans `overlap-979.md`.

## Fichiers supprimés lors du nettoyage initial

- `assertions-phase-1.md`
- `assertions-phase-3.md`
- `assertions-phase-4.md`
- `backlog-link.json`
- `commits-phase-1.json`
- `commits-phase-3.json`
- `evidence/phase-1/artifact-validation.json`
- `evidence/phase-1/detection-green.txt`
- `evidence/phase-1/detection-mutation.txt`
- `evidence/phase-1/detection-red.txt`
- `evidence/phase-1/make-check-before-review-fixes.txt`
- `evidence/phase-1/make-check-final.txt`
- `evidence/phase-1/memory-baseline-red.txt`
- `evidence/phase-1/memory-green.txt`
- `evidence/phase-1/memory-mutation.txt`
- `evidence/phase-1/memory-red.txt`
- `evidence/phase-1/memory-review-green.txt`
- `evidence/phase-1/review-before-final.txt`
- `evidence/phase-1/review-regressions-red.txt`
- `evidence/phase-1/runtime-cli-attempt-source-hashes.json`
- `evidence/phase-1/runtime-codex-attempt-1.jsonl`
- `evidence/phase-1/runtime-codex-attempt-2.jsonl`
- `evidence/phase-1/runtime-codex-attempt-3.jsonl`
- `evidence/phase-1/runtime-codex-caller-receipt.json`
- `evidence/phase-1/runtime-codex.stderr.txt`
- `evidence/phase-1/runtime-generated-artifacts.json`
- `evidence/phase-1/runtime-kilo-hook-only-attempt.jsonl`
- `evidence/phase-1/runtime-kilo-hook-only-attempt.stderr.txt`
- `evidence/phase-1/runtime-kilo-model.json`
- `evidence/phase-1/runtime-kilo.jsonl`
- `evidence/phase-1/runtime-kilo.stderr.txt`
- `evidence/phase-1/runtime-source-hashes.json`
- `evidence/phase-1/runtime-verification.json`
- `evidence/phase-1/targeted-green.txt`
- `evidence/phase-2/focused-corrections.txt`
- `evidence/phase-2/focused-tests.log`
- `evidence/phase-2/kilo-config-probe.cjs`
- `evidence/phase-2/kilo-config-probe.json`
- `evidence/phase-2/owner-mutation.log`
- `evidence/phase-2/pre-commit.log`
- `evidence/phase-2/scripts-full-corrections.txt`
- `evidence/phase-2/scripts-tests.log`
- `evidence/phase-3/caller-fixture-inputs.py`
- `evidence/phase-3/caller-modify-rerun.json`
- `evidence/phase-3/caller-modify.py`
- `evidence/phase-3/caller-native-codex-refusal.json`
- `evidence/phase-3/caller-receipt.json`
- `evidence/phase-3/caller-refusals.json`
- `evidence/phase-3/caller-refusals.py`
- `evidence/phase-3/caller-shared-fields-refusal.json`
- `evidence/phase-3/caller-write.py`
- `evidence/phase-3/contracts-green.txt`
- `evidence/phase-3/contracts-red.txt`
- `evidence/phase-3/detection-mutation.txt`
- `evidence/phase-3/explicit-checks.txt`
- `evidence/phase-3/kilo-catalog-native.json`
- `evidence/phase-3/kilo-catalog-portable.json`
- `evidence/phase-3/kilo-free-model.json`
- `evidence/phase-3/kilo-native-exact.jsonl`
- `evidence/phase-3/kilo-native-exact.stderr.txt`
- `evidence/phase-3/kilo-native.jsonl`
- `evidence/phase-3/kilo-native.stderr.txt`
- `evidence/phase-3/kilo-portable.jsonl`
- `evidence/phase-3/kilo-portable.stderr.txt`
- `evidence/phase-3/make-check-final.txt`
- `evidence/phase-3/make-check-staged.txt`
- `evidence/phase-3/make-check.txt`
- `evidence/phase-3/preflight-mutation-weak-guard.txt`
- `evidence/phase-3/preflight-mutation.txt`
- `evidence/phase-3/review-findings-resolved.md`
- `evidence/phase-3/runtime-oracle.py`
- `evidence/phase-3/runtime-verification.json`
- `evidence/phase-3/targeted-green.txt`
- `evidence/phase-3/tracking-verification.json`
- `evidence/phase-4/attempt-02-dns-timeout/agent-debug.exit.txt`
- `evidence/phase-4/attempt-02-dns-timeout/agent-debug.stderr.txt`
- `evidence/phase-4/attempt-02-dns-timeout/agent-debug.stdout.json`
- `evidence/phase-4/attempt-02-dns-timeout/artifact-hashes-consumed-after.txt`
- `evidence/phase-4/attempt-02-dns-timeout/artifact-hashes-consumed-before.txt`
- `evidence/phase-4/attempt-02-dns-timeout/generated-artifact-hashes.txt`
- `evidence/phase-4/attempt-02-dns-timeout/kilo-version.exit.txt`
- `evidence/phase-4/attempt-02-dns-timeout/kilo-version.stderr.txt`
- `evidence/phase-4/attempt-02-dns-timeout/kilo-version.txt`
- `evidence/phase-4/attempt-02-dns-timeout/model-catalog.exit.txt`
- `evidence/phase-4/attempt-02-dns-timeout/model-catalog.stderr.txt`
- `evidence/phase-4/attempt-02-dns-timeout/source-contract-hashes.txt`
- `evidence/phase-4/attempt-02-dns-timeout/workflow-run.exit.txt`
- `evidence/phase-4/attempt-02-dns-timeout/workflow-run.redacted.jsonl`
- `evidence/phase-4/attempt-02-dns-timeout/workflow-run.stderr.txt`
- `evidence/phase-4/attempt-03-replay/agent-debug.exit.txt`
- `evidence/phase-4/attempt-03-replay/agent-debug.stderr.txt`
- `evidence/phase-4/attempt-03-replay/agent-debug.stdout.json`
- `evidence/phase-4/attempt-03-replay/artifact-hashes-consumed-after.txt`
- `evidence/phase-4/attempt-03-replay/artifact-hashes-consumed-before.txt`
- `evidence/phase-4/attempt-03-replay/generated-artifact-hashes.txt`
- `evidence/phase-4/attempt-03-replay/kilo-version.exit.txt`
- `evidence/phase-4/attempt-03-replay/kilo-version.stderr.txt`
- `evidence/phase-4/attempt-03-replay/kilo-version.txt`
- `evidence/phase-4/attempt-03-replay/model-catalog.exit.txt`
- `evidence/phase-4/attempt-03-replay/model-catalog.stderr.txt`
- `evidence/phase-4/attempt-03-replay/selected-free-model.stdout.txt`
- `evidence/phase-4/attempt-03-replay/source-contract-hashes.txt`
- `evidence/phase-4/attempt-03-replay/workflow-run.exit.txt`
- `evidence/phase-4/attempt-03-replay/workflow-run.redacted.jsonl`
- `evidence/phase-4/attempt-03-replay/workflow-run.stderr.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/agent-debug.exit.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/agent-debug.stderr.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/agent-debug.stdout.json`
- `evidence/phase-4/attempt-04-outside-sandbox/generated-artifact-hashes.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/kilo-version.exit.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/kilo-version.stderr.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/kilo-version.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/main-session-export.exit.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/main-session-export.stderr.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/main-session.sanitized.json`
- `evidence/phase-4/attempt-04-outside-sandbox/model-catalog.exit.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/model-catalog.stderr.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/source-contract-hashes.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/subagent-session-export.exit.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/subagent-session-export.stderr.txt`
- `evidence/phase-4/attempt-04-outside-sandbox/subagent-session.sanitized.json`
- `evidence/phase-4/attempt-04-outside-sandbox/workflow-run.stderr.txt`
- `evidence/phase-4/historical-session-export/main-session-export.exit.txt`
- `evidence/phase-4/historical-session-export/main-session-export.stderr.txt`
- `evidence/phase-4/historical-session-export/main-session.sanitized.json`
- `evidence/phase-4/historical-session-export/subagent-session-export.exit.txt`
- `evidence/phase-4/historical-session-export/subagent-session-export.stderr.txt`
- `evidence/phase-4/historical-session-export/subagent-session.sanitized.json`
- `evidence/phase-5/caller-receipt.json`
- `evidence/phase-5/diff-check-final.log`
- `evidence/phase-5/fixture-hashes.txt`
- `evidence/phase-5/kilo-7.7.5-install.txt`
- `evidence/phase-5/kilo-7.7.5-smoke-sandbox-blocked.log`
- `evidence/phase-5/kilo-7.7.5-smoke.log`
- `evidence/phase-5/kilo-isolation-verification.txt`
- `evidence/phase-5/make-check-final.log`
- `evidence/phase-5/make-check.log`
- `evidence/phase-5/markdown-links-final.log`
- `evidence/phase-5/persona-rerun.log`
- `evidence/phase-5/rerun-after-mtime.txt`
- `evidence/phase-5/rerun-before-mtime.txt`
- `evidence/phase-5/rerun-decision.txt`
- `evidence/phase-5/review.md`
- `evidence/phase-5/source-contract-mutation-probe.log`
- `evidence/phase-5/source-contract-mutations-iteration-1.log`
- `evidence/phase-5/test-changed-final.log`
- `evidence/phase-5/test-changed.log`
- `evidence/phase-5/validation.json`
- `evidence/security-fix/pre-security-fix-review.md`
- `explore.md`
- `next-session.md`
- `phase-1-request.md`
- `phase-5-runtime.md`
- `plan-before-phase-1.json`
- `resume.md`
- `review-phase-1.md`
- `review.md`
