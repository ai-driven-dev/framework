import { AiddError } from "../../../../shared/domain/shared.error.js";
import type { ToolCategory } from "../../../../shared/domain/tool.js";

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

export class CategoryMismatchError extends AiddError {
  readonly code = "category-mismatch";
  constructor(
    readonly wrong: readonly string[],
    readonly category: ToolCategory,
    readonly validToolIds: readonly string[]
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

export class UnknownAiToolIdError extends AiddError {
  readonly code = "unknown-ai-tool-id";
  constructor(
    readonly tool: string,
    readonly validIds: readonly string[]
  ) {
    super();
  }
}

export class McpServerEditedError extends AiddError {
  readonly code = "mcp-server-edited";
  constructor(readonly serverName: string) {
    super();
  }
}

export class UnprovenMcpServerDigestError extends AiddError {
  readonly code = "unproven-mcp-server-digest";
  constructor(readonly serverName: string) {
    super();
  }
}
