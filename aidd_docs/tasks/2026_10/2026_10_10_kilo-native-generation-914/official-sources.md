# Contrats officiels et dates

Contrat de l'issue : **Verified on 2026-09-25**. Revérification de cette session : **2026-10-10**. La première date est attribuée au ticket ; elle n'est pas une vérification rétroactive de notre part. Chaque affirmation de chemin Kilo ajoutée dans les références de génération portera l'URL officielle et cette double provenance. Une nouvelle référence ne répétera pas une règle déjà présente : fusionner au contrat pertinent.

| Surface | Source officielle relue | Contrat retenu |
| --- | --- | --- |
| Mémoire | https://kilo.ai/docs/customize/agents-md | AGENTS.md racine principal, AGENT.md fallback ; contexte par répertoire au read ; autorisation utilisateur requise par Kilo pour modifier ces fichiers. Ne pas supposer que des liens Markdown sont des imports automatiques. |
| Règles | https://kilo.ai/docs/customize/custom-rules | Fichiers sous .kilo/rules/ reliés par instructions ; ordre déclaré significatif ; dossier canonique seul insuffisant. |
| Skills | https://kilo.ai/docs/customize/skills | Agent Skills, .kilo/skills/ ; .agents/skills/ compatible. Le choix explicite d'une cible portable est une contrainte AIDD #914, pas une restriction du loader. |
| Agents | https://kilo.ai/docs/customize/custom-subagents | .kilo/agents/ ; nom du fichier ; description et mode subagent ; options demandées model, temperature et permission (singulier dans le YAML). |
| Workflows | https://kilo.ai/docs/customize/workflows | .kilo/commands/ ; description, agent, model, variant, subtask optionnels. Ne pas injecter les champs Claude non supportés. |
| Plugins | https://kilo.ai/docs/automate/extending/plugins | .kilo/plugin/ ou .kilo/plugins/, JS/TS ; descriptor default avec id et server ; événement session.created documenté. Guidance, pas implémentation générique. |
| Configuration | https://kilo.ai/docs/getting-started/settings | kilo.json/jsonc racine ou .kilo/ ; .kilo/ prioritaire ; fichiers fusionnés. Aucun refus runtime général des deux formats. |
| Legacy et recherche | https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md | .kilocode/ fallback ; variantes singulier/pluriel acceptées pour certains artefacts. Nouveaux artefacts AIDD dans les chemins pluriels canoniques du ticket. |

Revérification technique complémentaire : https://raw.githubusercontent.com/Kilo-Org/kilocode/main/packages/opencode/src/config/config.ts et https://raw.githubusercontent.com/Kilo-Org/kilocode/main/packages/opencode/src/config/paths.ts. Sources main mouvantes, pas preuve de l'implémentation exacte du binaire 7.8.8. Elles montrent notamment une fusion d'instructions dédupliquée et un chargement de plusieurs fichiers. Les doublons conservés à l'écriture ne doivent donc pas être exigés dans le tableau runtime fusionné. L'ordre JSON/JSONC au même emplacement sera verrouillé par une sonde de configuration résolue sur le binaire ciblé avant de documenter un ordre total ; seul .kilo/ > racine est déjà établi dans les docs. Présenter les groupes à priorité connue et ne pas choisir silencieusement dans un groupe ambigu.

Divergences conservées : le bridge #971 couvre maintenant Stop/PostToolUse en plus de SessionStart ; la génération #914 ne s'attribue que la correspondance capturée session.created. Certaines docs plugins mentionnent encore des chemins opencode/cache legacy ; ne pas reprendre ces passages pour les nouveaux artefacts. Les compétences compatible Claude ou les fallbacks OpenCode ne sont jamais des signaux suffisants de détection Kilo.
