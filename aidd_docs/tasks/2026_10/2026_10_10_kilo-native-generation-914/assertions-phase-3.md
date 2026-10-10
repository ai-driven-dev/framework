# #914 — Assertions phase 3

Skill natif `aidd-dev:03-assert`, action coding réellement appliquée : lecture des assertions projet, réparation, sweep final. Frontend non applicable ; architecture vérifiée explicitement pour respecter la responsabilité aidd-context.

- Tests rouges avant contrat : six échecs attendus, dont cinq invariants absents et corpus généré absent, dans [red](evidence/phase-3/contracts-red.txt). Premier appel sandbox du wrapper refusé par résolution hooks Git ; exécution protégée hors sandbox ensuite, sans remplacer le wrapper.
- Tests ciblés finaux : 24 tests, 24 pass, 0 fail, 0 skip dans [targeted](evidence/phase-3/targeted-green.txt). Contrats, six signaux + fixtures négatives, sept arbres réellement générés, YAML/liens/hashes, modify/rerun/refus caller et oracles traces runtime.
- Mutations : omission signal imbriqué rend la garde rouge ; suppression préflight rend la garde rouge. Une première garde comparait index -1 et passait à tort ; [contre-preuve](evidence/phase-3/preflight-mutation-weak-guard.txt) conservée, garde corrigée puis [mutation réussie](evidence/phase-3/preflight-mutation.txt). Ces mutations portent sur le contrat, pas sur un moteur writer inexistant.
- `make check` final sur fichiers stagés : 630 tests, 628 pass, 2 skips existants Biome, 0 fail. [Sweep](evidence/phase-3/make-check-final.txt). Le premier [appel non stagé](evidence/phase-3/make-check.txt) avait ignoré tous les jobs et ne compte pas. Sweep précédent 625 tests également conservé.
- Architecture et JSON contrôlés explicitement car les globs hooks locaux les omettent : six fichiers gouvernés sans violation ; corpus + JSON preuves valides dans [contrôles](evidence/phase-3/explicit-checks.txt).
- Aucune source CLI modifiée : lint/typecheck/knip CLI non applicables. Suite scripts inclut non-régressions mémoire/détection de phase 1. Pas de reconstruction CLI/distribution pour une modification de contrats de génération uniquement.
- Review code/fonctionnelle indépendante : deux ambiguïtés partagées trouvées et corrigées avant clôture, puis approve. [Review courante](review.md), [retour initial](evidence/phase-3/review-findings-resolved.md). Commitlint et hooks sont requis au commit local.

La suite vérifie des contrats Markdown interprétés et des preuves enregistrées, sans simuler un writer LLM. Les sept cas skill-eval ajoutés n’ont pas été exécutés avec Claude authentifié. Les parcours effectivement exécutés sont distingués dans [runtime](phase-3-runtime.md).
