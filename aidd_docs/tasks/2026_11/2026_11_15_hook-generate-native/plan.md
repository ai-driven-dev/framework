---
objective: "08-hook-generate writes, changes and removes one named hook natively on each host the user picks, through a deterministic writer and a deterministic verifier, in the 04-skill-generate format."
status: pending
---

# Plan: Hook Generate natif par hôte

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Remplacer la fusion JSON faite par le LLM et le script bash imposé par un writer `write-hook.cjs`, un vérificateur `verify-hook.cjs` et un skill au format de 04 |
| **Source** | `aidd_docs/tasks/2026_11/2026_11_15_hook-generate-native/brainstorm.md` (approuvé) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Writer des hôtes à config JSON | [`phase-1.md`](./phase-1.md) |
| 2   | Plugin passerelle Kilo et OpenCode V1/V2 | [`phase-2.md`](./phase-2.md) |
| 3   | Vérificateur de payload | [`phase-3.md`](./phase-3.md) |
| 4   | Skill réécrit au format de 04 | [`phase-4.md`](./phase-4.md) |
| 5   | Trials réels et PR | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://code.claude.com/docs/en/hooks | `.claude/settings.json`, forme `hooks.<Event>[].hooks[]`, `shell`, exit 2, `permissionDecision`, `CLAUDE_PROJECT_DIR`, timeout 600 s |
| https://learn.chatgpt.com/docs/hooks | `.codex/hooks.json`, `commandWindows`, revue `/hooks` liée au hash, pas d'`ask` sur `PreToolUse`, pas de variable de racine |
| https://cursor.com/docs/hooks | `.cursor/hooks.json` `version: 1`, événements camelCase, exit 2, `CURSOR_PROJECT_DIR`, `loop_count` |
| https://docs.github.com/en/copilot/reference/hooks-configuration | `.github/hooks/*.json`, `bash`/`powershell`/`cwd`/`timeoutSec`, exit 2 seulement sur `preToolUse` et `permissionRequest`, lecture de `.claude/settings*.json` |
| https://antigravity.google/docs/hooks | `.agents/hooks.json` clé par nom de hook, `PreInvocation`/`PostInvocation`, `decision` |
| https://opencode.ai/docs/plugins | `.opencode/plugins/`, V1 fonction qui rend une table, V2 `setup(ctx)` |
| https://kilo.ai/docs | `.kilo/plugin/`, `export default { id, server }`, `throw` bloque |
| Spike sur claude 2.1.325, codex-cli 0.167.2, copilot 1.0.111, opencode 1.19.3 et 2.3.0, kilo 7.7.5, agy 1.5.8 | clés réelles des payloads, blocage par exit 2, `throw` ou `decision: deny` sur chaque hôte ; `codex exec` ignore un hook non revu ; Cursor non exécuté, quota atteint avant tout outil |

## Decisions

| Decision | Why |
| -------- | --- |
| Le script vit dans le dossier de chaque hôte, une copie identique par hôte : `.claude/hooks/`, `.codex/hooks/`, `.cursor/hooks/`, `.github/hooks/`, `.agents/hooks/`, `.opencode/hooks/`, `.kilo/hooks/`, nommé `<name>.<ext>` | natif, aucun dossier étranger dans le projet, et retirer un hôte retire son script. Le chemin identifie le hook sans fichier d'état. Jamais dans `.opencode/plugins/` ni `.kilo/plugin/`, que l'hôte charge comme plugins. Une copie modifiée à la main apparaît en `update` au plan et exige `--force` |
| Codex écrit dans `.codex/hooks.json`, jamais dans `config.toml` | JSON natif, pas de parseur TOML |
| Le writer génère la passerelle Kilo et OpenCode, le LLM jamais | elle est du code exécuté par l'hôte : seul un rendu testé garantit qu'elle traduit la réponse et bloque par `throw` |
| Un seul fichier OpenCode exporte V1 et V2, sans détection de version | prouvé en spike sur 1.19.3 et 2.3.0 : chaque version n'appelle que sa forme, une fois par outil, et `throw` bloque |
| Codex lance le script depuis la racine git, `"$(git rev-parse --show-toplevel)"/.codex/hooks/…` | Codex exécute le hook dans le dossier de la session ; un chemin relatif échoue depuis un sous-dossier, et un hook en échec laisse passer l'outil. Un projet sans git est une limite écrite |
| Écrire pour Claude et Copilot à la fois est signalé au plan, avec le choix de n'écrire que l'un | prouvé en spike : le CLI Copilot exécute aussi le hook de `.claude/settings.json`, donc le script tourne deux fois |
| Antigravity lance la commande depuis `.agents/`, le chemin du script est relatif à ce dossier | constaté en spike depuis un sous-dossier ; un hook en échec y bloque l'outil, à l'inverse de Codex |
| Le matcher passerelle nomme l'outil par version : `bash` en OpenCode V1 et Kilo, `shell` en OpenCode V2 | constaté en spike dans le payload de chaque version |
| Le vérificateur contrôle la sortie du script, il ne la produit pas | le langage du script reste libre (option Y du cadrage) |
