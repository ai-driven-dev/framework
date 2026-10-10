# #914 — Rapport phase 3

Phase 3 implémentée et revue `approve`, quatre critères de phase couverts. Phase 1 clôturée par l’utilisateur avec ses limites conservées. Plan global in-progress ; phases 2 et 4–6 pending. Aucun writer #979, push, PR distante ou changement de branche.

## Cohérence et périmètre

La phase 3 dépend de la reconnaissance acquise en phase 1, sans dépendance au writer de règles #979. Le plan validé et les seize AC restent les références ; seule sa phrase d’autorisation a été actualisée. Workflow natif `aidd-dev:02-implement` : prepare sur branche existante propre, execute limité à phase 3 selon autorisation, assertion passing avant done. Aucun finalize global ni step-end global, les autres phases restant ouvertes.

Les trois tâches sont done : sélection de surface, rendu/préservation, vérification des parcours. Commit local unique de phase conformément au contrat implement, code + tests + docs + statut. Registre : [commits-phase-3.json](commits-phase-3.json), SHA résolu depuis HEAD après livraison.

## Comportement livré

Le générateur reconnaît les six signaux Kilo, garde OpenCode distinct et utilise le chemin canonique pour legacy. Il propose le natif ; le portable exige un choix explicite. Destinations partagées dédupliquées, copies utilisateur soumises à résolution. Kilo natif + Codex ou optionnels Kilo incompatibles avec les champs d’une destination partagée demandent une résolution avant écriture.

Rendu Kilo Agent Skills name égal au dossier, description valide, optionnels documentés seulement si demandés, aucun argument-hint Claude injecté. Template et autres contrats hosts conservés. Préflight de toutes les cibles/références avant création, refus des chemins dangereux, symlinks et conflits ; modify préserve les actions/assets utilisateur hors demande, relance identique conserve bytes/mtime. Ce contrat interprété ne promet aucune transaction crash/concurrence.

## Critères et preuves

- Kilo-only natif : une copie canonique, YAML valide ; legacy produit sous .kilo sans toucher .kilocode.
- Portable : accord explicite dans les entrées synthétiques, copie unique ; absence d’accord, duplication, choix mixtes incompatibles et champs partagés non résolus refusés.
- Préservation : sept arbres générés via le caller natif, modify limité à sept actions, ressources utilisateur inchangées, rerun arbre/hashes/mtime identique, huit refus avec snapshots inchangés.
- Régression et usage : sorties Claude/Codex/OpenCode contrôlées hors ligne ; catalogues Kilo natif/portable et deux invocations réelles avec lectures action/payload et réponse exacte.

AC9 validé. AC5 demeure validé par phase 1. AC1–4 et AC13–16 progressent mais restent partiels ; AC6–8 et AC10–12 non implémentés. Aucun critère transversal clos sur la seule présence d’un fichier. [Matrice](coverage-matrix.md), [runtime](phase-3-runtime.md), [assertions](assertions-phase-3.md) et [review](review.md).

Tests : 24 ciblés réussis ; `make check` final exit 0, 630 tests / 628 pass / 2 skips existants / 0 fail. Mutations détection et préflight rouges, architecture et JSON explicites réussis. Kilo 7.8.8 Linux : natif et portable découverts au chemin exact, skill invoqué, action et payload lus, résultat exact, quatre étapes coût 0 chacun, bytes/mtime du skill préservés. Première réponse native avec espace exclue, puis rejeu exact réussi sans modifier les artefacts.

## Limites et reprise

Les fixtures sont générées par le caller Codex actuel après lecture du routeur installé et des actions candidates. Les choix sont synthétiques et explicités dans le reçu ; ce n’est pas une nouvelle réponse interactive utilisateur ni une seconde inférence Codex CLI. Les refus sont interprétés par ce caller, sans writer déterministe livré. Les sept cas skill-eval du runner Claude authentifié sont ajoutés mais non exécutés.

Absence de runtime Claude authentifié conservée ; CONTRIBUTING reste incomplet sur ce point. OpenCode runtime non exécuté, macOS/Windows Kilo non exécutés. Le blocage CLI Codex de phase 1 n’est pas requalifié ni réévalué. Kilo ajoute `$schema` à son config de fixture : delta runtime conservé et distinct d’AIDD. Aucun crash, course concurrente ou panne imprévisible multi-fichiers garanti. Les espaces terminaux des logs bruts sont conservés comme preuve exacte, pas introduits dans les sources.

Arrêt après phase 3. Phase 2 attend toujours coordination #979 ; aucune autre phase autorisée. Attendre l’accord utilisateur avant de poursuivre.
