import { MAX_IDENTITY_LENGTH } from "../../contexts/telemetry/contract/identity-limit.js";
import type { MessagesOf, SharedOwners } from "./error-messages.types.js";

/** The words of the errors every command can raise: transport, authentication, update and telemetry. */
export const CORE: MessagesOf<SharedOwners> = {
  "asset-not-found": (error) => `Bundled asset not found: '${error.assetName}'`,
  authentication: (error) =>
    `Authentication failed (${error.source}). Run \`aidd auth login\` to authenticate.`,
  "catalog-fetch-auth": (error) =>
    `Authentication required to fetch catalog from "${error.url}". Run \`aidd auth login\` first or use \`--source local --path <dir>\`.`,
  "catalog-fetch": (error, words) =>
    `Failed to fetch catalog from "${error.url}": ${words(error.reason)}`,
  "catalog-fetch-not-found": (error) => `Catalog not found (HTTP 404): ${error.url}`,
  http: (error) => `Unexpected HTTP ${error.statusCode} from ${error.url}`,
  "http-not-found": (error) => `Resource not found (HTTP 404): ${error.url}`,
  "http-redirect": (error) => `HTTP redirect without location header from ${error.url}`,
  "input-required": (error) => error.detail,
  "invalid-install-scope": (error) =>
    `Invalid scope '${error.value}'. Expected 'project' or 'user'.`,
  "invalid-marketplace-name": (error) =>
    `Invalid marketplace name: "${error.detail}". Use lowercase alphanumeric characters and hyphens only.`,
  "invalid-plugin-manifest": (error) =>
    error.detail ? `Invalid plugin manifest: ${error.detail}` : "Invalid plugin manifest.",
  "invalid-plugin-name": (error) =>
    `Invalid plugin name: "${error.pluginName}". Use lowercase alphanumeric characters and hyphens only.`,
  "invalid-plugin-source": (error) =>
    error.detail ? `Invalid plugin source: ${error.detail}` : "Invalid plugin source.",
  "invalid-plugin-version": (error) =>
    `Invalid plugin version: "${error.version}". Expected semver format (e.g. 1.0.0).`,
  "invalid-source-marketplace": (error) => `Invalid source marketplace: ${error.detail}.`,
  "json-parse": (error) => `Cannot parse existing JSON at ${error.path}: ${error.reason}`,
  "manifest-validation": (error) => error.detail,
  "mcp-config": (error) => error.detail,
  "tool-not-in-manifest": (error) => `Tool '${error.toolId}' is not installed in the manifest.`,
  "unreadable-user-source-references": (error) =>
    `Cannot read the shared-source reference registry at ${error.path}: ${error.reason}. Repair the ` +
    `file, or delete it to start from an empty registry.`,
  "unregistered-tool": (error) => `Tool '${error.toolId}' is not registered.`,
  "version-mismatch": (error) =>
    `Plugin '${error.plugin}': requested version '${error.requested}' does not match catalog version '${error.actual}'.`,
  "auth-storage": (error) => error.detail,
  "credential-record-unreadable": (error) =>
    `Cannot read the credential record ${error.path} (${error.reason}). Delete the file, then run \`aidd auth login\`.`,
  "gh-cli": (error) => error.detail,
  "elevated-permission-update": (error) =>
    "Update failed: the global package directory is not writable (EPERM/EACCES).\n" +
    "Pick one:\n" +
    "  1. Run the terminal as Administrator (Windows) or with sudo (macOS/Linux), then re-run `aidd update`.\n" +
    "  2. Move global installs to a user-writable prefix, then re-run the update:\n" +
    "     Windows:  npm config set prefix %APPDATA%\\npm\n" +
    "     macOS/Linux:  npm config set prefix ~/.npm-global\n" +
    `  3. Run the update directly: ${error.installCommand}`,
  "framework-resolution": (error, words) =>
    error.reason === undefined ? error.detail : error.detail + words(error.reason),
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
  update: () =>
    "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\n" +
    "Update your token at https://github.com/settings/tokens, then re-run `aidd auth login`.",
};
