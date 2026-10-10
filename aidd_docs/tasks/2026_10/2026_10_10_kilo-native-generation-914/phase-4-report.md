# #914 — Rapport phase 4

Phase 4 implémentée dans le périmètre autorisé. Plan global reste `in-progress`; phases 2, 5 et 6 restent pending. Aucun writer #979, push, PR distante ou changement de branche.

## Livré

Les générateurs agents et commandes reconnaissent les six signaux Kilo. Ils produisent respectivement `.kilo/agents/<name>.md` et `.kilo/commands/<name>.md`; legacy `.kilocode/` détecte Kilo mais ne reçoit pas de nouvelle sortie. L’agent utilise son nom de fichier, `description`, `mode: subagent` et seulement les options demandées. Le workflow émet seulement `description`, `agent`, `model`, `variant` et `subtask` demandés. Aucun champ Claude n’est injecté et Codex commands reste un skip explicite.

Les actions imposent un préflight sur toutes les cibles avant création : chemins hors workspace, symlinks, collisions, fichiers non inscriptibles, champs inconnus ou état modifié sont refusés sans mutation. Les écritures identiques sont sautées, préservant bytes et mtime. C’est un contrat interprété, pas une transaction face à crash ou concurrence.

## Critères couverts

- AC10 validé pour le contrat agent Kilo et sa découverte runtime Linux.
- AC11 validé pour le contrat workflow Kilo et son invocation runtime Linux.
- AC1–4, AC13–16 progressent mais restent partiels; AC5 et AC9 restent validés par phases précédentes; AC6–8 et AC12 restent non implémentés.

## Validation et runtime

Le corpus ciblé passe 5/5. Les artefacts générés via les actions AIDD, leurs hashes et le préflight YAML sont enregistrés dans [evidence/phase-4](evidence/phase-4/README.md). Après confirmation que le sandbox bloquait la résolution réseau, un rejeu autorisé hors sandbox a réussi sous Kilo 7.8.8 Linux et modèle explicitement gratuit. Le JSONL prouve workflow → sous-agent, lecture du chemin payload, réponse exacte `AGENT_APPLIED:willow-5836`, coût nul et hashes avant/après identiques. Les deux échecs DNS précédents restent archivés séparément; ils ne sont pas présentés comme des passes. Voir [assertions](assertions-phase-4.md) et [runtime](phase-4-runtime.md).

Claude authentifié, runtime OpenCode, macOS et Windows Kilo restent non exécutés. Les tests hors ligne ne deviennent pas une preuve runtime. La phase s’arrête ici, en attente d’autorisation utilisateur.
