import type { InstallationOwners, MessagesOf } from "./error-messages.types.js";

const REINSTALL = { project: "aidd setup", user: "aidd setup --global" } as const;

/** The words of the errors of installing, registering and orchestrating tools and plugins. */
export const INSTALLATION: MessagesOf<InstallationOwners> = {
  "active-machine-dependents": (error) =>
    `Cannot remove ${error.target}: active projects still depend on it: ${error.projects.join(", ")}.`,
  "aidd-files-detected": () =>
    "AIDD files detected but no manifest found.\nRun `aidd setup` to register existing files.",
  "already-initialized": (error) =>
    error.remedy === "update"
      ? "Already initialized. Use `aidd update` to upgrade."
      : "Already initialized. Run `aidd clean --force` then `aidd setup` to reset completely.",
  "project-hooks-edited": (error) =>
    `${error.detail} Rerun aidd sync --force to restore it, or aidd clean --force to remove it.`,
  "shared-source-unregistered": (error) => `${error.detail}; run \`aidd setup --global\`.`,
  "unsupported-manifest-version": ({ detail, reinstall }) =>
    `Invalid manifest data: ${detail}` +
    (reinstall
      ? `, then run \`${REINSTALL[reinstall]}\` to reinstall the framework.`
      : " Run `aidd update` to update this CLI, then try again."),
  "duplicate-plugin": (error) => `Plugin '${error.pluginName}' is already installed.`,
  "invalid-manifest-data": (error) =>
    error.detail ? `Invalid manifest data: ${error.detail}` : "Invalid manifest data.",
  "invalid-manifest-tool-id": (error) => `Invalid tool id in manifest: '${error.key}'.`,
  "invalid-plugin-scope": (error) =>
    `Tool '${error.toolId}' does not support scope '${error.requested}'. Supported scope: '${error.supported}'. ` +
    `Re-run with --scope ${error.supported} or omit the flag.`,
  "malformed-plugin-scope": (error) =>
    `Plugin "${error.pluginName}" carries an invalid scope: ${JSON.stringify(error.scope)}. Expected "project" or "user".`,
  "manifest-migration-failed": (error) =>
    `Cannot move the host registrations out of ${error.path}: ${error.detail}. ` +
    "The manifest is unchanged; run the command again once the file can be written.",
  "manifest-missing": () => "No AIDD manifest found. Run `aidd setup` to initialize your project.",
  "manifest-corrupted": () =>
    "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize.",
  "missing-plugin-metadata": () =>
    "Cannot register github marketplace plugin: catalog entry is missing plugin metadata.",
  "plugin-not-found": (error) => `Plugin '${error.pluginName}' is not installed.`,
  "cursor-project-scope-unsupported": () =>
    "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is not auto-loaded by Cursor.",
  "tool-not-installed": (error) =>
    error.context
      ? `${error.context} '${error.toolId}' is not installed.`
      : `${error.toolId} is not installed`,
  "unresolvable-user-scope": (error) =>
    `Manifest records a user-scope plugin for "${error.toolId}", but this tool's profile declares no user-scope plugins directory. Refusing to guess a base directory rather than silently resolving under the project root.`,
  "marketplace-source-conflict": (error) =>
    `${error.detail} Reconcile the host source manually before retrying \`aidd sync\`.`,
  "native-plugin-cli": (error) => error.detail,
  "registration-refused": (error) => error.detail,
  "unreadable-built-catalog": (error) =>
    `Cannot read the marketplace catalog this project just built, at ${error.path} — nothing was ` +
    "registered for it. Run `aidd sync` again once the source is fixed.",
  "ambiguous-plugin-match": (error) =>
    `Plugin '${error.plugin}' matches multiple marketplaces: ${error.marketplaces.join(", ")}. Use --from <marketplace>.`,
  "category-mismatch": (error) => {
    const label = error.category === "ai" ? "AI" : "IDE";
    const verb = error.wrong.length === 1 ? `is not an ${label} tool` : `are not ${label} tools`;
    return `${error.wrong.join(", ")} ${verb}. Valid ${label} tools: ${error.validToolIds.join(", ")}`;
  },
  "interactive-only": (error) => `'${error.action}' requires an interactive terminal.`,
  "invalid-plugin-mode-config": (error) => error.detail,
  "invalid-setup-tool-id": (error) =>
    `Invalid tool ID: "${error.id}". Valid IDs: ${error.validIds.join(", ")}`,
  "no-marketplaces-registered": () =>
    "No marketplaces registered. Use `aidd marketplace add <name> <source>` first.",
  "agent-plugin-activation": (error, words) =>
    error.errors.map((failure) => words(failure.error)).join("\n"),
  "sync-failed": (error) =>
    `Sync failed for: ${error.errors.map((failure) => failure.scope).join(", ")}. See the warnings above.`,
  "trust-denied": (error) => `Trust denied for marketplace '${error.marketplace}'. Aborting.`,
  "unknown-ai-tool-id": (error) =>
    `Unknown AI tool: ${error.tool}. Valid AI tools: ${error.validIds.join(", ")}`,
  "user-scope-filter-unsupported": (error) =>
    `--scope user tracks nothing ${error.flag} can narrow — it names every requested tool, ` +
    `not one plugin or one file. Drop ${error.flag}, or run \`aidd ${error.command}\` at project scope.`,
  "user-scope-ide-tools": (error) =>
    `--global installs no project files, so an editor (${error.ideTools.join(", ")}) has ` +
    "nothing to install machine-wide. Drop it from --ide, or run `aidd setup --ide <ids>` " +
    "separately in the project.",
  "user-scope-no-tools": () =>
    "--global with no --ide registers the shared source for no tool at all. Pass " +
    "`--ide <ids>` naming which tool to activate machine-wide.",
  "user-scope-plugin-mode": () =>
    "--global cannot ask which plugins to install. Pass --plugins all, recommended, " +
    "none, or comma-separated names.",
  "user-scope-unavailable": () =>
    "--scope user is not wired for this command yet — no user-scope manifest " +
    "repository was provided at construction.",
  "user-scope-unsupported-ai-tools": (error) =>
    `--global installs through an IDE's own plugin CLI or its user configuration directory, and neither exists for: ${error.aiTools.join(", ")}. ` +
    "Drop them from --ide, or run `aidd setup --ide <ids>` in the project instead.",
};
