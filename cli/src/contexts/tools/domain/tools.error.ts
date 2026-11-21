import { AiddError } from "../../../shared/domain/shared.error.js";

export class CapabilityConfigError extends AiddError {
  readonly code = "capability-config";
  constructor(message: string) {
    super(message);
    this.name = "CapabilityConfigError";
  }
}

export class DuplicateToolIdError extends AiddError {
  readonly code = "duplicate-tool-id";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is registered twice.`);
    this.name = "DuplicateToolIdError";
  }
}

export class InvalidAgentFrontmatterError extends AiddError {
  readonly code = "invalid-agent-frontmatter";
  constructor(agentName: string, detail: string) {
    super(`Agent '${agentName}' has invalid frontmatter: ${detail}.`);
    this.name = "InvalidAgentFrontmatterError";
  }
}

export type HooksInvariant =
  | "unknown-event"
  | "empty-native-list"
  | "duplicate-native-event"
  | "project-without-file"
  | "loader-with-file"
  | "path-outside-directory"
  | "root-token-without-file"
  | "file-without-root-token"
  | "adapter-not-stamped";

export class InvalidHooksDescriptorError extends AiddError {
  readonly code = "invalid-hooks-descriptor";
  constructor(
    readonly toolId: string,
    readonly invariant: HooksInvariant,
    detail: string
  ) {
    super(`The hooks descriptor of '${toolId}' breaks '${invariant}': ${detail}`);
    this.name = "InvalidHooksDescriptorError";
  }
}

export class InvalidMcpServerConfigError extends AiddError {
  readonly code = "invalid-mcp-server-config";
  constructor(name: string) {
    super(`MCP server "${name}" must have either a "command" or "url" field`);
    this.name = "InvalidMcpServerConfigError";
  }
}

export type ProfileInvariant =
  | "directory-not-relative"
  | "directory-without-trailing-slash"
  | "no-build-contract"
  | "unknown-section"
  | "plugin-sections-disagree"
  | "shipped-config-disagrees";

export class InvalidToolProfileError extends AiddError {
  readonly code = "invalid-tool-profile";
  constructor(
    readonly toolId: string,
    readonly invariant: ProfileInvariant,
    detail: string
  ) {
    super(`The profile of '${toolId}' breaks '${invariant}': ${detail}`);
    this.name = "InvalidToolProfileError";
  }
}

export class KiloDualConfigError extends AiddError {
  readonly code = "kilo-dual-config";
  constructor() {
    super("Both Kilo JSON and JSONC config variants exist at the same location. Remove one.");
    this.name = "KiloDualConfigError";
  }
}

export class OpencodeDualConfigError extends AiddError {
  readonly code = "opencode-dual-config";
  constructor() {
    super("Both opencode.json and opencode.jsonc exist. Remove one.");
    this.name = "OpencodeDualConfigError";
  }
}

export class ToolListMismatchError extends AiddError {
  readonly code = "tool-list-mismatch";
  constructor(toolIds: readonly string[]) {
    super(`Tool lists differ on: ${toolIds.join(", ")}.`);
    this.name = "ToolListMismatchError";
  }
}
