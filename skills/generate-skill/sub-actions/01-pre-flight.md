# SA-01: Pre-flight check

Validate all prerequisites before any design work begins.

## Instructions

1. Ask the user where the skill should live:
   - **Project skill** → `<project>/{{TOOLS}}/skills/<skill-name>/` — scoped to the current project, committed with the repo.
   - **Global skill** → `~/{{TOOLS}}/skills/<skill-name>/` — available across all projects for this user.
   Do not assume. Wait for the user's choice.
2. Ask the user about each prerequisite:
   - **Secrets & credentials**: Which API keys, tokens, or passwords are needed? Does the user have them now?
   - **Service access**: Which third-party services are involved? Does the user have accounts and permissions?
   - **API contracts**: For each external API — is the endpoint known? Documentation available? Rate limits, auth flows?
   - **Local tooling**: Which CLI tools, runtimes, MCP servers, or integrations must be installed?
   - **Data inputs**: What data does the skill expect? Where does it come from? Is the format stable?
3. Build a checklist from the answers. Present it to the user.
4. Confirm every item is green. If any item is red (missing access, pending approval, unknown API), surface it NOW.
5. If the skill requires secrets, prepare the `.env` / `.env.local` pair.

## Input / Output

- **Input**: User's description of what skill they want to create.
- **Output**: Chosen skill path + validated checklist with all items green.

## References

- Read `references/skill-template.md` for the Environment section (`.env` / `.env.local` format).

## Test policy

- **Assertion**: The user has explicitly chosen a skill path (project or global) AND every checklist item is confirmed green.
- **Exit condition**: Skill path is set AND checklist has no red items.
- **Expected result**: `{ skill_path, checklist: [all green] }`
- **Retry loop**: If any item is red, ask the user how to resolve it. Loop until resolved or the user explicitly accepts the risk. Hard stop after 3 attempts on the same blocker: suggest the user addresses it offline.
- **On failure**: Report which prerequisites are missing and suggest next steps to obtain them.
