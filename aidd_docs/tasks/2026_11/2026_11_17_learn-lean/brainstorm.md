---
status: approved
---

# Learn au format des générateurs

`aidd-context:10-learn` transforme un moment (conversation, fichier, diff, revue) en contexte durable pour le projet, sans doublon et avec l'accord de l'utilisateur. Il est refait au format de `04-skill-generate`, comme 05 à 08. Aujourd'hui il échoue au contrôle de `check-skill.cjs` (33 écarts), note chaque leçon de 0 à 10 sans que la note serve à décider, et porte une étape et des fichiers intermédiaires sans travail propre.

## Clair

- Trois étapes : Trouver, Proposer, Écrire.
- Trouver :
  - Source : la conversation en cours par défaut ; un indice de l'utilisateur la précise (fichier, diff, revue). Une conversation passée se lit à travers le rapport de `aidd-refine:05-review-conversation`, que Learn n'appelle jamais.
  - Signaux observables, dans cet ordre de priorité : l'utilisateur a corrigé l'IA ; une erreur ou un essai répété ; un choix fait avec sa raison ; une information qu'il a fallu chercher ou demander.
  - Une correction qui vaut pour toute personne travaillant sur le projet est gardée. Un goût personnel est jeté. Une leçon propre à la seule tâche en cours est jetée.
  - Chaque leçon cite son passage de la source ; sans citation, elle est jetée.
  - Sept leçons au plus, dans l'ordre des signaux.
  - Recherche de l'existant dans `aidd_docs/memory/**`, puis dans les documents racine (README, CONTRIBUTING, `docs/`). Une leçon déjà couverte sort ici, avec son `fichier:ligne`.
- Proposer : un tableau en cinq colonnes. Leçon ; destination avec chemin exact ; changement (nouveau, met à jour, remplace, retire) ; raison, qui est le passage cité ; existant (`fichier:ligne` ou « rien »). Par ligne, l'utilisateur valide, modifie ou saute. Pas de note.
- Trois destinations, décidées par la nature de la leçon :
  - Un fait, une convention, un piège : le fichier existant qui porte déjà le sujet, dans la mémoire aidd ou hors d'elle (README, CONTRIBUTING, ARCHITECTURE…). Écrit par l'édition native de l'outil. Si aucun fichier n'en parle, la mémoire aidd. Hors mémoire, jamais de création de fichier.
  - Un choix fait, avec ses alternatives : une décision (ADR), écrite par `write-decision.cjs`.
  - Un comportement à imposer ou automatiser : une génération (règle, skill, agent, commande, hook), passée à `aidd-context:03-context-generate`. Si ça se vérifie ou s'automatise, génération ; sinon, fichier existant.
- Écrire : d'abord les fichiers et les décisions ; ensuite les générations, une à la fois. Le générateur redemande l'accord de l'utilisateur, c'est voulu. Fin : un rapport court des fichiers écrits et des générations passées.
- `learn.md` en sortie : la source, le tableau avec la décision de l'utilisateur par ligne (validée, modifiée, sautée), les fichiers écrits et les générations passées. Avec une tâche nommée ou clairement liée, il va dans son dossier, un passage ajouté par exécution. Sans tâche, Learn demande : oui avec un dossier, il y écrit ; oui sans dossier, `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/learn.md`, réutilisé s'il existe ; non, la réponse sert de trace. Écrit par l'édition native, depuis un modèle dans `assets/`, toujours ajouté à la suite, jamais écrasé. Le générateur lit la ligne de `learn.md` lors d'une passation ; un passage suivant ne repropose pas une ligne sautée.
- Arrêts sans écriture : source introuvable ; rien de nouveau ; tout sauté ; mémoire aidd absente, où Learn demande puis passe la main à `aidd-context:02-project-memory`.
- `write-decision.cjs`, même contrat que les writers de 05 à 08 : `--plan`, JSON sur stdout, codes 0, 1, 2, 3. Il crée l'ADR depuis le modèle et refuse un nom pris (création exclusive). `--supersedes <adr>` relie l'ancien et le nouveau dans les deux sens. Dossier : celui des ADR existants, sinon `aidd_docs/memory/internal/decisions/`.
- Disparaissent : la note 0-10, l'étape source, la destination « contrat », la fiche intermédiaire, le tableau en double.

## Supposé

- Pas de script de recherche au départ. La recherche par l'outil natif suffit tant que l'essai ne montre pas l'inverse ; un script de lecture (liste des destinations, mots-clés) s'ajoute seulement si l'essai sur petit modèle montre une recherche sautée ou ratée.
- Pas de script pour `learn.md` : tout son contenu est produit par le modèle. Un script s'ajoute seulement si l'essai montre un `learn.md` écrasé.
- La mémoire écrite par l'édition native : un script n'économise pas de tokens, le modèle produit le texte de la leçon dans tous les cas, et la mémoire n'a pas de format fixe d'un projet à l'autre.

## Limites

- Deux Learn simultanés dans le même dossier peuvent perdre un passage de `learn.md`. L'ADR est protégé par la création exclusive, la mémoire par l'édition par ancre. Jamais observé, donc pas de code.
- Deux worktrees peuvent ajouter la même leçon chacun ; le merge git le montre.
- Le cas préparé de l'essai reste hors du dépôt : aucune garde contre une régression ultérieure.

## Vérification

- Cas préparé : une conversation avec trois leçons attendues et deux pièges (une préférence personnelle, un bug déjà corrigé), un fichier mémoire qui couvre déjà une leçon, un `learn.md` existant.
- Réussi si : les trois leçons sont trouvées, les deux pièges jetés, la leçon couverte signalée avec son `fichier:ligne`, `learn.md` complété sans être écrasé.
- Lancé sur Haiku et un petit modèle ouvert, sessions et dossiers supprimés ensuite.

## À vérifier pendant la génération

- Si l'étape de revue de `aidd-orchestrator:02-backlog` passe la main à Learn, elle suit le nouveau format.
