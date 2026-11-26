import { describe, expect, it } from "vitest";
import {
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnsupportedAiToolsError,
} from "../../../../../src/contexts/installation/contract/installation.error.js";
import {
  idsAmong,
  validatePluginMode,
  validateUserScope,
} from "../../../../../src/contexts/installation/contract/setup/setup-request-rules.model.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../../../shared/testing/synthetic-tool-id.builder.js";

const tools = syntheticMixedCatalog();
const registered = tools.idsInCanonicalOrder();
const aiToolIds = tools.idsInCanonicalOrder("ai");

describe("spelling the tools a setup names", () => {
  it("returns the ids the names spell, in the order written", () => {
    expect(idsAmong(registered, aiToolIds, [SECOND_SYNTHETIC_TOOL, SYNTHETIC_TOOL])).toEqual([
      SECOND_SYNTHETIC_TOOL,
      SYNTHETIC_TOOL,
    ]);
  });

  it("refuses a name no candidate bears, naming every registered id", () => {
    const unknown = () => idsAmong(registered, aiToolIds, ["unknown-tool"]);

    expect(unknown).toThrow(InvalidSetupToolIdError);
    expect(unknown).toThrow(
      expect.objectContaining({
        id: "unknown-tool",
        validIds: [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL, SYNTHETIC_IDE_TOOL],
      })
    );
  });

  it("refuses an editor named where only AI tools may be", () => {
    expect(() => idsAmong(registered, aiToolIds, [SYNTHETIC_IDE_TOOL])).toThrow(
      InvalidSetupToolIdError
    );
  });
});

describe("checking the plugin mode against the names", () => {
  it("accepts mode 'named' once a plugin is named", () => {
    expect(() => validatePluginMode("named", ["my-plugin"])).not.toThrow();
  });

  it("accepts a mode other than 'named' with no name", () => {
    expect(() => validatePluginMode("all", [])).not.toThrow();
  });

  it("says what mode 'named' needs when no plugin is named", () => {
    const noName = () => validatePluginMode("named", []);

    expect(noName).toThrow(InvalidPluginModeConfigError);
    expect(noName).toThrow(
      expect.objectContaining({ detail: 'Plugin mode "named" requires at least one plugin name.' })
    );
  });

  it("names the mode that was given when names arrive under another mode", () => {
    const stray = () => validatePluginMode("all", ["my-plugin"]);

    expect(stray).toThrow(InvalidPluginModeConfigError);
    expect(stray).toThrow(
      expect.objectContaining({
        detail: 'Plugin names provided but mode is "all" (expected "named").',
      })
    );
  });
});

describe("checking a setup at the user scope", () => {
  const request = (over: Partial<Parameters<typeof validateUserScope>[0]> = {}) =>
    validateUserScope({
      supportsUserScopeActivation: () => true,
      scope: "user",
      aiTools: [SYNTHETIC_TOOL],
      ideTools: [],
      pluginMode: "none",
      ...over,
    });

  it("accepts a project setup whatever it names", () => {
    expect(() =>
      request({ scope: "project", aiTools: [], ideTools: [SYNTHETIC_IDE_TOOL] })
    ).not.toThrow();
  });

  it("refuses an IDE tool, which has no user scope to install at", () => {
    expect(() => request({ ideTools: [SYNTHETIC_IDE_TOOL] })).toThrow(UserScopeIdeToolsError);
  });

  it("refuses no AI tool at all, since nothing would be registered", () => {
    expect(() => request({ aiTools: [] })).toThrow(UserScopeNoToolsError);
  });

  it("refuses an AI tool with no user-scope activation, naming it", () => {
    const unsupported = () =>
      request({
        aiTools: [SECOND_SYNTHETIC_TOOL, SYNTHETIC_TOOL],
        supportsUserScopeActivation: (id) => id !== SECOND_SYNTHETIC_TOOL,
      });

    expect(unsupported).toThrow(UserScopeUnsupportedAiToolsError);
    expect(unsupported).toThrow(expect.objectContaining({ aiTools: [SECOND_SYNTHETIC_TOOL] }));
  });

  it("refuses an interactive plugin pick, since there is no project to ask in", () => {
    expect(() => request({ pluginMode: "interactive" })).toThrow(UserScopePluginModeError);
  });

  it.each(["all", "recommended", "none", "named"] as const)(
    "accepts --plugins %s",
    (pluginMode) => {
      expect(() => request({ pluginMode })).not.toThrow();
    }
  );
});
