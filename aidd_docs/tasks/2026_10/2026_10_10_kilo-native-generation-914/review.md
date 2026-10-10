# Review: #914 correction sécurité CodeQL de la Draft PR #992

- **Verdict**: approve (correction locale seulement; CI distante et CodeQL en attente)
- **Diff**: `d5f1309a...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_10
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Reconnaissance et mémoire partagée

- [ ] Les six signaux Kilo sont proposés, les signaux ambigus exclus — not-applicable: détection inchangée.
- [x] Le refus hardlink et les substitutions préservent le contenu, l'identité et les métadonnées des témoins — `scripts/__tests__/update-memory.test.js:542`, `:600`.
- [x] L'idempotence et les refus avant mutation restent vérifiés — `scripts/__tests__/update-memory.test.js:131`, `:338`, `:357`; suite complète réussie.
- [ ] Imports Claude, liens Copilot et mémoire Kilo réellement lue — not-applicable: aucun comportement runtime modifié.

### Phase 2 — Publication des règles et configuration sans perte

- [ ] Règle canonique, référence exacte et corps chargés — not-applicable: phase 2 toujours `in-progress`, intégration du writer en attente de #979.
- [ ] Choix explicite, propriétaire unique et annulation sans création — not-applicable: aucune publication dans ce correctif.
- [ ] JSON/JSONC préservé, second passage identique — not-applicable: aucune édition de configuration dans ce correctif.
- [ ] Erreurs de fan-out sans état partiel — not-applicable: writer non intégré.
- [ ] Non-régression de publication des cinq autres cibles — not-applicable: writer non intégré.

### Phase 3 — Skills natifs ou portables choisis

- [ ] Génération Kilo-only dans le bon emplacement — not-applicable: génération inchangée.
- [ ] Consentement explicite pour portable et copie unique — not-applicable: choix inchangé.
- [x] Les arbres oracle, ressources utilisateur et hashes canoniques restent vérifiés malgré CRLF au checkout — `scripts/__tests__/context-skill-artifacts.test.js:89`, `:104`, `:144`.
- [ ] Runtime Kilo et conformité de toutes les autres sorties — not-applicable: aucun artefact de génération modifié.

### Phase 4 — Agents et workflows natifs

- [x] Les assertions d'agent normalisent CRLF avant de vérifier le frontmatter et le corps — `scripts/__tests__/context-agent-command-artifacts.test.js:47`, `:49`.
- [x] Les assertions de workflow normalisent CRLF et conservent les champs et le corps attendus — `scripts/__tests__/context-agent-command-artifacts.test.js:48`, `:52`.
- [ ] Contrats des autres formats et cibles unsupported — not-applicable: production inchangée.
- [ ] Invalides, collisions, idempotence et usage Kilo réel — not-applicable: production inchangée.

### Phase 5 — Guidance hooks et relances sûres

- [ ] Guidance Kilo sourcée sans écriture — not-applicable: phase inchangée.
- [ ] Événement non prouvé déclaré unsupported — not-applicable: phase inchangée.
- [ ] Fan-out mixte conforme — not-applicable: phase inchangée.
- [ ] Relance sans doublon et refus avant mutation — not-applicable: phase inchangée.

### Phase 6 — Preuves de génération et runtime sur plateformes supportées

- [ ] Traces de génération réelle et usage Kilo — not-applicable: phase 6 inachevée et hors de cette correction.
- [ ] Contrôles négatifs et refus — not-applicable: phase 6 hors périmètre.
- [ ] Tests Claude offline et runtime authentifié — not-applicable: phase 6 hors périmètre.
- [ ] Rapport OS/versions/skips et AC15 — not-applicable: phase 6 hors périmètre.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| - | - | - | - | None. | - |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% des critères concernés par le correctif local (5/5); 20 critères du plan `not-applicable` à ce diff. |
| Files checked | Trois suites de tests modifiées, plan #914 et phases 1–6, documentation sécurité et suivi CI, règles AIDD. |
| Unchecked | Windows/macOS et nouvelles alertes #125–#128: `not-applicable` localement, à confirmer dans GitHub Actions/CodeQL après publication autorisée. Statut Code Scanning #116–#119 non confirmé (API 403). |
| Unplanned | none |
