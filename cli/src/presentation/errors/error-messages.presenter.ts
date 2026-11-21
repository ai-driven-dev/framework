import type * as auth from "../../contexts/auth/domain/auth.error.js";
import type * as distribution from "../../contexts/distribution/domain/distribution.error.js";
import type * as hostRegistration from "../../contexts/host-registration/domain/host-registration.error.js";
import { MAX_IDENTITY_LENGTH } from "../../contexts/telemetry/contract/identity-limit.js";
import type * as telemetry from "../../contexts/telemetry/domain/telemetry.error.js";
import type * as tools from "../../contexts/tools/domain/tools.error.js";
import type * as translate from "../../contexts/translate/domain/translate.error.js";
import type * as update from "../../contexts/update/domain/update.error.js";
import type * as orchestration from "../../orchestration/orchestration.error.js";
import type { AiddError } from "../../shared/domain/shared.error.js";

type Classes<Module> = Module[keyof Module];
/** Every error class of the owners already moved here. */
type Catalogued = InstanceType<
  | Classes<typeof auth>
  | Classes<typeof update>
  | Classes<typeof telemetry>
  | Classes<typeof distribution>
  | Classes<typeof translate>
  | Classes<typeof tools>
  | Classes<typeof orchestration>
  | Classes<typeof hostRegistration>
>;
type ByCode = { [Error in Catalogued as Error["code"]]: Error };

/** One entry says what its own error class carries; a method signature lets the table widen to any code. */
interface Words {
  say(error: AiddError, words: (cause: unknown) => string): string;
}

const entries: {
  [Code in keyof ByCode]: (error: ByCode[Code], words: (cause: unknown) => string) => string;
} = {
  "auth-storage": (error) => error.detail,
  "marketplace-source-conflict": (error) => error.detail,
  "native-plugin-cli": (error) => error.detail,
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
  "gh-cli": (error) => error.detail,
  "elevated-permission-update": (error) =>
    "Update failed: the global package directory is not writable (EPERM/EACCES).\n" +
    "Pick one:\n" +
    "  1. Run the terminal as Administrator (Windows) or with sudo (macOS/Linux), then re-run `aidd update`.\n" +
    "  2. Move global installs to a user-writable prefix, then re-run the update:\n" +
    "     Windows:  npm config set prefix %APPDATA%\\npm\n" +
    "     macOS/Linux:  npm config set prefix ~/.npm-global\n" +
    `  3. Run the update directly: ${error.installCommand}`,
  "framework-resolution": (error) => error.detail,
  "package-manager-detection": (error) =>
    `Could not detect package manager. Run manually:\n  ${error.commands.join("\n  ")}`,
  "conflicting-identity-flags": () =>
    "--as names you and --anonymous names nobody: give one of them.",
  "identity-off-with-identifier": () => "--off removes the identity: give it no identifier.",
  "invalid-identity": () =>
    `An identity is one non-empty line of at most ${MAX_IDENTITY_LENGTH} characters. Nothing was changed.`,
  "invalid-report-period": (error) => error.detail,
  "task-declared-none-with-name": () =>
    "--none declares no task: give it neither a name nor --ticket.",
  "task-name-missing": () =>
    "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status.",
  "invalid-marketplace-scope": (error) =>
    `Invalid marketplace scope: "${error.scope}". Expected "project" or "user".`,
  "malformed-marketplace-catalog": (error) =>
    `Invalid plugin manifest: catalog at "${error.path}" is malformed (${error.detail}). ${
      error.cached
        ? "Run 'aidd marketplace refresh --force' to re-fetch a clean copy."
        : "Fix or re-create the marketplace catalog file."
    }`,
  "marketplace-already-registered": (error) =>
    `Marketplace '${error.marketplace}' is already registered.`,
  "marketplace-not-found": (error) => `Marketplace '${error.marketplace}' is not registered.`,
  "plugin-fetch": (error) => `Failed to fetch plugin: ${error.detail}`,
  "plugin-not-in-marketplace": (error) =>
    `Plugin '${error.plugin}' was not found in any registered marketplace.`,
  "unreadable-marketplace-registry": (error) =>
    `Cannot read the marketplace registry at ${error.path}: ${error.reason}. Repair the file, or ` +
    `delete it to start from an empty registry.`,
  "flat-merge-target-not-json": (error) =>
    `${error.shownPath} is not valid JSON (${error.parseMessage}); left untouched.`,
  "flat-target-exists": (error) =>
    `Flat build conflict: '${error.targetPath}' already exists (plugin '${error.pluginName}'). ` +
    "Re-run with --force to overwrite.",
  "framework-placeholder-in-plugin": (error) =>
    `Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin '${error.pluginName}' (file: ${error.relativePath}).`,
  "invalid-build-paths": (error) =>
    `Refusing to build: --out '${error.outDir}' and --source '${error.sourceDir}' must not contain each other.`,
  "json-schema-validation": (error) => `Manifest validation failed: ${error.errors.join("; ")}`,
  "marketplace-out-dir-not-empty": (error) =>
    `Refusing to build: '${error.outDir}' is not empty. ` +
    "Re-run with --force to overwrite files this build produces, or choose an empty --out directory.",
  "out-dir-not-directory": (error) =>
    `Refusing to build: --out '${error.outDir}' does not exist or is not a directory.`,
  "capability-config": (error) => error.detail,
  "duplicate-tool-id": (error) => `Tool '${error.toolId}' is registered twice.`,
  "invalid-agent-frontmatter": (error) =>
    `Agent '${error.agentName}' has invalid frontmatter: ${error.detail}.`,
  "invalid-hooks-descriptor": (error) =>
    `The hooks descriptor of '${error.toolId}' breaks '${error.invariant}': ${error.detail}`,
  "invalid-mcp-server-config": (error) =>
    `MCP server "${error.serverName}" must have either a "command" or "url" field`,
  "invalid-tool-profile": (error) =>
    `The profile of '${error.toolId}' breaks '${error.invariant}': ${error.detail}`,
  "dual-config": (error) => `Both ${error.detail}. Remove one.`,
  update: () =>
    "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\n" +
    "Update your token at https://github.com/settings/tokens, then re-run `aidd auth login`.",
};

/** What each catalogued error says, by its code. */
export const MESSAGES: Readonly<Record<string, Words["say"] | undefined>> = entries;
