import { AiddError } from "../shared/domain/shared.error.js";
import type { ToolCategory } from "../shared/domain/tool.js";

export class AmbiguousPluginMatchError extends AiddError {
  readonly code = "ambiguous-plugin-match";
  constructor(plugin: string, marketplaces: readonly string[]) {
    super(
      `Plugin '${plugin}' matches multiple marketplaces: ${marketplaces.join(", ")}. Use --from <marketplace>.`
    );
    this.name = "AmbiguousPluginMatchError";
  }
}

export class CategoryMismatchError extends AiddError {
  readonly code = "category-mismatch";
  constructor(wrong: string[], category: ToolCategory, validToolIds: readonly string[]) {
    const label = category === "ai" ? "AI" : "IDE";
    const verb = wrong.length === 1 ? `is not an ${label} tool` : `are not ${label} tools`;
    super(`${wrong.join(", ")} ${verb}. Valid ${label} tools: ${validToolIds.join(", ")}`);
    this.name = "CategoryMismatchError";
  }
}

export class InteractiveOnlyError extends AiddError {
  readonly code = "interactive-only";
  constructor(action: string) {
    super(`'${action}' requires an interactive terminal.`);
    this.name = "InteractiveOnlyError";
  }
}

export class InvalidPluginModeConfigError extends AiddError {
  readonly code = "invalid-plugin-mode-config";
  constructor(message: string) {
    super(message);
    this.name = "InvalidPluginModeConfigError";
  }
}

export class InvalidSetupToolIdError extends AiddError {
  readonly code = "invalid-setup-tool-id";
  constructor(id: string, validIds: readonly string[]) {
    super(`Invalid tool ID: "${id}". Valid IDs: ${validIds.join(", ")}`);
    this.name = "InvalidSetupToolIdError";
  }
}

export class NoMarketplacesRegisteredError extends AiddError {
  readonly code = "no-marketplaces-registered";
  constructor() {
    super("No marketplaces registered. Use `aidd marketplace add <name> <source>` first.");
    this.name = "NoMarketplacesRegisteredError";
  }
}

export class TrustDeniedError extends AiddError {
  readonly code = "trust-denied";
  constructor(name: string) {
    super(`Trust denied for marketplace '${name}'. Aborting.`);
    this.name = "TrustDeniedError";
  }
}

export class UserScopeIdeToolsError extends AiddError {
  readonly code = "user-scope-ide-tools";
  constructor(ideTools: readonly string[]) {
    super(
      `--global installs no project files, so an editor (${ideTools.join(", ")}) has ` +
        "nothing to install machine-wide. Drop it from --ide, or run `aidd setup --ide <ids>` " +
        "separately in the project."
    );
    this.name = "UserScopeIdeToolsError";
  }
}

export class UserScopeNoToolsError extends AiddError {
  readonly code = "user-scope-no-tools";
  constructor() {
    super(
      "--global with no --ide registers the shared source for no tool at all. Pass " +
        "`--ide <ids>` naming which tool to activate machine-wide."
    );
    this.name = "UserScopeNoToolsError";
  }
}

export class UserScopePluginModeError extends AiddError {
  readonly code = "user-scope-plugin-mode";
  constructor() {
    super(
      "--global cannot ask which plugins to install. Pass --plugins all, recommended, " +
        "none, or comma-separated names."
    );
    this.name = "UserScopePluginModeError";
  }
}

export class UserScopeUnavailableError extends AiddError {
  readonly code = "user-scope-unavailable";
  constructor() {
    super(
      "--scope user is not wired for this command yet — no user-scope manifest " +
        "repository was provided at construction."
    );
    this.name = "UserScopeUnavailableError";
  }
}

export class UserScopeUnsupportedAiToolsError extends AiddError {
  readonly code = "user-scope-unsupported-ai-tools";
  constructor(aiTools: readonly string[]) {
    super(
      `--global installs through an IDE's own plugin CLI or its user configuration directory, and neither exists for: ${aiTools.join(", ")}. ` +
        "Drop them from --ide, or run `aidd setup --ide <ids>` in the project instead."
    );
    this.name = "UserScopeUnsupportedAiToolsError";
  }
}
