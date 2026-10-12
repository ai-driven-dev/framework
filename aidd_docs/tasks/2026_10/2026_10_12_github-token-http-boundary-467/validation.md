# #467 — Contrat HTTP de vérification du token GitHub

## Priorité et périmètre

Source : [AIDD Roadmap, projet GitHub n°8](https://github.com/orgs/ai-driven-dev/projects/8). Le champ Priority exposé dans ce projet classe #467 en High. Aucun élément ouvert n'est Urgent ; sept issues ouvertes sont High. #467 a été retenue pour son périmètre précis lié à l'authentification, sans PR ouverte identifiée sur ce sujet.

Base de publication : `next`, commit `d31fb5ee5e69b5ec61731ede2717a2342ab74d33`. Branche : `test/github-token-http-boundary`.

Deux tests existaient déjà : succès et objet sans login. Les nouveaux tests ont montré 11 échecs sur la base : corps null ou undefined, login vide ou blanc, réponse non réussie portant un login, erreur HTTP conservant une valeur de token synthétique.

## Correction

`GhTokenAdapter` accepte uniquement une réponse HTTP 2xx avec un login non vide. Une réponse invalide ou une requête rejetée produit `AuthenticationError("GitHub API")`. L'erreur HTTP d'origine n'est pas conservée comme cause, afin de ne pas exposer les éventuelles données de requête qu'elle contient. Le détail HTTP ou réseau est donc remplacé par le message d'authentification générique.

Les tests utilisent uniquement le port HttpGet et des tokens synthétiques. Ils vérifient le succès, la transmission du token dans options.token, les réponses malformées, les statuts 199/300/401/403/404/500 et la confidentialité de l'erreur. Aucune requête GitHub ni CLI d'hôte n'est appelée par ces tests.

Fichiers : `cli/src/runtime/auth/gh-token-adapter.ts`, `cli/tests/runtime/auth/gh-token-adapter.unit.test.ts`.

## Validation finale

| Commande, depuis cli/ | Résultat |
| --- | --- |
| `pnpm exec vitest run --project=unit tests/runtime/auth` | 42 tests réussis |
| `pnpm exec vitest run --project=integration tests/runtime/auth tests/runtime/http` | 82 tests réussis |
| `pnpm test:coverage` | 6 960 tests réussis, 1 ignoré ; tous les seuils respectés |
| `pnpm exec stryker run --mutate src/runtime/auth/gh-token-adapter.ts --concurrency 2` | 39 mutations détectées sur 39, aucune survivante |
| `pnpm typecheck` | Réussite |
| `pnpm lint` | Réussite ; un avertissement préexistant dans uninstall-use-case.ts, hors périmètre |
| `pnpm test:arch` | 144 tests réussis |
| `pnpm knip` | Réussite |
| `pnpm build` | 750,75 Ko pour le budget existant de 751 Ko |
| `git diff --check` | Réussite |

Couverture finale : statements 98,77 %, branches 95,76 %, functions 99,55 %, lines 99,38 %. Aucun seuil de couverture ou de mutation modifié.

Après mise à jour sur `next`, le correctif tient dans le budget existant de 751 Ko. Aucun fichier de budget n'est modifié par cette livraison.

La revue indépendante du code de l'adaptateur et des tests ne relève aucun blocage. L'adaptateur et ses tests sont inchangés depuis cette revue et le contrôle de mutation.

## État

Validation locale terminée avant publication. #467 est In Progress dans le projet ; ce rapport précède la CI distante et le merge.
