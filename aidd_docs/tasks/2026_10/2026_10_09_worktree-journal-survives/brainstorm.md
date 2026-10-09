# Une session de worktree survit à la suppression du worktree

Précise [#932](https://github.com/ai-driven-dev/framework/issues/932).

Celui qui demande ce qu'une tâche a coûté doit obtenir la réponse même quand le travail a été fait par un agent dans un worktree lié, et même quand ce worktree a déjà été retiré. Aujourd'hui le journal est écrit dans l'arbre du worktree, le rapport ne lit que le journal du checkout courant, et `git worktree remove` efface un journal seulement ignoré sans `--force` (mesuré avec git 2.55.0.windows.5). La session n'entre alors jamais dans le sink, et la tâche se lit `no-journal` ou n'existe pas. #631 demande le lien vers la tâche et l'interdiction de perdre une session sans bruit. C'est ce défaut-là.

La conclusion écrite dans le hook (« un journal par worktree, à la racine du worktree ») est amendée. Ses raisons, elles, restent : on n'écrit pas dans l'arbre d'une autre branche, et un clone nu n'a pas d'arbre principal. Le journal du clone vit donc à un seul endroit, sous le répertoire git commun du clone, hors de tout arbre de travail et hors du répertoire git propre à un worktree. `git worktree remove` ne le supprime pas. Il n'est pas un fichier de checkout, donc il n'est pas commité et il ne salit aucune branche. Tous les lecteurs (rapport, lecture, diagnostic, oubli) utilisent cet endroit, et `AIDD_RUNS_DIR` continue de le remplacer entièrement.

## Ce qui est tenu

- Le rapport lancé dans n'importe quel checkout du clone compte les sessions de tous ses worktrees, passés dans les totaux et dans la tâche ou le flux. Deux clones du même remote ne sont pas fusionnés.
- L'écriture a lieu pendant la session. Un rapport lancé seulement après la suppression arrive trop tard.
- `worktree_id` reste sur la ligne `session_start`, absent sur un checkout simple. Le rapport ne gagne aucun axe worktree : deux worktrees qui ont touché la même tâche additionnent leur coût. Les distinguer dans le rapport serait un axe de plus, et la décision du 2026-08-31 ne l'accorde pas. La phrase de l'issue « told apart by worktree_id » est tenue dans le journal, pas dans une section du rapport.
- Une seule copie fait foi. Pas de second journal dans `aidd_docs/runs/` du worktree : les deux divergeraient.
- Les journaux déjà écrits dans un worktree encore présent sont lus avec le nouvel endroit, sinon les sessions d'aujourd'hui restent invisibles. Les nouvelles lignes n'y vont plus.
- Un worktree déjà supprimé avant ce changement, sans lecture antérieure, reste perdu. Les transcripts ne suffisent pas : sans journal, rien ne nomme la session.
- Le switch du checkout qui travaille décide toujours d'écrire ou non. Le refus de la personne gagne toujours. Le nouveau dossier reçoit le même traitement de confidentialité que `aidd_docs/runs/` aujourd'hui.
- Le sink reste celui de la machine. On n'y déplace pas le calcul de la tâche : il continue d'être dérivé du journal au moment du rapport.

## Prochaine étape

Écrire le plan d'implémentation à partir de cette idée.
