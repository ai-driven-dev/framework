My confidence level of correctness now: 70%

# Correctness (100%)
- L'accès normal au workflow est réservé à l'identité GitHub numérique `8973343`, vérifiée via le compte authentifié `alexsoyes`. Un autre mainteneur, même avec écriture, ne peut ni invoquer Claude ni relancer une demande d'Alex.
- Le filtre du workflow est doublé d'une vérification du sender, du rerunner et de l'identité retournée par l'API des permissions. Un renommage du compte est accepté ; la réutilisation de son ancien login par un autre compte est refusée.
- Les 12 tests ciblés passent, notamment les cas autre writer, relance par un tiers et usurpation du login. Les protections de forks et les limites d'exécution sont conservées.
- Ce choix correspond au moindre privilège pour un usage personnel financé par Alex. Le dépôt reste communautaire : l'autorisation de lancer son assistant ne remplace pas la revue des contributions par les mainteneurs.

# Deal breakers
- La configuration n'est pas encore activée sur `main` : la PR #1014 nécessite une revue de mainteneur. Le lancement réel de Claude et son test de bout en bout ne sont donc pas validés. Le score concerne cet état incomplet, pas une probabilité de sécurité mesurée.

# Suggestions (enhancements only)
- La restriction du workflow ne garantit pas une garde exclusive du jeton. Les utilisateurs ayant écriture peuvent utiliser les secrets du dépôt via des workflows ; les administrateurs peuvent modifier la configuration. Cette frontière de confiance est [documentée par GitHub](https://docs.github.com/en/actions/reference/security/secure-use#use-secrets-for-sensitive-information).
- Si Alex souhaite aussi contrôler chaque utilisation du secret, un environnement GitHub protégé avec Alex comme reviewer est une option. Il ajoute une approbation par exécution ; les administrateurs du dépôt restent de confiance. Cette protection supplémentaire n'a pas été imposée au parcours actuel.
- L'accès réservé à une personne crée une dépendance à sa disponibilité et à son abonnement. C'est un compromis explicite d'outil personnel, pas un service garanti à la communauté.
