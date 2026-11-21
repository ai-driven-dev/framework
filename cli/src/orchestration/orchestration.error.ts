import { AiddError } from "../shared/domain/shared.error.js";
import type { ToolCategory } from "../shared/domain/tool.js";

export class AmbiguousPluginMatchError extends AiddError {
  readonly code = "ambiguous-plugin-match";
  constructor(plugin: string, marketplaces: readonly string[]) {
    super(
      `Plugin '${plugin}' matches multiple marketplaces: ${marketplaces.join(", ")}. Use --from <marketplace>.`
    );
  }
}

export class CategoryMismatchError extends AiddError {
  readonly code = "category-mismatch";
  constructor(wrong: string[], category: ToolCategory, validToolIds: readonly string[]) {
    const label = category === "ai" ? "AI" : "IDE";
    const verb = wrong.length === 1 ? `is not an ${label} tool` : `are not ${label} tools`;
    super(`${wrong.join(", ")} ${verb}. Valid ${label} tools: ${validToolIds.join(", ")}`);
  }
}

export class InteractiveOnlyError extends AiddError {
  readonly code = "interactive-only";
  constructor(action: string) {
    super(`'${action}' requires an interactive terminal.`);
  }
}

export class InvalidPluginModeConfigError extends AiddError {
  readonly code = "invalid-plugin-mode-config";
  constructor(message: string) {
    super(message);
  }
}

export class InvalidSetupToolIdError extends AiddError {
  readonly code = "invalid-setup-tool-id";
  constructor(id: string, validIds: readonly string[]) {
    super(`Invalid tool ID: "${id}". Valid IDs: ${validIds.join(", ")}`);
  }
}

export class NoMarketplacesRegisteredError extends AiddError {
  readonly code = "no-marketplaces-registered";
  constructor() {
    super("No marketplaces registered. Use `aidd marketplace add <name> <source>` first.");
  }
}

/** Each failure already reached the user through its own `output.warn` line, so this names
 * only the scopes and lets the CLI's one exit turn a partly failed sync
 * into a non-zero exit. */
export class SyncFailedError extends AiddError {
  readonly code = "sync-failed";
  constructor(errors: readonly { scope: string; message: string }[]) {
    super(`Sync failed for: ${errors.map((e) => e.scope).join(", ")}. See the warnings above.`);
  }
}

export class TrustDeniedError extends AiddError {
  readonly code = "trust-denied";
  constructor(name: string) {
    super(`Trust denied for marketplace '${name}'. Aborting.`);
  }
}

export class UnknownAiToolIdError extends AiddError {
  readonly code = "unknown-ai-tool-id";
  constructor(tool: string, validIds: readonly string[]) {
    super(`Unknown AI tool: ${tool}. Valid AI tools: ${validIds.join(", ")}`);
  }
}

export class UserScopeFilterUnsupportedError extends AiddError {
  readonly code = "user-scope-filter-unsupported";
  constructor(flag: string, command: string) {
    super(
      `--scope user tracks nothing ${flag} can narrow — it names every requested tool, ` +
        `not one plugin or one file. Drop ${flag}, or run \`aidd ${command}\` at project scope.`
    );
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
  }
}

export class UserScopeNoToolsError extends AiddError {
  readonly code = "user-scope-no-tools";
  constructor() {
    super(
      "--global with no --ide registers the shared source for no tool at all. Pass " +
        "`--ide <ids>` naming which tool to activate machine-wide."
    );
  }
}

export class UserScopePluginModeError extends AiddError {
  readonly code = "user-scope-plugin-mode";
  constructor() {
    super(
      "--global cannot ask which plugins to install. Pass --plugins all, recommended, " +
        "none, or comma-separated names."
    );
  }
}

export class UserScopeUnavailableError extends AiddError {
  readonly code = "user-scope-unavailable";
  constructor() {
    super(
      "--scope user is not wired for this command yet — no user-scope manifest " +
        "repository was provided at construction."
    );
  }
}

export class UserScopeUnsupportedAiToolsError extends AiddError {
  readonly code = "user-scope-unsupported-ai-tools";
  constructor(aiTools: readonly string[]) {
    super(
      `--global installs through an IDE's own plugin CLI or its user configuration directory, and neither exists for: ${aiTools.join(", ")}. ` +
        "Drop them from --ide, or run `aidd setup --ide <ids>` in the project instead."
    );
  }
}
