---
status: approved
---

# Hook Generate natif par hôte

`aidd-context:08-hook-generate` produit, modifie ou supprime un hook qui fonctionne sur chaque outil choisi par l'utilisateur, au format propre à cet outil : Claude Code, Codex, Cursor, Copilot, Antigravity, Kilo, OpenCode V1 et V2. Il est refait au format de `04-skill-generate` (cadrage, plan, écriture, vérification, arrêt pour approbation au cadrage et au plan). Aujourd'hui le LLM fusionne lui-même les configs JSON, impose un script bash avec `jq`, s'appuie sur des faits d'outils périmés et ne prouve jamais que le hook marche. Cible : un writer déterministe pour les configs, un vérificateur déterministe pour le script.

## Clair

- L'utilisateur choisit les outils cibles, pas seulement ceux installés : 08 propose les outils détectés par défaut, l'utilisateur en ajoute ou en retire (un utilisateur Codex ajoute OpenCode pour ses coéquipiers).
- Événements natifs de chaque outil, matcher précis. Le contrat de hooks du framework ne lie pas les hooks générés par 08.
- Au plan, 08 montre par outil ce que l'intention (informer, bloquer, exiger une correction, relancer au Stop, effet de bord) donne réellement, avant toute écriture. Exemples : Copilot ne sait pas exiger une correction après écriture ; Codex ne sait pas demander avant un outil ; Cursor accepte `ask` sur `preToolUse` sans l'appliquer.
- Langage du script libre (Node, Python, shell, ...), selon l'usage de chaque outil. Le script lit l'entrée native de l'outil et répond au format natif, sans adaptateur caché. Plusieurs outils : un script, une branche par outil, l'entrée de config passe l'id de l'outil en argument.
- Writer déterministe (`.cjs`, modules natifs, JSON sur stdout, codes de sortie), comme ceux de 05, 06 et 07 : il écrit l'entrée native par outil, fusionne sans écraser les entrées voisines, refuse d'écraser une entrée qu'il n'a pas produite sans `--force` approuvé, et porte les champs par OS (`commandWindows`, `powershell`) et un timeout explicite.
- Kilo et OpenCode : le writer génère un plugin passerelle qui lance la commande du script et traduit sa réponse (`throw` pour bloquer). OpenCode V1 et V2 sont gérés tous les deux : d'abord un fichier unique qui exporte les deux formes, prouvé en trial sur les deux versions ; s'il échoue, détection de la version à l'écriture.
- Vérificateur déterministe : passe un payload d'exemple de chaque outil dans le script et contrôle que la sortie est valide pour cet outil, sans que l'outil soit installé. Si l'outil est installé, un trial réel est proposé après accord. Un outil non installé est rapporté « format vérifié, exécution non vérifiée ».
- Chaque hook porte un nom kebab-case stable qui l'identifie : chemin du script, nom du plugin passerelle, clé Antigravity. Modifier, c'est régénérer sous le même nom ; supprimer, c'est `--remove <nom>`, qui retire les entrées de chaque outil, le plugin passerelle et le script, après approbation, sans toucher aux voisines.
- 08 dit ce qu'une config commitée implique pour les coéquipiers : le runtime du script doit être présent ; Codex fait revoir chaque hook dans `/hooks`, approbation liée au hash ; Cursor et Claude demandent la confiance du workspace ; Copilot demande l'admission du workspace.
- Un hook qui relance au Stop vérifie le drapeau de l'outil (`stop_hook_active`, `loop_count`) et ne relance qu'une fois.
- Projet seulement. Le mode « plugin source » est supprimé : c'est un besoin interne au framework.
- Faits corrigés par la recherche : Antigravity a un scope global et les événements `PreInvocation` et `PostInvocation` ; Copilot ne bloque avec exit 2 que sur `preToolUse` et `permissionRequest` ; Copilot n'a pas de `decision: block` sur `postToolUse` ; Codex `PreToolUse` refuse `ask` et ignore `additionalContext` au Stop ; le CLI Copilot lit aussi `.claude/settings*.json`, donc écrire pour Claude et Copilot risque de lancer le hook deux fois, et 08 le signale.

## Supposé

- Scope global hors périmètre : un hook « partout sur ma machine » reste une limite connue, ajouté seulement si un utilisateur le demande.
- La table de protocole par outil vient des docs officielles lues à la date du cadrage et des adaptateurs `cli/assets/hooks-runtime/host-*.cjs`. Elle dérive avec les versions des outils et se revérifie à chaque trial.
