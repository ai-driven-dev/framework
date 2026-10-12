# Cursor : parcours réel

CLI 2026.09.08-6caf4ff, modèle Auto (modèle backend non exposé), OAuth Free existant. Overage désactivé vérifié par endpoint Dashboard natif. Aucun achat, upgrade, API key ni fallback payant.

Premier parcours : création et modification ajoutent un point aux commentaires exacts demandés. Les consommateurs suivent ce texte publié. Ces essais restent des échecs du littéral demandé. Trois essais timeout 180 s sur tools; retries isolent les hooks/profil utilisateur et réussissent à 360 s maximum. Suppression réelle via skill et writer, puis nouvelle fonction sans les marqueurs après suppression, tests externes verts. Guidance utilisateur et mémoire préservées par hashes.

Contrôle nouveau dans model-cursor-exact : auteur avec citation explicite crée le marqueur exact // Team reviewed domain change ; consommateur en conversation neuve crée src/domain/discount.ts:4 avec ce commentaire immédiatement au-dessus, sans point. Le modèle invoque ensuite le skill installé et son writer pour supprimer la règle. Nouvelle conversation post-suppression crée src/domain/fee.ts:3 sans marqueur et ses tests. Tous tests externes passent. Le CLI finit néanmoins exit 1 avant résultat final, car quota Free atteint : aucune nouvelle inférence ni upgrade après cette erreur. Tokens/coût de ce dernier appel indisponibles.

Pas de dernier contrôle modèle du nouveau marqueur exact Domain validation reviewed après modification. La publication déterministe sur les cinq hôtes est vérifiée séparément par root. Pas de conclusion globale 5/5.

L’auteur exact utilisait cinq assets à jour avec le SKILL/capture initial traduit par la CLI. Après sa sortie, SKILL/capture ont été rafraîchis via la CLI actuelle; consommation, suppression et post-suppression utilisent les sept MD à jour. Writer installé identique à la source. Les deux révisions et tous les échecs sont conservés.

Preuves détaillées : cursor-journey-report.json, cursor-evidence-summary.json, cursor-exact-consumer-proof.json, cursor-exact-current-metadata-refresh.json, dossiers cursor-* avec streams/requêtes/hashes/tests. Auth privée hors workspace, jamais exportée dans ces rapports, supprimée après les appels.
