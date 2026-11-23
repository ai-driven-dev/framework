import { describe, expect, it } from "vitest";
import { recordsOf } from "../../../../../src/composition/contexts/installation.js";
import type { ProvenNativeRefresh } from "../../../../../src/contexts/installation/application/plugin/update-native-refs.js";
import type {
  MachinePluginUpdate,
  UpdatePluginRequest,
} from "../../../../../src/contexts/installation/application/plugin/update-plugin-command.js";
import { PluginNotFoundError } from "../../../../../src/contexts/installation/contract/installation.error.js";
import type { ToolRecords } from "../../../../../src/contexts/installation/contract/records/scope-records.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { buildMachinePluginUpdate } from "../../testing/build-update-plugin.builder.js";
import {
  FakeUserPluginMaterialization,
  NEXT_VERSION,
} from "../../testing/fake-user-plugin-materialization.fake.js";
import { aManifest } from "../../testing/manifest.builder.js";

const ROOT = "/project";

function plugin(name: string, options: { scope?: Scope } = {}) {
  return RecordedPlugin.fromJSON({
    name,
    source: { kind: "local", path: "/fixture" },
    version: "1.0.0",
    strict: false,
    files: { "a.md": "h1" },
    scope: options.scope ?? "user",
  });
}

interface Claim {
  readonly ref: string;
  readonly dependents?: string[];
}

function fixture(
  options: {
    plugins?: RecordedPlugin[];
    claims?: Claim[];
    /** The projects holding each plugin, by name. */
    held?: Record<string, string[]>;
    materializer?: ConstructorParameters<typeof FakeUserPluginMaterialization>[0];
    manifest?: null;
  } = {}
) {
  const builder = aManifest().withTool(TOOL.codex, []);
  for (const p of options.plugins ?? [plugin("aidd-dev")]) builder.withPlugin(TOOL.codex, p);
  const manifest = builder.build();
  const records: ToolRecords = new Map();
  if (options.claims !== undefined || options.held !== undefined) {
    const claims = options.claims ?? [];
    records.set(TOOL.codex, {
      binary: "codex",
      marketplaces: [],
      pluginRefs: claims.map((claim) => claim.ref),
      pluginClaims: [
        ...claims.map((claim) => ({ ref: claim.ref, dependents: claim.dependents ?? [] })),
        ...Object.entries(options.held ?? {}).map(([name, dependents]) => ({
          plugin: name,
          dependents,
        })),
      ],
    });
  }
  const repo = new InMemoryManifestRepository(
    options.manifest === null ? null : manifest,
    undefined,
    records
  );
  const materializer = new FakeUserPluginMaterialization(options.materializer);
  const logger = new CapturingLogger();
  const refreshed: { ref: string; tool: AiToolId }[] = [];
  const applied: string[] = [];
  const refreshNative: MachinePluginUpdate["refreshNative"] = async (request) => {
    refreshed.push({ ref: request.ref, tool: request.tool.toolId });
    const refresh: ProvenNativeRefresh = { apply: () => applied.push(request.ref) };
    return refresh;
  };
  const update = buildMachinePluginUpdate({ repo, materializer, logger }, registeredTools());
  const run = (
    command: Partial<UpdatePluginRequest> = {},
    machine: Partial<MachinePluginUpdate> = {}
  ) =>
    update.execute({
      toolIds: [TOOL.codex],
      projectRoot: ROOT,
      ...command,
      machine: {
        isWithinUserScope: () => true,
        refreshNative,
        refSelection: recordsOf(repo),
        afterPreflight: (_toolId, apply) => apply(),
        ...machine,
      },
    });
  return { repo, materializer, logger, refreshed, applied, update, run };
}

