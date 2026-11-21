import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ArtifactContract,
  PluginPresence,
  SourceMarketplaceRef,
  SourcePluginEntryRef,
  ToolBuildContract,
} from "../../../../../src/contexts/tools/contract/build-contract.js";
import {
  JsonSchemaValidationError,
  MarketplaceOutDirNotEmptyError,
} from "../../../../../src/contexts/translate/domain/translate.error.js";
import type { JsonSchemaValidator } from "../../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskSink } from "../../testing/disk-sink.builder.js";

const PLUGIN = "aidd-test";
// resolve(): on Windows a leading "/" is drive-relative. Posix after: the adapter keys writes so.
const OUT_DIR = resolve("/tmp/aidd-marketplace-stub-out").replaceAll("\\", "/");
const PLUGIN_SRC = "/src/plugins/aidd-test";
const PLUGIN_OUT = `${OUT_DIR}/plugins/${PLUGIN}`;
// Avoid biome noTemplateCurlyInString: split literal for the placeholder.
const CLAUDE_ROOT_TOKEN = "$" + "{CLAUDE_PLUGIN_ROOT}";
const STUB_ROOT_TOKEN = "$" + "{STUB_PLUGIN_ROOT}";

const passingValidator: JsonSchemaValidator = {
  validate(_schema: object, _data: unknown): void {},
};

function assetProviderNaming(loaded: string[]): AssetProvider {
  return {
    loadConfigAsset: () => {
      throw new Error("not used");
    },
    loadSchema: (name) => {
      loaded.push(name);
      return { schemaFor: name };
    },
  };
}

function supportedArtifact(
  path: (plugin: string, relPath: string) => string,
  extra: Partial<Extract<ArtifactContract, { supported: true }>> = {}
): ArtifactContract {
  return { supported: true, source: { kind: "fullTree", srcDir: "." }, path, ...extra };
}

function stubContract(over: Partial<ToolBuildContract> = {}): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      agents: supportedArtifact((_plugin, rel) => rel),
      skills: supportedArtifact((_plugin, rel) => rel),
      hooks: supportedArtifact((_plugin, rel) => rel),
      mcp: supportedArtifact((_plugin, rel) => rel),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    ...over,
  };
}

/** One marketplace build of the stub plugin, step by step, over the real sink. */
function sinkFor(
  fs: InMemoryFileAdapter,
  contract: ToolBuildContract,
  options: { force?: boolean; validator?: JsonSchemaValidator; assetProvider?: AssetProvider } = {}
) {
  const sink = aDiskSink(
    fs,
    options.validator ?? passingValidator,
    options.assetProvider ?? assetProviderNaming([]),
    new CapturingLogger()
  );
  const target = {
    contract,
    mode: "marketplace",
    force: options.force ?? false,
    sourceDir: "/src",
    outDir: OUT_DIR,
  } as const;
  return {
    prepare: () => sink.prepare(target),
    write: () => {
      const manifest = `${PLUGIN_SRC}/.claude-plugin/plugin.json`;
      if (!fs.has(manifest)) fs.setFile(manifest, "{}");
      return sink.writePlugin(target, PLUGIN, PLUGIN_SRC);
    },
    finish: (source: SourceMarketplaceRef, built: { name: string }[]) =>
      sink.finish(target, source, built),
  };
}

function writtenUnder(fs: InMemoryFileAdapter, dir: string): Record<string, string | undefined> {
  return Object.fromEntries(fs.listUnder(dir).map((path) => [path, fs.getFile(path)]));
}

describe("preparing a marketplace output directory", () => {
  it("accepts a directory holding no entry yet", async () => {
    const fs = new InMemoryFileAdapter();
    await fs.createDirectory(OUT_DIR);
    await expect(sinkFor(fs, stubContract()).prepare()).resolves.toBeUndefined();
  });

  it("refuses a directory that already holds something, naming it", async () => {
    const fs = new InMemoryFileAdapter({ [`${OUT_DIR}/old.json`]: "{}" });
    await expect(sinkFor(fs, stubContract()).prepare()).rejects.toThrow(
      new MarketplaceOutDirNotEmptyError(OUT_DIR)
    );
  });

  it("writes into a directory that already holds something when forced", async () => {
    const fs = new InMemoryFileAdapter({ [`${OUT_DIR}/old.json`]: "{}" });
    await expect(sinkFor(fs, stubContract(), { force: true }).prepare()).resolves.toBeUndefined();
  });

  it("accepts a directory that is not there yet when forced", async () => {
    const fs = new InMemoryFileAdapter();
    await expect(sinkFor(fs, stubContract(), { force: true }).prepare()).resolves.toBeUndefined();
  });

  it("writes its own output and keeps the file it did not write when forced", async () => {
    const fs = new InMemoryFileAdapter({
      [`${OUT_DIR}/keep.txt`]: "keepme",
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Hello\n",
    });
    const strategy = sinkFor(fs, stubContract(), { force: true });

    await strategy.prepare();
    await strategy.write();

    expect(fs.getFile(`${OUT_DIR}/keep.txt`)).toBe("keepme");
    expect(fs.getFile(`${PLUGIN_OUT}/skills/hello/SKILL.md`)).toBe("# Hello\n");
  });
});

