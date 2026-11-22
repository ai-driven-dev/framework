import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  PluginPresence,
  ToolBuildContract,
} from "../../../../../src/contexts/tools/contract/build-contract.js";
import { JsonSchemaValidationError } from "../../../../../src/contexts/translate/domain/translate.error.js";
import type { JsonSchemaValidator } from "../../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { SchemaName } from "../../../../../src/shared/domain/config-asset.js";
import type { SourcePluginEntryRef } from "../../../../../src/shared/domain/plugin/source-refs.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  OUT_DIR,
  PLUGIN,
  PLUGIN_SRC,
  sinkFor,
  stubContract,
  writtenUnder,
} from "../../testing/marketplace-sink-world.builder.js";
import { schemasNaming } from "../../testing/schema-provider.builder.js";

describe("the catalog a marketplace layout writes once every plugin is built", () => {
  const sourceMarketplace = {
    name: "aidd-framework",
    plugins: [
      { name: PLUGIN, version: "9.9.9" },
      { name: "unbuilt-plugin", version: "1.0.0" },
    ] satisfies SourcePluginEntryRef[],
  };

  function catalogContract(
    seen: { name: string; pluginSrc: string; srcEntry: SourcePluginEntryRef | undefined }[],
    schemaName: "marketplace" | null
  ): ToolBuildContract {
    return stubContract({
      buildMarketplaceEntry: ({ name, pluginSrc, srcEntry }) => {
        seen.push({ name, pluginSrc, srcEntry });
        return Promise.resolve({ name, version: srcEntry?.version ?? "0.0.0" });
      },
      buildMarketplaceCatalog: (source, entries) =>
        Promise.resolve({
          catalog: { name: source.name, plugins: entries },
          schemaName,
          destRelPath: ".stub-plugin/marketplace.json",
        }),
    });
  }

  it("writes one entry per built plugin, from the source catalog's own entry", async () => {
    const fs = new InMemoryFileAdapter({});
    const seen: { name: string; pluginSrc: string; srcEntry: SourcePluginEntryRef | undefined }[] =
      [];
    expect(
      await sinkFor(fs, catalogContract(seen, null)).finish(sourceMarketplace, [{ name: PLUGIN }])
    ).toBe(1);
    expect(seen).toEqual([
      {
        name: PLUGIN,
        pluginSrc: join(OUT_DIR, "plugins", PLUGIN),
        srcEntry: { name: PLUGIN, version: "9.9.9" },
      },
    ]);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({
      [`${OUT_DIR}/.stub-plugin/marketplace.json`]:
        '{\n  "name": "aidd-framework",\n  "plugins": [\n    {\n      "name": "aidd-test",\n      "version": "9.9.9"\n    }\n  ]\n}\n',
    });
  });

  it("hands no source entry for a plugin the source catalog does not name", async () => {
    const fs = new InMemoryFileAdapter({});
    const seen: { name: string; pluginSrc: string; srcEntry: SourcePluginEntryRef | undefined }[] =
      [];
    await sinkFor(fs, catalogContract(seen, null)).finish(sourceMarketplace, [
      { name: "other-plugin" },
    ]);
    expect(seen).toEqual([
      {
        name: "other-plugin",
        pluginSrc: join(OUT_DIR, "plugins", "other-plugin"),
        srcEntry: undefined,
      },
    ]);
  });

  it("validates it against the schema the layout names", async () => {
    const fs = new InMemoryFileAdapter({});
    const loaded: SchemaName[] = [];
    const refusing: JsonSchemaValidator = {
      validate(_schema: object, _data: unknown): void {
        throw new JsonSchemaValidationError(["refused"]);
      },
    };
    await expect(
      sinkFor(fs, catalogContract([], "marketplace"), {
        validator: refusing,
        schemaProvider: schemasNaming(loaded),
      }).finish(sourceMarketplace, [{ name: PLUGIN }])
    ).rejects.toThrow(JsonSchemaValidationError);
    expect(loaded).toEqual(["marketplace"]);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });

  it("writes none for a layout building a catalog but no entry for it", async () => {
    const fs = new InMemoryFileAdapter({});
    const contract = stubContract({
      buildMarketplaceEntry: null,
      buildMarketplaceCatalog: (source, entries) =>
        Promise.resolve({
          catalog: { name: source.name, plugins: entries },
          schemaName: null,
          destRelPath: ".stub-plugin/marketplace.json",
        }),
    });
    expect(await sinkFor(fs, contract).finish(sourceMarketplace, [{ name: PLUGIN }])).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });

  it("writes none for a layout with no catalog of its own", async () => {
    const fs = new InMemoryFileAdapter({});
    expect(await sinkFor(fs, stubContract()).finish(sourceMarketplace, [{ name: PLUGIN }])).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });
});

describe("what a marketplace layout does with a plugin's presence flags", () => {
  it("reads them off the source tree, not the output", async () => {
    const fs = new InMemoryFileAdapter({
      [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: '{ "name": "aidd-test" }',
      [`${PLUGIN_SRC}/agents/reviewer.md`]: "# Reviewer",
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Hello",
      [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}",
    });
    const seen: PluginPresence[] = [];
    const contract = stubContract({
      manifestFileRelative: "plugin.json",
      synthesizeManifest: (source, presence) => {
        seen.push(presence);
        return source;
      },
    });
    await sinkFor(fs, contract).write();
    expect(seen).toEqual([
      {
        hasAgents: true,
        agentsList: ["reviewer.md"],
        skillsList: ["hello"],
        hasHooksJson: true,
        hasMcpJson: false,
      },
    ]);
  });
});
