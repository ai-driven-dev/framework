import { AiddError } from "../../../shared/domain/shared.error.js";

export class CapabilityConfigError extends AiddError {
  readonly code = "capability-config";
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateToolIdError extends AiddError {
  readonly code = "duplicate-tool-id";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is registered twice.`);
  }
}

export class InvalidAgentFrontmatterError extends AiddError {
  readonly code = "invalid-agent-frontmatter";
  constructor(agentName: string, detail: string) {
    super(`Agent '${agentName}' has invalid frontmatter: ${detail}.`);
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
  }
}

export class InvalidMcpServerConfigError extends AiddError {
  readonly code = "invalid-mcp-server-config";
  constructor(name: string) {
    super(`MCP server "${name}" must have either a "command" or "url" field`);
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
  }
}

export class DualConfigError extends AiddError {
  readonly code = "dual-config";
  constructor(
    readonly toolId: string,
    detail: string
  ) {
    super(`Both ${detail}. Remove one.`);
  }
}
