import { describe, expect, it } from "vitest";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { detachNativePluginRefs } from "../../src/contexts/machine-claims/application/native-plugin-ownership.js";
import { detachUserPlugin } from "../../src/contexts/machine-claims/application/user-plugin-ownership.js";
import type {
  MachineManifest,
  MachineNativeRegistrations,
  MachineUserPlugin,
} from "../../src/contexts/machine-claims/ports/machine-manifest.js";
import { ToolNotInManifestError } from "../../src/shared/domain/errors.js";
import type { AiToolId } from "../../src/shared/domain/tool.js";
import { InMemoryMachineManifest } from "../contexts/machine-claims/testing/in-memory-machine-manifest.fake.js";
import { MachinePlugin } from "../contexts/machine-claims/testing/machine-plugin.fake.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryRepository } from "../shared/testing/in-memory-repository.fake.js";
import { TOOL } from "../shared/testing/registered-tools.builder.js";

/** The machine-wide record as machine-claims reads it, seeded with plugins. */
interface SeedableMachineManifest extends MachineManifest {
  addPlugin(toolId: AiToolId, plugin: MachineUserPlugin): void;
}

interface MachineManifestKind {
  readonly name: string;
  recordHolding(...tools: readonly AiToolId[]): SeedableMachineManifest;
  aUserPlugin(name: string, dependents: readonly string[]): MachineUserPlugin;
}

const PLUGIN_VERSION = "1.0.0";
const PLUGIN_SOURCE = { kind: "local", path: "/plugin" } as const;
const MANIFEST_TOOL_VERSION = "1.0.0";

const fake: MachineManifestKind = {
  name: "the in-memory fake",
  recordHolding: (...tools) => new InMemoryMachineManifest(...tools),
  aUserPlugin: (name, dependents) => new MachinePlugin({ name, dependents }),
};

const real: MachineManifestKind = {
  name: "the installation's Manifest",
  recordHolding: (...tools) => {
    const manifest = Manifest.create();
    for (const tool of tools) manifest.addTool(tool, MANIFEST_TOOL_VERSION, []);
    return manifest;
  },
  aUserPlugin: (name, dependents) =>
    InstalledPlugin.fromMetadata(name, PLUGIN_VERSION, PLUGIN_SOURCE, false, "user").withDependents(
      dependents
    ),
};

const REGISTRATIONS: MachineNativeRegistrations & Record<string, unknown> = {
  binary: "codex",
  marketplaces: [],
  pluginRefs: ["sample-plugin@catalog"],
  pluginClaims: [{ ref: "sample-plugin@catalog", dependents: ["/A", "/B"] }],
};

describe.each([fake, real])("the machine-wide record, as $name answers it", (kind) => {
  const { cursor, codex } = TOOL;

  it("answers nothing for a tool it does not hold", () => {
    const record = kind.recordHolding();

    expect(record.getNativeRegistrations(codex)).toBeUndefined();
    expect(record.getPlugins(cursor)).toEqual([]);
  });

  it("refuses a registration written for a tool it does not hold", () => {
    const record = kind.recordHolding();

    expect(() => record.setNativeRegistrations(codex, REGISTRATIONS)).toThrow(
      ToolNotInManifestError
    );
  });

  it("refuses a plugin added for a tool it does not hold", () => {
    const record = kind.recordHolding();

    expect(() => record.addPlugin(cursor, kind.aUserPlugin("sample-plugin", []))).toThrow(
      ToolNotInManifestError
    );
  });

  it("refuses a plugin rewritten for a tool it does not hold", () => {
    const record = kind.recordHolding();

    expect(() => record.updatePlugin(cursor, kind.aUserPlugin("sample-plugin", []))).toThrow(
      ToolNotInManifestError
    );
  });

  it("keeps the registration and the plugin written for a tool it holds", () => {
    const record = kind.recordHolding(codex, cursor);
    record.setNativeRegistrations(codex, REGISTRATIONS);
    record.addPlugin(cursor, kind.aUserPlugin("sample-plugin", ["/A"]));
    record.updatePlugin(cursor, kind.aUserPlugin("sample-plugin", ["/B"]));

    expect(record.getNativeRegistrations(codex)?.pluginClaims).toEqual(REGISTRATIONS.pluginClaims);
    expect(record.getPlugins(cursor).map((plugin) => plugin.dependents)).toEqual([["/B"]]);
  });

  it("releases only the detaching project from a user plugin", async () => {
    const record = kind.recordHolding(cursor);
    record.addPlugin(cursor, kind.aUserPlugin("sample-plugin", ["/A", "/B"]));
    const repo = new InMemoryRepository<MachineManifest>(record);

    await detachUserPlugin(
      repo,
      new InMemoryFileAdapter({}, ["/A", "/B", "/C"]),
      cursor,
      "sample-plugin",
      "/A"
    );

    expect(repo.getCurrent()?.getPlugins(cursor)[0]?.dependents).toEqual(["/B"]);
    expect(repo.saveCount).toBe(1);
  });

  it("releases only the detaching project from a native plugin ref", async () => {
    const record = kind.recordHolding(codex);
    record.setNativeRegistrations(codex, REGISTRATIONS);
    const repo = new InMemoryRepository<MachineManifest>(record);
    const refs = new Map([[codex, ["sample-plugin@catalog"]]]);

    await detachNativePluginRefs(repo, new InMemoryFileAdapter({}, ["/A", "/B", "/C"]), "/A", refs);

    expect(repo.getCurrent()?.getNativeRegistrations(codex)?.pluginClaims).toEqual([
      { ref: "sample-plugin@catalog", dependents: ["/B"] },
    ]);
    expect(repo.saveCount).toBe(1);
  });
});
