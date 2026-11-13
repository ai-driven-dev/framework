import { describe, expect, it } from "vitest";
import { SetupFlow } from "../../../../src/contexts/framework/domain/setup-flow.js";
import {
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnsupportedAiToolsError,
} from "../../../../src/shared/domain/errors.js";
import { registeredToolIds, TOOL } from "../../tools/testing/catalog-of.js";

const ROOT = "/project";

function makeFlow(overrides: Partial<ConstructorParameters<typeof SetupFlow>[0]> = {}): SetupFlow {
  return new SetupFlow({
    registeredToolIds: registeredToolIds(),
    projectRoot: ROOT,
    supportsUserScopeActivation: () => true,
    ...overrides,
  });
}

describe("SetupFlow", () => {
  describe("constructor validation", () => {
    it("throws InvalidSetupToolIdError for unknown AI tool IDs, naming every valid one", () => {
      // @ts-expect-error an unregistered name is not an AI tool id
      expect(() => makeFlow({ aiTools: ["unknown-tool"] })).toThrow(InvalidSetupToolIdError);
      // @ts-expect-error an unregistered name is not an AI tool id
      expect(() => makeFlow({ aiTools: ["unknown-tool"] })).toThrow(
        'Invalid tool ID: "unknown-tool". Valid IDs: claude, cursor, copilot, opencode, kilo, codex, antigravity, vscode'
      );
    });

    it("refuses an unknown tool ID before it looks at the plugin mode", () => {
      expect(() =>
        // @ts-expect-error an unregistered name is not an IDE tool id
        makeFlow({ ideTools: ["nope"], pluginMode: "named", pluginNames: [] })
      ).toThrow(InvalidSetupToolIdError);
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
      const flow = makeFlow({ aiTools: [TOOL.claude], pluginMode: "none" });
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
      expect(makeFlow({ scope: "user", aiTools: [TOOL.claude] }).scope).toBe("user");
    });

    it("refuses an IDE tool at user scope — an IDE tool has no user scope to install at", () => {
      expect(() => makeFlow({ scope: "user", ideTools: [TOOL.vscode] })).toThrow(
        UserScopeIdeToolsError
      );
    });

    it("accepts an IDE tool at project scope, unaffected", () => {
      expect(() => makeFlow({ scope: "project", ideTools: [TOOL.vscode] })).not.toThrow();
    });

    it("refuses --scope user with no --ai — nothing would be registered for any tool", () => {
      expect(() => makeFlow({ scope: "user", aiTools: [] })).toThrow(UserScopeNoToolsError);
    });

    it("refuses --scope user when --ai is left unsaid, the same as an empty one", () => {
      expect(() => makeFlow({ scope: "user" })).toThrow(UserScopeNoToolsError);
    });

    it("refuses an AI tool the answer says has no user-scope activation at --scope user", () => {
      expect(() =>
        makeFlow({
          scope: "user",
          aiTools: [TOOL.kilo, TOOL.claude],
          supportsUserScopeActivation: (id) => id !== "kilo",
        })
      ).toThrow(UserScopeUnsupportedAiToolsError);
    });

    it("accepts AI tools the answer says have a user-scope activation", () => {
      expect(() => makeFlow({ scope: "user", aiTools: [TOOL.kilo, TOOL.claude] })).not.toThrow();
    });

    it("refuses an interactive plugin pick at --scope user — there is no project to ask in", () => {
      expect(() =>
        makeFlow({ scope: "user", aiTools: [TOOL.claude], pluginMode: "interactive" })
      ).toThrow(UserScopePluginModeError);
    });

    it.each(["all", "recommended", "none"] as const)(
      "accepts --plugins %s at --scope user",
      (pluginMode) => {
        expect(() =>
          makeFlow({ scope: "user", aiTools: [TOOL.opencode], pluginMode })
        ).not.toThrow();
      }
    );
  });
});
