# Ajustements avant phase 1

Plan général approuvé ; phase 1 uniquement autorisée. Commit local par tâche validée autorisé ensuite, sans push/PR/changement de branche. Le snapshot exact antérieur est conservé dans plan-before-phase-1.json ; planning-validation.md et challenge initial restent des preuves historiques.

Déjà présents : réutilisation writer #979, indépendance des autres phases, JSONC sans perte, preflight multi-fichiers, limites crash, tests/non-régression par phase, phase 6 de consolidation. Précisions réellement ajoutées : progression et preuves obligatoires par tâche dans plan.md ; décision explicite si #979 reste Draft dans phase-2.md et overlap-979.md ; pas de moteur transactionnel générique en phase 2 ; support plateforme et contraintes runner à vérifier avant extension CI dans phase-6.md/test-strategy.md. Pas de changement des exigences des phases 3/4/5 ni des seize critères officiels.

Le challenge historique porte sur le plan et n’est pas une preuve de l’implémentation. Modifications de clarification, sans changement substantiel de solution : aucun rerun complet de planification nécessaire. La source actuelle et les limites d’autorisation sont dans phase-1-request.md.