describe("updating the user-scope plugins", () => {
  it("refuses a user-scope update without the machine's update context", async () => {
    const { repo, update } = fixture();

    await expect(
      update.execute({ toolIds: [TOOL.codex], projectRoot: ROOT, scope: "user" })
    ).rejects.toThrow("A user-scope plugin update needs the machine's update context.");
    expect(repo.saveCount).toBe(0);
  });

  it("refuses without a machine manifest", async () => {
    await expect(fixture({ manifest: null }).run()).rejects.toThrow("No machine manifest");
  });

  it("updates each user-scope plugin, saves the new version and names it", async () => {
    const { repo, materializer, run } = fixture();

    await expect(run()).resolves.toEqual(["aidd-dev"]);

    expect(materializer.applied).toHaveLength(1);
    expect(
      repo
        .getCurrent()
        ?.getPlugins(TOOL.codex)
        .map((p) => p.version)
    ).toEqual([NEXT_VERSION]);
    expect(repo.saveCount).toBe(1);
  });

  it("leaves a plugin that is already up to date unsaved and unnamed", async () => {
    const { repo, run } = fixture({ materializer: { upToDate: ["aidd-dev"] } });

    await expect(run()).resolves.toEqual([]);
    expect(repo.saveCount).toBe(0);
  });

  it("leaves a project-scope plugin alone", async () => {
    const { materializer, run } = fixture({
      plugins: [plugin("aidd-dev", { scope: "project" })],
    });

    await expect(run()).resolves.toEqual([]);
    expect(materializer.planned).toEqual([]);
  });

  it("plans only the plugins named", async () => {
    const { materializer, run } = fixture({ plugins: [plugin("aidd-dev"), plugin("aidd-pm")] });

    await expect(run({ pluginNames: ["aidd-pm"] })).resolves.toEqual(["aidd-pm"]);
    expect(materializer.planned.map((request) => request.plugin.plugin.name)).toEqual(["aidd-pm"]);
  });

  it("names a selection that matches no plugin and no native ref", async () => {
    await expect(fixture().run({ pluginNames: ["nope"] })).rejects.toBeInstanceOf(
      PluginNotFoundError
    );
  });

  it("plans a rebuild as asked", async () => {
    const { materializer, run } = fixture();

    await run({ rebuild: true });

    expect(materializer.planned.map((request) => request.rebuild)).toEqual([true]);
  });

  it("warns that the dependents of an updated plugin must refresh", async () => {
    const { logger, run } = fixture({ held: { "aidd-dev": ["/other"] } });

    await run();

    expect(logger.warnMessages.join("\n")).toContain("/other");
  });

  it("applies each tool's files through the scenario once preflight passed", async () => {
    const { run } = fixture();
    const tools: AiToolId[] = [];

    await run(
      {},
      {
        afterPreflight: (toolId, apply) => {
          tools.push(toolId);
          return apply();
        },
      }
    );

    expect(tools).toEqual([TOOL.codex]);
  });

  it("saves nothing when applying fails", async () => {
    const failure = new Error("disk full");
    const { repo, run } = fixture({ materializer: { applyFails: failure } });

    await expect(run()).rejects.toBe(failure);
    expect(repo.saveCount).toBe(0);
  });
});

describe("updating the user-scope native refs", () => {
  const claims = [{ ref: "aidd-dev@framework" }];

  it("refreshes each claimed ref and names it", async () => {
    const { refreshed, applied, run } = fixture({ plugins: [], claims });

    await expect(run()).resolves.toEqual(["aidd-dev@framework"]);
    expect(refreshed).toEqual([{ ref: "aidd-dev@framework", tool: TOOL.codex }]);
    expect(applied).toEqual(["aidd-dev@framework"]);
  });

  it("does not refresh a native ref on a rebuild", async () => {
    const { refreshed, run } = fixture({ plugins: [], claims });

    await run({ rebuild: true, pluginNames: undefined });

    expect(refreshed).toEqual([]);
  });

  it("warns that the dependents of a refreshed ref must refresh", async () => {
    const { logger, run } = fixture({
      plugins: [],
      claims: [{ ref: "aidd-dev@framework", dependents: ["/other"] }],
    });

    await run();

    expect(logger.warnMessages.join("\n")).toContain("/other");
  });

  it("refuses a bare plugin name that matches several catalogues", async () => {
    const { run } = fixture({
      plugins: [],
      claims: [{ ref: "aidd-dev@one" }, { ref: "aidd-dev@two" }],
    });

    await expect(run({ pluginNames: ["aidd-dev"] })).rejects.toThrow(
      "Multiple native catalogues match"
    );
  });

  it("refreshes the one catalogue an exact ref names", async () => {
    const { refreshed, run } = fixture({
      plugins: [],
      claims: [{ ref: "aidd-dev@one" }, { ref: "aidd-dev@two" }],
    });

    await run({ pluginNames: ["aidd-dev@two"] });

    expect(refreshed.map((r) => r.ref)).toEqual(["aidd-dev@two"]);
  });
});
