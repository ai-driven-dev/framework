# Setup

Sets up async-dev in a repo. Detects context, asks for runtime parameters, generates artefacts, bootstraps labels, installs user-scope plugins (local mode), configures secrets (remote mode), schedules the poll routine (local mode), commits and pushes the generated files, and offers a smoke test on the chosen issue.

| #   | Action                            | Role                                                                                          |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| 01  | `detect-context`                  | Identify repo, default branch, existing config, CI permissions                                |
| 02  | `ask-config`                      | Collect runtime parameters (mode, auth, labels, schedule, agents)                             |
| 03  | `generate-workflow`               | Emit `.github/workflows/aidd-async.yml` from `assets/setup/workflow-template.yml`             |
| 04  | `generate-local-script`           | Emit poll/daemon scripts (local mode only) from `assets/setup/local-*-template.sh`            |
| 05  | `write-config`                    | Persist `.claude/aidd-orchestrator.json` from `assets/setup/config-template.json`             |
| 06  | `bootstrap-labels`                | Create `to-implement` / `to-review` / `claude/*` labels via `gh`                              |
| 07  | `install-user-scope-plugins`      | Install `aidd-orchestrator` + `aidd-dev` at user scope (local mode)                           |
| 08  | `configure-remote-secrets`        | Sync `CLAUDE_CODE_OAUTH_TOKEN`, `AIDD_BOT_TOKEN`, etc. (remote mode)                          |
| 09  | `bootstrap-scheduling`            | Schedule the poll routine (local) or rely on workflow webhook (remote)                        |
| 10  | `commit-and-push`                 | Stage generated files, conventional-commit, push                                              |
| 11  | `smoke-test`                      | Label a throwaway issue with `to-implement`; verify the pipeline reacts                       |

Action files, read in the order above:

- `actions/setup/01-detect-context.md`
- `actions/setup/02-ask-config.md`
- `actions/setup/03-generate-workflow.md`
- `actions/setup/04-generate-local-script.md`
- `actions/setup/05-write-config.md`
- `actions/setup/06-bootstrap-labels.md`
- `actions/setup/07-install-user-scope-plugins.md`
- `actions/setup/08-configure-remote-secrets.md`
- `actions/setup/09-bootstrap-scheduling.md`
- `actions/setup/10-commit-and-push.md`
- `actions/setup/11-smoke-test.md`

Default flow: `01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11`. Actions self-skip when their preconditions are not met (e.g. `07` skips in remote mode, `08` skips in local mode).
