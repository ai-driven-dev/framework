import { describe, expect, it } from "vitest";
import { SetupFlow } from "../../../src/orchestration/domain/setup-flow.model.js";
import {
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnsupportedAiToolsError,
} from "../../../src/orchestration/orchestration.error.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

const ROOT = "/project";

function flowTools() {
  const tools = syntheticMixedCatalog();
  return {
    registeredToolIds: tools.idsInCanonicalOrder(),
    aiToolIds: tools.idsInCanonicalOrder("ai"),
    ideToolIds: tools.idsInCanonicalOrder("ide"),
  };
}

function makeFlow(overrides: Partial<ConstructorParameters<typeof SetupFlow>[0]> = {}): SetupFlow {
  return new SetupFlow({
    ...flowTools(),
    projectRoot: ROOT,
    supportsUserScopeActivation: () => true,
    ...overrides,
  });
}

describe("building a setup flow", () => {
  describe("constructor validation", () => {
    it("throws InvalidSetupToolIdError for unknown AI tool IDs, naming every valid one", () => {
      expect(() => makeFlow({ aiTools: ["unknown-tool"] })).toThrow(InvalidSetupToolIdError);
      expect(() => makeFlow({ aiTools: ["unknown-tool"] })).toThrow(
        expect.objectContaining({
          id: "unknown-tool",
          validIds: [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL, SYNTHETIC_IDE_TOOL],
        })
      );
    });

    it("refuses an unknown tool ID before it looks at the plugin mode", () => {
      expect(() => makeFlow({ ideTools: ["nope"], pluginMode: "named", pluginNames: [] })).toThrow(
        InvalidSetupToolIdError
      );
    });

    it("constructs successfully with valid params", () => {
      const flow = makeFlow({ aiTools: [SYNTHETIC_TOOL], pluginMode: "none" });
      expect(flow.projectRoot).toBe(ROOT);
      expect(flow.aiTools).toEqual([SYNTHETIC_TOOL]);
    });

    it("accepts mode 'named' once a plugin is named, carrying the names through", () => {
      const flow = makeFlow({ pluginMode: "named", pluginNames: ["my-plugin"] });

      expect(flow.pluginMode).toBe("named");
      expect(flow.pluginNames).toStrictEqual(["my-plugin"]);
    });

    it("says what mode 'named' needs when no plugin is named", () => {
      const noName = () => makeFlow({ pluginMode: "named", pluginNames: [] });

      expect(noName).toThrow(InvalidPluginModeConfigError);
      expect(noName).toThrow(
        expect.objectContaining({
          detail: 'Plugin mode "named" requires at least one plugin name.',
        })
      );
    });

    it("names the mode that was given when names arrive under another mode", () => {
      const stray = () => makeFlow({ pluginMode: "all", pluginNames: ["my-plugin"] });

      expect(stray).toThrow(InvalidPluginModeConfigError);
      expect(stray).toThrow(
        expect.objectContaining({
          detail: 'Plugin names provided but mode is "all" (expected "named").',
        })
      );
    });

    it("reads an unsaid mode as none when names arrive", () => {
      expect(() => makeFlow({ pluginNames: ["my-plugin"] })).toThrow(
        expect.objectContaining({
          detail: 'Plugin names provided but mode is "none" (expected "named").',
        })
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

  describe("choosing the setup scope", () => {
    it("defaults to project", () => {
      expect(makeFlow().scope).toBe("project");
    });

    it("carries user through when asked", () => {
      expect(makeFlow({ scope: "user", aiTools: [SYNTHETIC_TOOL] }).scope).toBe("user");
    });

    it("refuses an IDE tool at user scope - an IDE tool has no user scope to install at", () => {
      expect(() => makeFlow({ scope: "user", ideTools: [SYNTHETIC_IDE_TOOL] })).toThrow(
        UserScopeIdeToolsError
      );
    });

    it("accepts an IDE tool at project scope, unaffected", () => {
      expect(() => makeFlow({ scope: "project", ideTools: [SYNTHETIC_IDE_TOOL] })).not.toThrow();
    });

    it("refuses --scope user with no --ai - nothing would be registered for any tool", () => {
      expect(() => makeFlow({ scope: "user", aiTools: [] })).toThrow(UserScopeNoToolsError);
    });

    it("refuses --scope user when --ai is left unsaid, the same as an empty one", () => {
      expect(() => makeFlow({ scope: "user" })).toThrow(UserScopeNoToolsError);
    });

    it("refuses an AI tool the answer says has no user-scope activation at --scope user", () => {
      expect(() =>
        makeFlow({
          scope: "user",
          aiTools: [SECOND_SYNTHETIC_TOOL, SYNTHETIC_TOOL],
          supportsUserScopeActivation: (id) => id !== SECOND_SYNTHETIC_TOOL,
        })
      ).toThrow(UserScopeUnsupportedAiToolsError);
    });

    it("accepts AI tools the answer says have a user-scope activation", () => {
      expect(() =>
        makeFlow({ scope: "user", aiTools: [SECOND_SYNTHETIC_TOOL, SYNTHETIC_TOOL] })
      ).not.toThrow();
    });

    it("refuses an interactive plugin pick at --scope user - there is no project to ask in", () => {
      expect(() =>
        makeFlow({ scope: "user", aiTools: [SYNTHETIC_TOOL], pluginMode: "interactive" })
      ).toThrow(UserScopePluginModeError);
    });

    it.each(["all", "recommended", "none"] as const)(
      "accepts --plugins %s at --scope user",
      (pluginMode) => {
        expect(() =>
          makeFlow({ scope: "user", aiTools: [SECOND_SYNTHETIC_TOOL], pluginMode })
        ).not.toThrow();
      }
    );
  });
});
