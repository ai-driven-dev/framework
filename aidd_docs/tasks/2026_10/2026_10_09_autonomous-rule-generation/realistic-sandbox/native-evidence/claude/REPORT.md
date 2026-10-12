# Claude Code : parcours réel

Authentification OAuth Max existante, modèle natif claude-sonnet-5-5. Extra usage désactivé : claude-quota-probe.json. Aucun achat, API key ni fallback payant. Les coûts USD natifs sont estimations au tarif catalogue, pas factures.

Projet : ../projects/model-claude. Plugin natif local .claude/plugins/aidd-context, skill aidd-context:05-rule-generate. Traces exactes, requêtes, hashes avant/après et tests : dossiers claude-01 à claude-07.

- Création 01 : Skill découvre les fichiers installés puis Bash exécute write-rule.cjs. Canonique et .claude/rules/01-standards/1-domain-review.md portent paths src/domain/**/*.ts et commentaire demandé exact.
- Modification 04 : Skill + script input puis publish. Nouveau commentaire exact // Domain validation reviewed.
- Suppression 06 : Skill + script --delete. Canonique et règle native retirées. AGENTS.md, règle utilisateur 00-architecture et mémoire architecture inchangés par hashes.
- Consommation initiale 02 et contrôle Read 08 : marqueur absent. Faux négatifs du harness : --restricted désactive les sources project. Documentation officielle memory confirme que les règles projet sont ignorées lorsque project est exclu de --setting-sources. Les traces de ces essais sont conservées.
- Consommation 05 : nouveau marqueur présent, mais lecture explicite de la copie canonique par Bash. Cette observation ne prouve pas la découverte native.
- Contrôle natif corrigé 09 : clone ../projects/model-claude-read-trigger, CLI par défaut avec --setting-sources project, utilisateur/hooks/MCP/autoMemory exclus et sandbox strict. Read(invoice.ts), sans lecture des règles ni copie canonique, puis calculateRebateCents précédée immédiatement de // Domain validation reviewed. PASS natif observable dans le code.
- Hors portée corrigé 10 : nouvelle conversation, lit seulement docs/api.md et docs/contributing.md, écrit docs/refunds.md sans marqueur. PASS comportement. Les traces ne donnent pas de télémétrie directe d’attachement des instructions.
- Après suppression 07 : nouvelle calculateFeeCents sans les deux marqueurs. Fichier natif absent. Contrôle sous --restricted, donc preuve de sortie nettoyée et code seulement; pas contrôle natif causal de suppression.

Toutes les validations externes node --test tests/*.test.ts retournent 0. Dans le sandbox modèle, les tests HTTP échouent listen EPERM (bind local interdit), tandis que les tests domaine passent. Cette différence est conservée dans traces, pas masquée.

Détails sessions, tokens, estimations, tests et statut : claude-evidence-summary.json. Référence officielle : https://code.claude.com/docs/en/memory#organize-rules-with-claude-rules.
