import type { CredentialAdvice } from "../../contexts/distribution/contract/distribution.error.js";
import type { CatalogOwners, MessagesOf } from "./error-messages.types.js";

const CREDENTIAL_ADVICE: Record<CredentialAdvice, string> = {
  "ssh-key": "Check your SSH key is registered on the remote host.",
  token:
    "Set AIDD_TOKEN, run `aidd auth login`, or pass --token <value>. Required scope depends on the host (github: `repo`, gitlab: `read_repository`, bitbucket: `repository:read`).",
};

const SHARED_MARKETPLACE_REMOVAL = {
  project:
    "is shared by every project on this machine and is not removed with `aidd marketplace remove` — it is removed with the framework itself, by `aidd clean`, once machine scope lands there.",
  user: "is shared by every project on this machine and is removed by `aidd clean --scope user`, not marketplace remove.",
} as const;

/** The words of the errors of marketplaces, builds and tool profiles. */
export const CATALOG: MessagesOf<CatalogOwners> = {
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
  "plugin-fetch": (error) =>
    `Failed to fetch plugin: ${error.detail}${error.advice ? ` ${CREDENTIAL_ADVICE[error.advice]}` : ""}`,
  "shared-marketplace-removal": (error) =>
    `Invalid marketplace name: ""${error.marketplace}" ${SHARED_MARKETPLACE_REMOVAL[error.scope]}". Use lowercase alphanumeric characters and hyphens only.`,
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
  "mcp-server-edited": (error) =>
    `OpenCode MCP server '${error.serverName}' was edited after install; removal refused.`,
  "unproven-mcp-server-digest": (error) =>
    `OpenCode MCP server '${error.serverName}' has an unproven install digest; removal refused.`,
  "invalid-tool-profile": (error) =>
    `The profile of '${error.toolId}' breaks '${error.invariant}': ${error.detail}`,
  "dual-config": (error) => `Both ${error.detail}. Remove one.`,
  "unknown-ai-tool-id": (error) =>
    `Unknown AI tool: ${error.tool}. Valid AI tools: ${error.validIds.join(", ")}`,
};
