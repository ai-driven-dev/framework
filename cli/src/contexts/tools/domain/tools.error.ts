import { AiddError } from "../../../shared/domain/shared.error.js";

export class CapabilityConfigError extends AiddError {
  readonly code = "capability-config";
  constructor(readonly detail: string) {
    super();
  }
}

export class DuplicateToolIdError extends AiddError {
  readonly code = "duplicate-tool-id";
  constructor(readonly toolId: string) {
    super();
  }
}

export class InvalidAgentFrontmatterError extends AiddError {
  readonly code = "invalid-agent-frontmatter";
  constructor(
    readonly agentName: string,
    readonly detail: string
  ) {
    super();
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
    readonly detail: string
  ) {
    super();
  }
}

export class InvalidMcpServerConfigError extends AiddError {
  readonly code = "invalid-mcp-server-config";
  constructor(readonly serverName: string) {
    super();
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
    readonly detail: string
  ) {
    super();
  }
}

export class DualConfigError extends AiddError {
  readonly code = "dual-config";
  constructor(
    readonly toolId: string,
    readonly detail: string
  ) {
    super();
  }
}
