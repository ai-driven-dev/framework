# Source recueillie

Action `01-gather` de la capacité installée `aidd-dev:01-plan`, exécutée dans le contexte du caller Codex.

- Source ticket : https://github.com/ai-driven-dev/framework/issues/914, corps courant récupéré le 10 octobre 2026, updated_at 2026-10-10T09:45:34Z ; un commentaire, sans changement de scope.
- Sources locales lues intégralement : `resume.md`, `user-request.md`, `issue-914.md`. Les instructions actualisées du message utilisateur priment sur leur état historique.
- Résultat demandé : détection Kilo, mémoire partagée et génération native de règles, skills, agents et workflows ; guidance précise des plugins/hooks ; seize critères officiels.
- Contraintes : sources Claude canoniques ; préservation des autres outils, du contenu utilisateur et de JSONC ; idempotence ; aucune écriture partielle sur entrée invalide ou édition dangereuse ; preuves runtime.
- Frontières : #744 déjà livré, #868 flat hors périmètre ; aucune conversion générique de hooks ni implémentation de plugin runtime.
- Session autorisée : plan, phases, matrice, stratégie de tests et challenge uniquement. Aucun code produit, commit, push ou PR. Validation utilisateur nécessaire avant développement.