describe("the plugin manifest a marketplace layout synthesizes", () => {
  const sourceManifest = '{ "name": "aidd-test", "version": "1.0.0" }';

  function manifestContract(over: Partial<ToolBuildContract> = {}): ToolBuildContract {
    return stubContract({
      manifestFileRelative: ".stub-plugin/plugin.json",
      synthesizeManifest: (source, presence) => ({ ...source, skills: presence.skillsList }),
      ...over,
    });
  }

  it("writes it where the layout names it, indented and newline-terminated", async () => {
    const fs = new InMemoryFileAdapter({
      [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: sourceManifest,
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Hello",
    });
    // The manifest and the one skill it lists.
    expect(await sinkFor(fs, manifestContract()).write()).toBe(2);
    expect(fs.getFile(`${PLUGIN_OUT}/.stub-plugin/plugin.json`)).toBe(
      '{\n  "name": "aidd-test",\n  "version": "1.0.0",\n  "skills": [\n    "hello"\n  ]\n}\n'
    );
  });

  it("writes none for a layout that synthesizes none", async () => {
    const fs = new InMemoryFileAdapter({
      [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: sourceManifest,
    });
    expect(await sinkFor(fs, stubContract()).write()).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });

  it("writes none for a layout that synthesizes one but names no file for it", async () => {
    const fs = new InMemoryFileAdapter({
      [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: sourceManifest,
    });
    const contract = manifestContract({ manifestFileRelative: null });
    expect(await sinkFor(fs, contract).write()).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });

  it("validates it against the schema the layout names, before writing anything", async () => {
    const fs = new InMemoryFileAdapter({
      [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: sourceManifest,
    });
    const loaded: string[] = [];
    // The source manifest is validated first and must pass: only what the layout synthesized
    // (it alone carries `skills`) is refused.
    const refusing: JsonSchemaValidator = {
      validate(_schema: object, data: unknown): void {
        if (typeof data === "object" && data !== null && "skills" in data) {
          throw new JsonSchemaValidationError(["refused"]);
        }
      },
    };
    await expect(
      sinkFor(fs, manifestContract({ manifestSchemaName: "plugin-manifest" }), {
        validator: refusing,
        assetProvider: assetProviderNaming(loaded),
      }).write()
    ).rejects.toThrow(JsonSchemaValidationError);
    expect(loaded).toEqual(["plugin-manifest", "plugin-manifest"]);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });
});

describe("the agents a marketplace layout writes", () => {
  const reviewer = "---\nname: reviewer\n---\n\nReview.\n";

  it("writes each agent markdown under the plugin's own tree, and nothing else", async () => {
    const fs = new InMemoryFileAdapter({
      [`${PLUGIN_SRC}/agents/reviewer.md`]: reviewer,
      [`${PLUGIN_SRC}/agents/notes.txt`]: "not an agent",
    });
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        agents: supportedArtifact((plugin, rel) => `${plugin}/${rel}`),
      },
    });
    expect(await sinkFor(fs, contract).write()).toBe(1);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({
      [`${PLUGIN_OUT}/${PLUGIN}/agents/reviewer.md`]: reviewer,
    });
  });

  it("hands each agent to the layout's own transform when it declares one", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN_SRC}/agents/reviewer.md`]: reviewer });
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        agents: supportedArtifact((_plugin, rel) => rel.replace(/\.md$/, ".toml"), {
          transform: (content, plugin, base) => `${plugin}:${base}\n${content}`,
        }),
      },
    });
    await sinkFor(fs, contract).write();
    expect(writtenUnder(fs, OUT_DIR)).toEqual({
      [`${PLUGIN_OUT}/agents/reviewer.toml`]: `aidd-test:reviewer.md\n${reviewer}`,
    });
  });

  it("writes none for a layout hosting no agent", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN_SRC}/agents/reviewer.md`]: reviewer });
    const contract = stubContract({
      artifacts: { ...stubContract().artifacts, agents: { supported: false } },
    });
    expect(await sinkFor(fs, contract).write()).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });
});

