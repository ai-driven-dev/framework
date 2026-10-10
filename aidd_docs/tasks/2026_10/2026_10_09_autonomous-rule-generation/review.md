Verdict: approve
Diff: révision autonome figée contre 12777d03; HEAD 4ca83525 et rapports du candidat CLI historiques
Axes run: code, functional, relevancy
Date: 2026-10-09
Counts: critical 0, warning 0, minor 0; deux findings de cette révision corrigés
Verified criteria: 7/7, 100%

# Phases

Phase 1:

- [x] CLI identique au pinned base, mécanisme initial retiré, budget et dépendances inchangés. Commande indépendante `git diff --exit-code 12777d03 -- cli/`: exit 0. `verification.md:11` rapporte 733,98/734 KB. Les restaurations contre 4ca83525 ne sont pas des changements fonctionnels contre le contrat révisé.

Phase 2:

- [x] Skill installé autonome, Node built-ins uniquement, ESM et absence de CLI. `plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs:5` utilise fs/path/crypto; `scripts/__tests__/rule-generation.test.js:12` copie le skill et lance le vrai child process dans un projet ESM avec PATH vide. `verification.md:7` rapporte 41 tests verts.
- [x] Cinq contrats natifs, hosts explicitement confirmés, scopes correctement sérialisés et limites honnêtes. `write-rule.cjs:32` exige project/tools; `:106`–`:118` produit extensions et metadata Claude/Cursor/Copilot; `:146` partage Codex/OpenCode sans `.codex/rules`. `:233` refuse override Codex; `:234` borne AGENTS local à 32 KiB. Limites global/ancestors, autres surfaces et scopes comme model guidance documentées dans `references/tool-paths.md:51` et `verification.md`.
- [x] Corps complet et octets user/memory préservés; contribution partagée unique et propriété sûre. `write-rule.cjs:15`, `:138` et `:158` lient separator et payload au même digest. `:17` et `:201` décodent strictement les octets existants et request; `:71` refuse les surrogates isolés avant écriture. `scripts/__tests__/rule-generation.test.js:62`, `:136` et `:288` couvrent CRLF, suffix, mémoire, Unicode valide, corps complet et dernière suppression.
- [x] Prévalidation de tous les outputs avant mutation; refus d'éditions, metadata, contributions et paths unsafe sans partial validation write. `write-rule.cjs:215`–`:239` prépare les writes avant application. `rule-generation.test.js:165`, `:181`, `:195`, `:210`, `:222`, `:245`, `:262` et `:275` plantent les défauts et vérifient snapshots inchangés. La fixture `:38` compare des Buffers pour tous les fichiers projet. Vérification indépendante étroite: 14 régressions réparées, 14 passed, 0 failed.
- [x] Create/update/delete/publish, changement de cibles, ordre déterministe, idempotence et retrait stale. `write-rule.cjs:197`–`:236`; `rule-generation.test.js:62`, `:84`, `:94`, `:106`, `:117`, `:136` et `:288`. Les captures normales confirment retrait des marqueurs initiaux et suppression finale avec guidance utilisateur conservée.

Phase 3:

- [x] Distribution et checks requis; preuve réelle de consommation distinguée des tests de format. `verification.md:9`–`:15` rapporte 595 tests root, 6836 CLI, 142 architecture, gates et neuf builds/exécutions d'assets. Inspection indépendante: neuf copies livrées, toutes hash `9fa10479a267d899a6a024f68e75573f1d009080cd60851f23f06c8f2d190591`. Les six captures réparées de `runtime-results.json` ont les hashes annoncés; OpenCode 2.0.22 fait deux requêtes par parcours, Codex 0.160.1 une. Création/actualisation contiennent corps et user; delete contient user seul. Couverture réelle limitée à ces deux hosts/versions, macOS arm64.

# Findings

Aucun finding ouvert. Historique de la première revue de cette révision, distinct des anciens findings CLI:

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| critical, fixed | functional | 2 | `plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs:138` | F1: modifier seulement separator=0→1 permettait un delete exit 0 supprimant le newline utilisateur de `User\n`. | `contributionHash` unique lie separator+payload à la création et à la vérification. Aucun fallback de digest ancien. Six régressions, deux directions × update/publish/delete, exigent rejet et snapshots Buffers identiques; exécution indépendante verte. |
| warning, fixed | functional | 2 | `plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs:201` | F2: byte 0xff dans request, ou JSON UTF-8 valide contenant lone surrogate, accepté et silencieusement écrit en U+FFFD. | `readUtf8` commun protège request et fichiers existants; `safeText` refuse aussi les strings parsed non roundtrippables. Sept refus raw/high/low × body/description/paths, plus un cas Unicode valide/CRLF/literal U+FFFD. Treize refus red avant réparation selon evidence; quatorze régressions exécutées indépendamment, toutes vertes. |

# Verification

| Mesure | Résultat |
| --- | --- |
| Critères fulfilled | 7/7, 100% |
| Critères unchecked/partial/unfulfilled | Aucun |
| Tagged fixed | F1, F2; aucun fix restant |
| Fichiers de révision inspectés | 17: sept fichiers plugin/tests, neuf artefacts de tâche, revision-plan; rapports checker en plus. CLI validé par égalité exacte contre pinned base. |
| Candidate script | Hash indépendant `9fa10479a267d899a6a024f68e75573f1d009080cd60851f23f06c8f2d190591`, 14 069 bytes; neuf copies livrées identiques |
| Vérification indépendante | Lecture source/tests/docs/critères, six captures HTTP et hashes recalculés, neuf copies livrées hashées. `node --test --test-name-pattern 'edited separator\|invalid UTF-8 staged\|unpaired\|valid Unicode pairs' scripts/__tests__/rule-generation.test.js`: 14 passed, 0 failed. `git diff --check`: exit 0. Aucun code/validator modifié, aucun stage/commit/push par le checker. |
| Captures réparées | Création: `AIDD_RULE_REVISION_INITIAL` et `AIDD_USER_REVISION`; update: UPDATED et user, INITIAL absent; delete: user seul. Trois parcours par host, hashes exacts. Aucun résultat extrapolé à Claude/Cursor/Copilot. |
| DRY | fulfilled: source canonique unique, un writer et un bloc partagé, CLI non impliqué; références existantes réécrites. Réparations utilisent des helpers communs de validation. |
| Cohérence | fulfilled: documentation et code préservent body, frontière et octets; native syntax distincte de runtime evidence; hosts confirmés explicitement. |
| Simplicité | fulfilled: un script CJS, built-ins, pas de dépendance/package/orchestration ajoutée |
| Code mort/debug | fulfilled: aucune abstraction inutilisée, trace debug ou TODO silencieux ajouté |
| Travail non planifié | Aucun; restauration CLI, adapters, canonical source, guards et distribution correspondent au plan révisé |
| Exclusions | `.gitignore` personnel; `.hermes.md` non lu. Anciens spec/review/challenge CLI historiques, sans valeur de validation de cette révision. |
| Not-applicable | V1, Kilo, lifecycle CLI, migration legacy, standalone flat rules #789, Linux/Windows et runtime des trois autres hosts; hors contrat et limites documentées |
| Besoin utilisateur | Autonomie installée sans AIDD, cinq surfaces adaptées, consommation vraie Codex/OpenCode et préservation démontrées. Aucun retour Frame/Deliver restant. |
| Livraison restante | Parent conserve commit/push et mise à jour de la draft PR après review et challenge; ces actions ne sont pas réalisées par le checker. |
| Conclusion | approve; challenge read-only autorisé sur ce candidat figé |
