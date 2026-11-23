import { describe, expect, it } from "vitest";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type {
  MachineManifest,
  MachineUserPlugin,
} from "../../src/contexts/machine-claims/ports/machine-manifest.js";
import { ToolNotInManifestError } from "../../src/shared/domain/shared.error.js";
import type { AiToolId } from "../../src/shared/domain/tool.js";
import { InMemoryMachineManifest } from "../contexts/machine-claims/testing/in-memory-machine-manifest.fake.js";
import { MachinePlugin } from "../contexts/machine-claims/testing/machine-plugin.fake.js";
import { TOOL } from "../shared/testing/registered-tools.builder.js";

/** The machine-wide record as machine-claims reads it, seeded with plugins. */
interface SeedableMachineManifest extends MachineManifest {
  addPlugin(toolId: AiToolId, plugin: MachineUserPlugin): void;
}

interface MachineManifestKind {
  readonly name: string;
  recordHolding(...tools: readonly AiToolId[]): SeedableMachineManifest;
  aUserPlugin(name: string): MachineUserPlugin;
}

const PLUGIN_VERSION = "1.0.0";
const PLUGIN_SOURCE = { kind: "local", path: "/plugin" } as const;
const MANIFEST_TOOL_VERSION = "1.0.0";

const fake: MachineManifestKind = {
  name: "the in-memory fake",
  recordHolding: (...tools) => new InMemoryMachineManifest(...tools),
  aUserPlugin: (name) => new MachinePlugin({ name }),
};

const real: MachineManifestKind = {
  name: "the installation's Manifest",
  recordHolding: (...tools) => {
    const manifest = Manifest.create();
    for (const tool of tools) manifest.addTool(tool, MANIFEST_TOOL_VERSION, []);
    return manifest;
  },
  aUserPlugin: (name) =>
    RecordedPlugin.fromMetadata({
      name,
      version: PLUGIN_VERSION,
      source: PLUGIN_SOURCE,
      strict: false,
      scope: "user",
    }),
};

describe.each([fake, real])("the machine-wide record, as $name answers it", (kind) => {
  const { cursor } = TOOL;

  it("answers nothing for a tool it does not hold", () => {
    const record = kind.recordHolding();

    expect(record.getRecordedPlugins(cursor)).toEqual([]);
  });

  it("refuses a plugin added for a tool it does not hold", () => {
    const record = kind.recordHolding();

    expect(() => record.addPlugin(cursor, kind.aUserPlugin("sample-plugin"))).toThrow(
      ToolNotInManifestError
    );
  });

  it("refuses a plugin rewritten for a tool it does not hold", () => {
    const record = kind.recordHolding();

    expect(() => record.updatePlugin(cursor, kind.aUserPlugin("sample-plugin"))).toThrow(
      ToolNotInManifestError
    );
  });

  it("keeps the plugin written for a tool it holds, once however often it is written", () => {
    const record = kind.recordHolding(cursor);
    record.addPlugin(cursor, kind.aUserPlugin("sample-plugin"));
    record.updatePlugin(cursor, kind.aUserPlugin("sample-plugin"));

    expect(record.getRecordedPlugins(cursor).map(({ plugin }) => plugin.name)).toEqual([
      "sample-plugin",
    ]);
  });
});
