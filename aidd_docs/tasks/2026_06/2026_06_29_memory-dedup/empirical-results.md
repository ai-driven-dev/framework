# Preuve empirique — duplication mémoire (avant décision)

Fixture minimal (`scratchpad/fixture`) : API Node/Express + Knex/sqlite + Jest.
Déclenche core + api + database. Fill rejoué à la main de deux façons :

- **run actuel** : fill aveugle (chaque template rempli indépendamment, comme
  l'action `03.6` le dit aujourd'hui).
- **run fixé** : templates haut niveau inchangés + logique de propriétaire
  (architecture sans Structure & sans libs de domaine ; codebase-map possède
  zones+entry ; integration reframé externe ; "un fait = un fichier").

## Résultat (comptage déterministe, substring)

| Métrique | run actuel | run fixé |
| --- | --- | --- |
| Faits dupliqués (≥2 fichiers) | 7 | 6 |
| Sites de restatement | 23 | 15 (−35 %) |
| Entry point | 3 fichiers (quasi-verbatim) | 1 |
| Routes `src/routes` | 4 fichiers | 2 (accepté) |

## Lecture

- **Bug confirmé** : fill aveugle → 7 faits dupliqués, jusqu'à 4 fichiers
  chacun. Pires : entry point + routes quasi-verbatim ; `architecture.Stack`
  aimant (Express, Knex, Jest re-listés).
- **Fix efficace sur le haut-sévérité** : entry point 3→1, paires
  quasi-verbatim architecture↔codebase-map supprimées, Internal+diagramme
  d'integration supprimés. Résiduel = mini-dups consciemment acceptés
  (framework, npm test, users).
- **Templates restés haut niveau** : dédup faite par action/règle, zéro
  métadonnée dans les templates. Conforme à la consigne.

## Trouvailles

1. **Le comptage substring sur-compte** (ex: "Jest" comme label de zone ≠ vraie
   dup). → un script de dédup naïf ne suffit pas ; le check doit être
   **sémantique** (review agent), pas un grep.
2. **`integration` sur projet sans service externe → quasi vide** ("None").
   Confirme un gate douteux : integration ne devrait pas se déclencher sans
   service externe. → fix séparé dans `capability-signals`.
3. La dédup résiduelle dépend du comportement du fill agent suivant
   l'action+règle. Pas garantissable statiquement → la règle doit être
   **explicite et forte**, et la review 04 doit lister des points de dédup
   concrets (fact → propriétaire).

## Conséquence sur le plan

- Check 04 = review sémantique forte (pas un script), avec checklist
  fact→propriétaire ; option : déléguer à un checker subagent indépendant
  (contexte frais), formulé plugin-agnostique.
- Ajouter au suivi séparé : gate `integration` dans `capability-signals`.
