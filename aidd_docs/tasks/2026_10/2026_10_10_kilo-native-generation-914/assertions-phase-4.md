# #914 — Assertions phase 4

Skill natif `aidd-dev:03-assert`, facet coding appliquée. Frontend non applicable; responsabilité conforme à `aidd-context` : contrats Markdown interprétés, pas de nouveau writer CLI.

- Test rouge observé : les quatre assertions du nouveau corpus échouaient avant les contrats Kilo.
- Corpus ciblé final : `node scripts/__tests__/context-agent-command-artifacts.test.js` => 5 pass, 0 fail.
- Le test couvre six signaux, agent `.kilo/agents/<name>.md` sans `name` Claude, `mode: subagent`, options demandées, workflow `.kilo/commands/<name>.md`, champs Kilo uniquement, préflight/idempotence et skip Codex explicite.
- Le premier runtime a trouvé une erreur de forme `permission: Expected "ask" | "allow" | "deny", got "read"`; correction vers `permission: { read: allow }`. Le debug Kilo archivé résout `verify-agent` avec `mode: subagent`.
- Rejeu réussi hors sandbox, Kilo 7.8.8 Linux et modèle gratuit explicite : JSONL montre task `verify-workflow` → `verify-agent` terminé, lecture du payload exact, réponse `AGENT_APPLIED:willow-5836`, coût 0 et hashes inchangés. Deux rejeux sandbox précédents ont exit 1 sur `getaddrinfo ETIMEOUT api.kilo.ai`; les mêmes sondes réseau réussissent hors sandbox. Les exports `--sanitize` historiques restent conservés avec leur limite, et le nouveau JSONL supprime chemins privés, identifiants et raisonnement en gardant les éléments de preuve. Détails dans [runtime](phase-4-runtime.md) et [evidence](evidence/phase-4/README.md).
- `make check` et les non-régressions projet sont exécutés avant le commit phase. Les limitations Claude/OpenCode/autres OS restent des limites, jamais des passes.
