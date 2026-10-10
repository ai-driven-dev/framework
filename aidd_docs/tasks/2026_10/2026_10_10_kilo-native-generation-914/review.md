# Review: #914 phase 4

- **Verdict**: approve
- **Reviewed implementation diff**: `84fef0fd...b9084f1b`
- **Prior amended phase 4 commit**: `19c81c4f` (superseded when the two later evidence commits were folded into the phase 4 delivery)
- **Runtime evidence addendum**: `evidence/phase-4/attempt-04-outside-sandbox/` was recorded after this implementation review and is included in the amended delivery; it does not change the reviewed code diff or verdict.
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_10
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1

- [ ] Les six signaux proposent Kilo ; fichiers OpenCode seuls et AGENTS.md seul ne le proposent pas. => not-applicable : phase 1 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Kilo + outils partageant AGENTS.md donnent un seul bloc ; contenu utilisateur et fichiers non sélectionnés identiques. => not-applicable : phase 1 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Deux synchronisations identiques ne réécrivent rien ; un marqueur invalide dans la dernière cible nommée laisse toutes les cibles et README inchangés. => not-applicable : phase 1 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] CLAUDE.md conserve @imports, Copilot conserve ses liens relatifs ; Kilo charge AGENTS.md et lit une référence mémoire nécessaire à la tâche. => not-applicable : phase 1 hors diff autorisé, statut et preuves antérieurs conservés ou pending.

### Phase 2

- [ ] Règle canonique Kilo et chemin instructions exact existent ; Kilo charge le corps ; dossier seul ne suffit pas. => not-applicable : phase 2 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Aucun choix implicite en ambiguïté ; propriétaire unique réutilisé, annulation ne crée aucun fichier. => not-applicable : phase 2 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] JSON/JSONC gardent doublons, ordre, commentaires, trailing commas et format hors insertion ; second passage byte-identique. => not-applicable : phase 2 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Configuration invalide ou cible dangereuse, y compris dernier fichier d’un fan-out, ne laisse aucun changement ; erreurs de publication testées ne laissent ni règle orpheline ni référence cassée. => not-applicable : phase 2 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Les publications Claude/Cursor/Copilot et partagées Codex/OpenCode du writer retenu gardent leurs contrats et les blocs de mémoire. => not-applicable : phase 2 hors diff autorisé, statut et preuves antérieurs conservés ou pending.

### Phase 3

- [x] Kilo-only produit uniquement .kilo/skills/name avec name/description valides. => plugins/aidd-context/skills/04-skill-generate/references/tool-write.md:13; scripts/__tests__/fixtures/context-generation/skills/native
- [x] Portable sans accord explicite ne produit jamais .agents/skills ; accord portable produit exactement une copie. => evidence/phase-3/caller-receipt.json:1; evidence/phase-3/caller-refusals.json:1; scripts/__tests__/fixtures/context-generation/skills/portable
- [x] Mise à jour préserve user assets ; conflit/refus laisse tous les arbres inchangés ; rerun identique. => evidence/phase-3/caller-modify-rerun.json:1; evidence/phase-3/caller-refusals.json:1
- [x] Les formats et champs des sorties Claude/Codex/OpenCode restent conformes ; Kilo découvre et utilise le skill livré. => scripts/__tests__/context-skill-artifacts.test.js:1; evidence/phase-3/kilo-native-exact.jsonl:2; evidence/phase-3/kilo-portable.jsonl:2

### Phase 4

- [x] Nom agent Kilo vient du fichier ; frontmatter ne reçoit pas name Claude ; mode subagent et options demandées corrects. => scripts/__tests__/context-agent-command-artifacts.test.js:12; phase-4-runtime.md:9
- [x] Workflow Kilo au chemin canonique ; uniquement champs officiellement supportés. => scripts/__tests__/context-agent-command-artifacts.test.js:21; phase-4-runtime.md:10
- [x] Formats Claude/Codex/OpenCode acceptés et bodies intacts, cibles unsupported sautées explicitement. => plugins/aidd-context/skills/06-agent-generate/references/tool-paths.md:9; plugins/aidd-context/skills/07-command-generate/references/tool-paths.md:9
- [x] Invalides ou collisions refusés sans écrire une autre cible ; relance identique ; Kilo charge et utilise agent et workflow. => plugins/aidd-context/skills/06-agent-generate/actions/02-write-agent.md:15; plugins/aidd-context/skills/07-command-generate/actions/02-write-command.md:15; evidence/phase-4/attempt-04-outside-sandbox/workflow-run.redacted.jsonl: workflow and subagent completed, payload read and exact result (see phase-4-runtime.md).

### Phase 5

- [ ] Kilo-only renvoie guidance sourcée précise et aucune écriture. => not-applicable : phase 5 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Événement non prouvé déclaré unsupported, aucune correspondance inventée. => not-applicable : phase 5 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Fan-out mixte conserve les contrats des outils supportés et n’ajoute pas de config hooks Kilo. => not-applicable : phase 5 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Deux passages identiques ne dupliquent pas l’entrée AIDD ; hooks utilisateur intacts ; une entrée invalide bloque avant script/config. => not-applicable : phase 5 hors diff autorisé, statut et preuves antérieurs conservés ou pending.

### Phase 6

- [ ] Traces démontrent que les skills livrés ont généré les sorties testées et que le vrai Kilo les découvre/utilise. => not-applicable : phase 6 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Contrôles négatifs détectent artefact absent/non relié ; second passage et refus laissent les états attendus. => not-applicable : phase 6 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Tous tests offline Claude et régressions automatisées des cibles passent ; aucun runtime Claude authentifié prétendu. => not-applicable : phase 6 hors diff autorisé, statut et preuves antérieurs conservés ou pending.
- [ ] Rapport décrit OS/versions, cas skipped/blocked et limites ; AC15 ne passe que sur la couverture runtime prévue réellement exécutée. => not-applicable : phase 6 hors diff autorisé, statut et preuves antérieurs conservés ou pending.

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (4/4 critères phase 4 applicables) |
| Files checked | Contrats agents/commandes, actions, README, fixture, corpus ciblé, runtime, plan et matrice |
| Unchecked | Phases 1, 2, 3, 5, 6 : not-applicable au diff phase 4 |
| Unplanned | none |
