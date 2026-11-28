import { describe, expect, it } from "vitest";
import { PLUGIN_LIST_PARSERS } from "../../../../src/contexts/host-registration/infrastructure/plugin-list-parsers.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { registeredAiConfig } from "../../../shared/testing/catalog-of.builder.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { newestRecording } from "../testing/recorded-host.builder.js";

/** What a host's recorded `plugin list --json` parses to, with the layout its profile declares. */
function listed(tool: AiToolId, id: string) {
  const layout = registeredAiConfig(tool).nativeActivation()?.cliShape().pluginListLayout;
  if (layout === undefined) throw new Error(`${tool} declares no plugin list layout`);
  const step = newestRecording(tool).steps.find((candidate) => candidate.id === id);
  if (step === undefined) throw new Error(`no recorded step '${id}'`);
  return PLUGIN_LIST_PARSERS[layout](step.stdout);
}

describe("the plugin list each host printed, read with the layout its profile declares", () => {
  it("names each plugin by its ref, with claude's scope", () => {
    expect(listed(TOOL.claude, "plugin-list-after-refusal")).toEqual([
      { ref: "p@mk-one", enabled: true, scope: "local" },
    ]);
    expect(listed(TOOL.codex, "plugin-list")).toEqual([{ ref: "p@cx-one", enabled: true }]);
    expect(listed(TOOL.copilot, "plugin-list")).toEqual([{ ref: "p@mk-one", enabled: true }]);
  });

  it("keeps a plugin copilot uninstalled as disabled", () => {
    expect(listed(TOOL.copilot, "plugin-list-after-uninstall")).toEqual([
      { ref: "p@mk-one", enabled: false },
    ]);
  });
});
