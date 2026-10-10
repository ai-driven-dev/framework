# Preuves de faisabilité de cette session

Ces observations ne valident aucun artefact #914 encore non implémenté.

| Vérification | Résultat observé |
| --- | --- |
| git status --short --branch | feat/kilo-native-generation-914 ; uniquement dossier de tâche non suivi |
| git rev-parse HEAD upstream/next | deux fois 41e91691b5837a8c27475d0115725131bb53bf41 |
| merge-base --is-ancestor 12777d03808cee29f611e18d3816ae62ebc5c969 HEAD | code 0 |
| kilo --help hors sandbox | CLI 7.8.8 ; commandes run/auth/models/debug disponibles |
| kilo auth list | 0 credentials ; aucun login déclenché |
| kilo models kilo --verbose | modèle cohere/north-mini-code:free : isFree=true, cost input/output/cache=0, toolcall=true |
| claude --version | 2.1.296 ; aucun modèle Claude lancé |
| command -v opencode | aucune sortie ; absent du PATH |

Sonde exécutée dans /tmp/aidd-914-kilo-probe vide, hors sandbox après élévation ; aucune instruction contenant le code du projet envoyée. Commande :

```sh
timeout 40s kilo run --pure --dir /tmp/aidd-914-kilo-probe --model kilo/cohere/north-mini-code:free --format json 'Reply exactly KILO_FREE_ACCESS_OK. Do not call tools or read any files.'
```

Code 0. Sortie text : `KILO_FREE_ACCESS_OK`. step_finish : reason stop, cost 0. Session `ses_edab22fc7ffewo5vLrHhvOdPPU`, vercelID `cdg1:cdg1:cdg1::fra1::lgqlk-1791627225221-63b5f9e6ec8a`. Pas d'événement tool dans la sortie reçue. Accès gratuit effectif confirmé ; authentification de compte non établie. Gratuité/quotas à revérifier à chaque campagne ; aucune substitution vers un modèle payant, même si le gratuit est indisponible.

Le sandbox initial donne EROFS sur ~/.local/state/kilo et ~/.local/share/kilo/state. Ce n'est pas un échec d'authentification. Le binaire produit son état/cache hors du projet lors du diagnostic ; aucune modification intentionnelle de configuration globale ou credential. Aucun achat ni abonnement.