describe("the skills a marketplace layout writes", () => {
  it("carries the plugin's whole skill tree under its own directory", async () => {
    const fs = new InMemoryFileAdapter({
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Hello\n",
      [`${PLUGIN_SRC}/skills/hello/reference.json`]: "{}\n",
    });
    expect(await sinkFor(fs, stubContract()).write()).toBe(2);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({
      [`${PLUGIN_OUT}/skills/hello/SKILL.md`]: "# Hello\n",
      [`${PLUGIN_OUT}/skills/hello/reference.json`]: "{}\n",
    });
  });

  it("writes none for a layout hosting no skill", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Hello\n" });
    const contract = stubContract({
      artifacts: { ...stubContract().artifacts, skills: { supported: false } },
    });
    expect(await sinkFor(fs, contract).write()).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });
});

describe("the hooks a marketplace layout writes", () => {
  const hooksJson = `{ "command": "${CLAUDE_ROOT_TOKEN}/hooks/check.sh" }`;
  const script = `#!/bin/sh\nexec "${CLAUDE_ROOT_TOKEN}/hooks/lib/run.sh"\n`;

  function hooksFs(): InMemoryFileAdapter {
    return new InMemoryFileAdapter({
      [`${PLUGIN_SRC}/hooks/hooks.json`]: hooksJson,
      [`${PLUGIN_SRC}/hooks/lib/check.sh`]: script,
    });
  }

  it("keeps the whole hooks tree and rewrites the plugin root the layout expands", async () => {
    const fs = hooksFs();
    const contract = stubContract({ pluginRootToken: STUB_ROOT_TOKEN });
    expect(await sinkFor(fs, contract).write()).toBe(2);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({
      [`${PLUGIN_OUT}/hooks/hooks.json`]: `{ "command": "${STUB_ROOT_TOKEN}/hooks/check.sh" }`,
      [`${PLUGIN_OUT}/hooks/lib/check.sh`]: `#!/bin/sh\nexec "${STUB_ROOT_TOKEN}/hooks/lib/run.sh"\n`,
    });
  });

  it("leaves the plugin root alone for a layout that expands none", async () => {
    const fs = hooksFs();
    expect(await sinkFor(fs, stubContract()).write()).toBe(2);
    expect(fs.getFile(`${PLUGIN_OUT}/hooks/hooks.json`)).toBe(hooksJson);
  });

  it("hands the manifest, and no script, to the layout's own transform", async () => {
    const fs = hooksFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        hooks: supportedArtifact((_plugin, rel) => rel, {
          transform: (content, plugin, base) => `${plugin}:${base}\n${content}`,
        }),
      },
    });
    await sinkFor(fs, contract).write();
    expect(writtenUnder(fs, OUT_DIR)).toEqual({
      [`${PLUGIN_OUT}/hooks/hooks.json`]: `aidd-test:hooks.json\n${hooksJson}`,
      [`${PLUGIN_OUT}/hooks/lib/check.sh`]: script,
    });
  });

  it("writes none for a plugin shipping no hooks directory", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN_SRC}/README.md`]: "# Plugin\n" });
    expect(await sinkFor(fs, stubContract()).write()).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });
});

describe("the mcp declaration a marketplace layout writes", () => {
  const mcpJson = `{ "command": "${CLAUDE_ROOT_TOKEN}/bin/server.js" }`;

  it("writes it at the plugin root with the plugin root the layout expands", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN_SRC}/.mcp.json`]: mcpJson });
    const contract = stubContract({ pluginRootToken: STUB_ROOT_TOKEN });
    expect(await sinkFor(fs, contract).write()).toBe(1);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({
      [`${PLUGIN_OUT}/.mcp.json`]: `{ "command": "${STUB_ROOT_TOKEN}/bin/server.js" }`,
    });
  });

  it("hands it to the layout's own transform when it declares one", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN_SRC}/.mcp.json`]: mcpJson });
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        mcp: supportedArtifact((_plugin, rel) => rel, {
          transform: (content, plugin, base) => `${plugin}:${base}\n${content}`,
        }),
      },
    });
    await sinkFor(fs, contract).write();
    expect(fs.getFile(`${PLUGIN_OUT}/.mcp.json`)).toBe(`aidd-test:.mcp.json\n${mcpJson}`);
  });

  it("writes none for a plugin declaring none", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN_SRC}/README.md`]: "# Plugin\n" });
    expect(await sinkFor(fs, stubContract()).write()).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });

  it("writes none for a layout hosting no mcp declaration", async () => {
    const fs = new InMemoryFileAdapter({ [`${PLUGIN_SRC}/.mcp.json`]: mcpJson });
    const contract = stubContract({
      artifacts: { ...stubContract().artifacts, mcp: { supported: false } },
    });
    expect(await sinkFor(fs, contract).write()).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });
});

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
    const loaded: string[] = [];
    const refusing: JsonSchemaValidator = {
      validate(_schema: object, _data: unknown): void {
        throw new JsonSchemaValidationError(["refused"]);
      },
    };
    await expect(
      sinkFor(fs, catalogContract([], "marketplace"), {
        validator: refusing,
        assetProvider: assetProviderNaming(loaded),
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
