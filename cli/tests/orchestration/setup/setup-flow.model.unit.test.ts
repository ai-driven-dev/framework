import { describe, expect, it } from "vitest";
import {
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  UserScopeNoToolsError,
} from "../../../src/contexts/installation/contract/installation.error.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.model.js";
import {
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
  describe("what it refuses", () => {
    it("checks the tool ids, then the plugin mode, then the scope", () => {
      expect(() => makeFlow({ ideTools: ["nope"], pluginMode: "named", pluginNames: [] })).toThrow(
        InvalidSetupToolIdError
      );
      expect(() => makeFlow({ pluginMode: "named", pluginNames: [], scope: "user" })).toThrow(
        InvalidPluginModeConfigError
      );
      expect(() => makeFlow({ scope: "user" })).toThrow(UserScopeNoToolsError);
    });
  });

  describe("what it carries", () => {
    it("carries the tools, and the plugin names of mode 'named'", () => {
      const flow = makeFlow({
        aiTools: [SYNTHETIC_TOOL],
        ideTools: [SYNTHETIC_IDE_TOOL],
        pluginMode: "named",
        pluginNames: ["my-plugin"],
      });

      expect([
        flow.projectRoot,
        flow.aiTools,
        flow.ideTools,
        flow.pluginMode,
        flow.pluginNames,
      ]).toEqual([ROOT, [SYNTHETIC_TOOL], [SYNTHETIC_IDE_TOOL], "named", ["my-plugin"]]);
    });

    it("carries user scope, and force, when asked", () => {
      const flow = makeFlow({ scope: "user", aiTools: [SYNTHETIC_TOOL], force: true });

      expect([flow.scope, flow.force]).toEqual(["user", true]);
    });
  });

  describe("defaults for what a caller leaves unsaid", () => {
    it("installs no plugin, names none, is not interactive and does not force", () => {
      const flow = makeFlow();

      expect([flow.pluginMode, flow.pluginNames, flow.interactive, flow.force]).toEqual([
        "none",
        [],
        false,
        false,
      ]);
    });

    it("installs at the project scope and registers the default marketplace", () => {
      const flow = makeFlow();

      expect([flow.scope, flow.registerDefaultMarketplace]).toEqual(["project", true]);
    });
  });
});
