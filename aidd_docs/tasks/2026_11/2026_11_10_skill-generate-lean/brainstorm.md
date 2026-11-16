---
status: approved
---

# Générateur de skills au format lean

Une personne qui crée un skill avec `aidd-context:04-skill-generate` obtient directement le format lean, sans prose qui dérive, et le framework sait contrôler ce format de façon déterministe.

## Clair

- Sujet central : réécrire `04-skill-generate` pour qu'il génère le format lean. Preuve : regénérer `05-review` (mesuré) et `08-hook-generate` (jugé à la main). Si la sortie ne colle pas, on corrige le générateur, jamais la sortie.
- Format cible : description d'une phrase ; diagramme `flowchart LR` avec un nœud par fichier d'action ; action en `# NN - Nom`, une phrase, `## Input`, `## Process` numéroté dont la dernière étape lit l'action suivante, `## Output`, `## Rules` optionnel ; `## Transversal rules` conservé au niveau du skill ; aucun `## Test`, aucun "Done when", aucun gabarit d'évaluations.
- "Done when" est l'Output. Un retour en arrière s'écrit dans le Process, par numéro d'étape ou par lien markdown vers une autre action.
- Description : une phrase, troisième personne, ce que fait le skill puis quand l'utiliser, cible de 150 caractères. Ce choix est le nôtre : la plateforme autorise 1 024 caractères sans recommander de longueur, et Claude Code demande seulement de mettre le cas d'usage principal en premier.
- Étape à risque : le générateur la permet (`disable-model-invocation`, `hooks`) mais ne l'impose jamais.
- Boucle de validation : une étape du Process "valider, corriger, recommencer jusqu'à ce que ça passe", avec un lien vers la vérification.
- Placement contre la duplication : les contraintes mécaniques vivent dans les règles seules, le jugement (comment remplir) dans les références seules, le diagramme est la seule source de la liste des nœuds.
- Norme de remplissage par type de fichier (SKILL.md, action, référence, asset, script), avec quatre questions de placement : à faire dans l'ordre, à consulter, à remplir, toujours vrai.
- Action et référence plafonnées à 100 lignes, pour qu'un aperçu tronqué les contienne en entier.
- Évaluations : `skill-eval` maison supprimé, aucun fichier d'évaluation généré par skill. `claude plugin eval` est un chantier séparé, sur Claude Code seul, coûteux en appels modèle.
- Les règles du contrat de hooks ne lient que les hooks livrés par le framework. Ceux que génère `08-hook-generate` n'y sont pas soumis.
- Moteur de validation (support, après la pile mémoire) : modules `document-text`, `project-tree`, `findings`, `write-scope` ; contexte Production pour les commandes qui écrivent ; politique en table dans l'entrée ; règles pures qui reçoivent `slots` et `exists()` par le contexte ; la mémoire de tour reste dans aidd-ui tant qu'un second plugin n'en a pas besoin.
- Tri des règles d'un skill : par fichier après écriture (frontmatter valide, nom) ; entre fichiers au Stop ou à la suppression (nœud sans fichier, fichier sans nœud, lien mort, action orpheline, dernier Read absent du diagramme) ; forme en niveau 1 plafonné à 10 ; seuils du dépôt dans une seule config de CI.
- Le ticket de validation déterministe est absorbé par la commande `check` du moteur, au format de sortie du contrat, sans config de glob par règle, sans règle de jugement ni de texte figé.
- Les autres skills seront refaits ensuite, pas dans ce périmètre.

## Supposé

- Pas de Stop pour les skills au départ : les règles entre fichiers vivent dans le `check` du générateur et en niveau 1 après écriture. Raison : un blocage demande une mémoire de tour à extraire d'aidd-ui, et l'effet d'un blocage sur le modèle n'a jamais été mesuré. On passe au Stop dès qu'une règle de niveau 2 sort à zéro faux positif sur les skills du dépôt.
- La plateforme n'est pas relue en direct à chaque règle ; les citations viennent d'une lecture des pages de bonnes pratiques et des docs Claude Code.
- Git est remplacé dans aidd-ui par un parcours de fichiers qui ignore `node_modules`, les chemins pointés et les préfixes `ignore:`, parce que les deux comptes concordent sur un projet réel.

## Ouvert

- Que fait un blocage au Stop quand le modèle ne peut pas corriger (faux positif, fichier en lecture seule), au-delà du garde une-fois-par-tour ?
- Quel seuil de faux positifs rend une règle éligible au niveau 2, et qui le mesure ?
- Les skills sans dossier `actions/` (deux aujourd'hui) : quelle règle, pour ne pas déclencher "nœud sans fichier" ?
- Migration des skills sans diagramme et des actions qui portent encore `## Test` : même PR, PR suivante, ou tolérance au départ ?
- Qu'est-ce qu'un skill "touché" : fichier modifié, supprimé, ou frère modifié ?
- Les signatures de `changedLines` et `touchedLines`, différentes entre le code partagé et aidd-ui, à unifier avant qu'aidd-ui adopte le partagé.
- La chaîne "Read [suivant]" est-elle exposée à la lecture partielle ? Rien ne le démontre ; à mesurer.
- Cible de 150 caractères : à valider sur la sélection du skill avec des cas positifs et négatifs.
- `testing.md` doit être réécrit : la ligne qui renvoie au `## Test` de chaque action ne tient plus.
- Empiler le moteur sur la pile mémoire ou attendre sa fusion.
