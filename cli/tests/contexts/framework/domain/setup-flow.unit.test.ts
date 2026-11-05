import { describe, expect, it } from "vitest";
import { SetupFlow } from "../../../../src/contexts/framework/domain/setup-flow.js";
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { kilo } from "../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { registerTool } from "../../../../src/contexts/tools/domain/registry.js";
import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../src/contexts/tools/domain/profiles/vscode/profile.js";
import {
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnsupportedAiToolsError,
} from "../../../../src/kernel/errors.js";

const ROOT = "/project";

function makeFlow(overrides: Partial<ConstructorParameters<typeof SetupFlow>[0]> = {}): SetupFlow {
  return new SetupFlow({ projectRoot: ROOT, ...overrides });
}

describe("SetupFlow", () => {
  describe("constructor validation", () => {
    it("throws InvalidSetupToolIdError for unknown AI tool IDs", () => {
      expect(() => makeFlow({ aiTools: ["unknown-tool" as "claude"] })).toThrow(
        InvalidSetupToolIdError
      );
    });

    it("throws InvalidPluginModeConfigError when mode is 'named' with no names", () => {
      expect(() => makeFlow({ pluginMode: "named", pluginNames: [] })).toThrow(
        InvalidPluginModeConfigError
      );
    });

    it("throws InvalidPluginModeConfigError when names provided but mode is not 'named'", () => {
      expect(() => makeFlow({ pluginMode: "all", pluginNames: ["my-plugin"] })).toThrow(
        InvalidPluginModeConfigError
      );
    });

    it("constructs successfully with valid params", () => {
      const flow = makeFlow({ aiTools: ["claude"], pluginMode: "none" });
      expect(flow.projectRoot).toBe(ROOT);
      expect(flow.aiTools).toEqual(["claude"]);
    });

    it("accepts mode 'named' once a plugin is named, carrying the names through", () => {
      const flow = makeFlow({ pluginMode: "named", pluginNames: ["my-plugin"] });

      expect(flow.pluginMode).toBe("named");
      expect(flow.pluginNames).toStrictEqual(["my-plugin"]);
    });

    it("says what mode 'named' needs when no plugin is named", () => {
      expect(() => makeFlow({ pluginMode: "named", pluginNames: [] })).toThrow(
        'Plugin mode "named" requires at least one plugin name.'
      );
    });

    it("names the mode that was given when names arrive under another mode", () => {
      expect(() => makeFlow({ pluginMode: "all", pluginNames: ["my-plugin"] })).toThrow(
        'Plugin names provided but mode is "all" (expected "named").'
      );
    });
  });

  describe("defaults for what a caller leaves unsaid", () => {
    it("installs no plugin", () => {
      expect(makeFlow().pluginMode).toBe("none");
    });

    it("names no plugin", () => {
      expect(makeFlow().pluginNames).toStrictEqual([]);
    });

    it("is not interactive", () => {
      expect(makeFlow().interactive).toBe(false);
    });

    it("does not force", () => {
      expect(makeFlow().force).toBe(false);
    });

    it("carries a plugin mode through when one is given", () => {
      expect(makeFlow({ pluginMode: "all" }).pluginMode).toBe("all");
    });

    it("carries force through when asked", () => {
      expect(makeFlow({ force: true }).force).toBe(true);
    });
  });

  describe("scope", () => {
    it("defaults to project", () => {
      expect(makeFlow().scope).toBe("project");
    });

    it("carries user through when asked", () => {
      expect(makeFlow({ scope: "user", aiTools: ["claude"] }).scope).toBe("user");
    });

    it("refuses an IDE tool at user scope — an IDE tool has no user scope to install at", () => {
      expect(() => makeFlow({ scope: "user", ideTools: ["vscode"] })).toThrow(
        UserScopeIdeToolsError
      );
    });

    it("accepts an IDE tool at project scope, unaffected", () => {
      expect(() => makeFlow({ scope: "project", ideTools: ["vscode"] })).not.toThrow();
    });

    it("refuses --scope user with no --ai — nothing would be registered for any tool", () => {
      expect(() => makeFlow({ scope: "user", aiTools: [] })).toThrow(UserScopeNoToolsError);
    });

    it("refuses --scope user when --ai is left unsaid, the same as an empty one", () => {
      expect(() => makeFlow({ scope: "user" })).toThrow(UserScopeNoToolsError);
    });

    it("refuses an AI tool with no user-scope activation at --scope user", () => {
      const { plugins: _plugins, ...withoutPlugins } = kilo.capabilities;
      registerTool({ ...kilo, capabilities: withoutPlugins });
      try {
        expect(() => makeFlow({ scope: "user", aiTools: ["kilo"] })).toThrow(
          UserScopeUnsupportedAiToolsError
        );
      } finally {
        registerTool(kilo);
      }
    });

    it("accepts an AI tool that copies global files at --scope user (kilo)", () => {
      expect(() => makeFlow({ scope: "user", aiTools: ["kilo"] })).not.toThrow();
    });

    it("accepts an AI tool that copies global files at --scope user (opencode)", () => {
      expect(() => makeFlow({ scope: "user", aiTools: ["opencode"] })).not.toThrow();
    });

    it("accepts an AI tool that installs to a user-scope directory at --scope user (cursor)", () => {
      expect(() => makeFlow({ scope: "user", aiTools: ["cursor"] })).not.toThrow();
    });

    it("accepts a tool driving native activation at --scope user (claude)", () => {
      expect(() => makeFlow({ scope: "user", aiTools: ["claude"] })).not.toThrow();
    });

    it("refuses an interactive plugin pick at --scope user — there is no project to ask in", () => {
      expect(() =>
        makeFlow({ scope: "user", aiTools: ["claude"], pluginMode: "interactive" })
      ).toThrow(UserScopePluginModeError);
    });

    it.each(["all", "recommended", "none"] as const)(
      "accepts --plugins %s at --scope user",
      (pluginMode) => {
        expect(() => makeFlow({ scope: "user", aiTools: ["opencode"], pluginMode })).not.toThrow();
      }
    );
  });
});
