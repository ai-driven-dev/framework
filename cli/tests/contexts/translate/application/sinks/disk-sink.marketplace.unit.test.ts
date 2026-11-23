import { describe, expect, it } from "vitest";
import {
  JsonSchemaValidationError,
  MarketplaceOutDirNotEmptyError,
} from "../../../../../src/contexts/translate/domain/translate.error.js";
import type { JsonSchemaValidator } from "../../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { ToolBuildContract } from "../../../../../src/shared/domain/materialization/build-contract.js";
import type { SchemaName } from "../../../../../src/shared/domain/reading/config-asset.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  CLAUDE_ROOT_TOKEN,
  OUT_DIR,
  PLUGIN,
  PLUGIN_OUT,
  PLUGIN_SRC,
  STUB_ROOT_TOKEN,
  sinkFor,
  stubContract,
  supportedArtifact,
  writtenUnder,
} from "../../testing/marketplace-sink-world.builder.js";
import { schemasNaming } from "../../testing/schema-provider.builder.js";

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
    const loaded: SchemaName[] = [];
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
        schemaProvider: schemasNaming(loaded),
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
        agents: supportedArtifact({ kind: "agentFiles", dir: `${PLUGIN}/agents`, ext: ".md" }),
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
        agents: supportedArtifact(
          { kind: "agentFiles", dir: "agents", ext: ".toml" },
          {
            transform: (content, plugin, base) => `${plugin}:${base}\n${content}`,
          }
        ),
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
      artifacts: {
        ...stubContract().artifacts,
        agents: { supported: false, reason: "off in this test" },
      },
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
      artifacts: {
        ...stubContract().artifacts,
        skills: { supported: false, reason: "off in this test" },
      },
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
        hooks: supportedArtifact(
          { kind: "relative" },
          {
            transform: (content, plugin, base) => `${plugin}:${base}\n${content}`,
          }
        ),
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
        mcp: supportedArtifact(
          { kind: "relative" },
          {
            transform: (content, plugin, base) => `${plugin}:${base}\n${content}`,
          }
        ),
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
      artifacts: {
        ...stubContract().artifacts,
        mcp: { supported: false, reason: "off in this test" },
      },
    });
    expect(await sinkFor(fs, contract).write()).toBe(0);
    expect(writtenUnder(fs, OUT_DIR)).toEqual({});
  });
});
