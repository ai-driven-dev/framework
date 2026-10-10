# Assertions AIDD de phase 1

Capacité installée `aidd-dev:03-assert` appliquée : action coding, et facet architecture demandé par les contraintes de la contribution. Frontend omis : aucune UI.

Coding : PASS. Passe finale `make check`, exit 0, 606 tests, 604 réussis, 2 skips existants Biome, aucun échec. JSON et architecture étaient omis par les globs Lefthook ; contrôles explicitement exécutés : `node scripts/validate-json.mjs scripts/skill-eval/cases.json scripts/__tests__/fixtures/context-generation/detection/cases.json` => 2 fichiers valides, exit 0 ; `node scripts/check-architecture-rules.js` sur les trois références/actions modifiées => 3 fichiers, zéro violation, exit 0. Commitlint reste exécuté par chaque commit-msg hook.

Corrections de la boucle : prévalidation complète avant Fill ; préflight avant Upsert ajouté au contrat ; refus des destinations non inscriptibles et symlinks ; README sans opt-in exclu ; scanner partagé et exemples ignorés ; bytes extérieurs et CRLF préservés. Les diffs correspondants sont dans `plugins/aidd-context/hooks/update_memory.js`, `actions/04-sync.md` et les sous-processus de `update-memory.test.js`.

Architecture macro : no violations. Responsabilité conservée dans aidd-context pour onboarding/mémoire ; aucun profil CLI, bootstrap, flat, writer de règles ou bridge modifié. Architecture micro : no violations. Le hook reste autonome, sans import inter-plugin ; scanner local partagé, TARGET_FILES inchangé, Set de destinations réutilisé. Références : docs/ARCHITECTURE.md et mémoire architecture/codebase-map lus pour la contribution.

Preuves : [sweep final](evidence/phase-1/make-check-final.txt), [64 tests ciblés](evidence/phase-1/targeted-green.txt), [runtime mémoire](phase-1-runtime.md). Les gates de commit suivants sont des contrôles obligatoires supplémentaires, pas une justification pour élargir le périmètre.
