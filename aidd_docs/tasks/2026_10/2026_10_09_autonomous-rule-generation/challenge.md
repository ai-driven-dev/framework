My confidence level of correctness now: 100%

# Correctness (100%)

- Confiance bornée au [contrat révisé](spec.md), au [plan](plan.md) et à ses limites déclarées. [Review](review.md): sept critères remplis, aucun finding ouvert. Les anciens rapports du mécanisme CLI ne servent pas de preuve.
- Le besoin d'autonomie est démontré par les child processes d'un skill copié dans un projet ESM avec PATH vide, et par neuf assets réellement traduits, exécutés et hashés. Le script installé utilise uniquement Node built-ins; le CLI reste identique à 12777d03 et conserve son budget 734 KB. [Preuves](verification.md).
- Les cinq hosts reçoivent les surfaces prévues: metadata native Claude/Cursor/Copilot, contribution AGENTS partagée pour Codex/OpenCode. Une sélection commune produit un seul body dans ce fichier. Des targets explicites et metadata canonique évitent une détection de host fondée sur AGENTS seul. Les scopes AGENTS restent des instructions au modèle.
- Le résultat dépasse la présence de fichiers pour les deux hosts exercés: six captures HTTP réparées montrent corps créé/actualisé et guidance utilisateur; l'ancienne règle disparaît après update, les deux marqueurs disparaissent après delete. OpenCode 2.0.22 et Codex 0.160.1, macOS arm64, utilisent des providers mock locaux sans paid inference. Hashes de captures et script final concordent avec [runtime-results.json](runtime-results.json).
- **Amended:** F1 lie maintenant separator et payload dans le digest, refusant toute frontière éditée avant mutation. F2 refuse request UTF-8 invalide et surrogates parsed isolés. Quatorze régressions exécutées indépendamment passent; elles vérifient tous les bytes projet sur les treize refus, et la conservation Unicode/CRLF sur le cas positif. Aucune fallback de digest ne réintroduit le défaut.
- Préservation et lifecycle script servent le besoin complet: guidance et mémoire hors bloc inchangées, native outputs édités refusés, target retiré nettoyé, ordre déterministe, reruns byte-identiques, suppression finale sans contribution stale. Les symlinks, traversal, metadata/markers ambigus et root override Codex sont refusés avant writes.
- **Deviations:** aucune divergence ouverte au plan. La restriction des globs contenant des virgules et le guard local Codex 32 KiB sont explicites; aucun scope n'est silencieusement élargi et aucune configuration host n'est modifiée. L'absence de transaction I/O ou de garantie contre concurrent writers était une limite initiale, pas un écart découvert après coup.
- **Out of scope:** consommation réelle de Claude/Cursor/Copilot non capturée; leurs formats et assets exécutables sont vérifiés. Aucune garantie Linux/Windows, V1, autre release host, global/ancestor Codex budget, déduplication entre AGENTS et surfaces natives, migration legacy, lifecycle CLI ou standalone flat rules #789. Ces limites sont cohérentes dans docs et preuves.
- Placement et effort correspondent au besoin: production dans aidd-context, script CJS autonome, canonical source unique, aucun changement au CLI ni nouvelle dépendance. Guards et suites restent verts après réparation. Aucune action d'implémentation ou décision Frame restante; le parent peut effectuer la livraison VCS prévue.

# Deal breakers

- Aucun ouvert dans le contrat convenu.

# Suggestions (enhancements only)

- Aucune nécessaire pour ce périmètre.
