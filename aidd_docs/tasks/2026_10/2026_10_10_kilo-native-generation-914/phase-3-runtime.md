# #914 — Runtime phase 3

Les observations ci-dessous sont des résultats historiques conservés en résumé. Les traces détaillées, scripts caller, catalogues et sorties de tests ont été retirés pendant le nettoyage ; ce document ne transforme donc pas ces validations passées en preuves directement rejouables.

## Génération dans le caller Codex

Capacité native installée `aidd-context:04-skill-generate` 2.8.1 réellement chargée. Ses actions ont été lues dans l’ordre scope, plan, write, validate, avec les références/actions candidates du workspace pour le comportement Kilo. Aucun plugin utilisateur mis à jour. Les templates canoniques lus ont été remplis par le caller, puis rendus selon le contrat de chaque host. Les fichiers attendus n’ont pas été copiés depuis un golden ni produits par un renderer de test. Les sorties effectivement générées sous `/tmp/aidd-914-p3-generation` ont ensuite été archivées dans le corpus fixtures.

Les scripts ponctuels du caller et leurs snapshots détaillés ont été retirés. Les résultats résumés ci-dessous sont historiques ; ils ne sont pas directement rejouables depuis cette archive et ces scripts n’étaient pas des composants distribués.

Les choix rapportés sont des entrées synthétiques du caller autorisées par les parcours du plan : nom verify-payload, action verify, payload bundled, Kilo natif, portable explicitement choisi, legacy natif, Claude, Codex, OpenCode, puis Kilo portable + Codex partageant une destination. Aucun accord interactif supplémentaire de l’utilisateur n’est prétendu. Le reçu détaillé contenant frame, choix, plan atomique, fichiers relus, hashes initiaux et revalidation après review a été retiré.

Le modify rapporté change uniquement les sept actions verify. Les ressources utilisateur ajoutées comme entrées de fixture restent intactes. La seconde exécution de la même demande n’écrit rien selon les hashes/modes/mtime archivés à l’époque ; la carte détaillée a été retirée. Le caller a refusé six demandes dangereuses avant mkdir/write : portable non confirmé, copies existantes, dernière cible non régulière, symlink, lecture seule, référence hors skill. Deux refus complémentaires ont réglé les contradictions Kilo natif + Codex et optionnel Kilo + champ Codex partagé ; leurs snapshots ont été retirés.

Ces refus prouvent les décisions et états du caller natif présent. Ils ne sont ni une seconde inférence autonome CLI ni un writer déterministe livré. Les sept nouveaux cas du runner skill-eval authentifié restent non exécutés. Le blocage Codex CLI documenté en phase 1 n’a pas été réévalué et ne devient pas une preuve réussie ici.

## Découverte et usage Kilo

Kilo 7.8.8 Linux, XDG_CONFIG_HOME/DATA_HOME/STATE_HOME/CACHE_HOME isolés dans `/tmp/aidd-914-p3-xdg`. Le catalogue modèle courant a été interrogé avant l’inférence ; modèle explicite `kilo/cohere/north-mini-code:free`, `isFree: true`, coûts entrée/sortie/cache nuls dans métadonnées. Données synthétiques seulement ; la disponibilité future du modèle n’est pas garantie.

```sh
# CWD = fixture native, puis portable
kilo debug skill --pure
kilo run --pure --dir /tmp/aidd-914-p3-generation/native \
  --model kilo/cohere/north-mini-code:free --format json \
  'Use the verify-payload skill to verify the phase three fixture. Read and follow its action. Return only its exact verification code, with no inserted whitespace or commentary. Do not modify files.'
kilo run --pure --dir /tmp/aidd-914-p3-generation/portable \
  --model kilo/cohere/north-mini-code:free --format json \
  'Use the verify-payload skill to verify the phase three fixture. Follow its action and return its verification code. Do not modify files.'
```

Les catalogues exposent une seule entrée verify-payload au chemin exact natif ou portable. Les traces prouvent appel skill completed, lecture réelle de actions/01-verify.md puis assets/payload.txt, réponse exacte `PAYLOAD_APPLIED:cedar-7391`, exit 0 et quatre étapes coût 0 par parcours : natif, portable. Le prompt ne contient ni le payload ni le code attendu.

Premier essai natif : même chargement complet, mais espace ajouté dans la réponse. Trace conservée, exclue de l’oracle de format exact ; le second essai précise l’absence de whitespace, sans modifier le skill. Vérification : tous les fichiers générés du skill gardent bytes et mtime. Kilo ajoute lui-même `$schema` à kilo.json ; ce delta de configuration n’est pas attribué à AIDD. Fixtures finales archivées avant ce changement runtime.

## Limites

Linux seulement ; macOS/Windows non exécutés. Aucun runtime Claude authentifié, OpenCode absent. Leurs sorties générées par Codex ont été contrôlées hors ligne pour YAML, champs propres aux hosts, arbre et liens. Aucun runtime IDE Cursor/Copilot prétendu. Aucun nouveau moteur de transaction multi-fichiers ; erreurs imprévisibles, crash et concurrence ne sont pas couverts par les refus interprétés. Le cleanup supprime seulement les fixtures/XDG de cette phase après archivage, pas les plugins utilisateur ni les fixtures historiques de phase 1.
