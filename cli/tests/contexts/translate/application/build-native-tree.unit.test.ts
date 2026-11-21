import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BuildNativeTree } from "../../../../src/contexts/translate/application/build-native-tree.js";
import { InvalidBuildPathsError } from "../../../../src/shared/domain/errors/invalid-build-paths-error.js";
import { InvalidSourceMarketplaceError } from "../../../../src/shared/domain/errors/invalid-source-marketplace-error.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { buildContractOf } from "../../../shared/testing/registered-build-contracts.builder.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { RecordingSink } from "../testing/recording-sink.builder.js";

const SOURCE = resolve("/source");
const OUT = resolve("/out");
const CATALOG = join(SOURCE, ".claude-plugin/marketplace.json");

function buildOver(files: Record<string, string>, sink = new RecordingSink()) {
  const fs = new InMemoryFileAdapter(files);
  const logger = new CapturingLogger();
  const layout = {
    contract: buildContractOf(TOOL.copilot, "marketplace"),
    mode: "marketplace",
    force: false,
  } as const;
  const build = new BuildNativeTree(fs, logger, sink, layout);
  return {
    build,
    sink,
    logger,
    run: () => build.execute({ sourceDir: SOURCE, outDir: OUT, target: TOOL.copilot }),
  };
}

const catalogOf = (...names: string[]): string =>
  JSON.stringify({ plugins: names.map((name) => ({ name })) });

describe("BuildNativeTree", () => {
  it("prepares the tree, writes each plugin in catalog order, then closes it", async () => {
    const { run, sink } = buildOver({
      [CATALOG]: catalogOf("a", "b"),
      [join(SOURCE, "plugins/a/x.md")]: "",
      [join(SOURCE, "plugins/b/x.md")]: "",
    });

    await run();

    expect(sink.calls).toEqual(["prepare", "write a", "write b", "finish a,b"]);
  });

  it("totals the files each plugin wrote and the ones the tree added", async () => {
    const { run } = buildOver(
      {
        [CATALOG]: catalogOf("a", "b"),
        [join(SOURCE, "plugins/a/x.md")]: "",
        [join(SOURCE, "plugins/b/x.md")]: "",
      },
      new RecordingSink(3)
    );

    const result = await run();

    expect(result.totalFiles).toBe(3 + 3 + 2);
    expect(result.plugins.map((p) => [p.name, p.filesWritten])).toEqual([
      ["a", 3],
      ["b", 3],
    ]);
    expect(result.outDir).toBe(OUT);
  });

  it("hands the sink absolute source and output directories", async () => {
    const { build, sink } = buildOver({
      [join(resolve("rel-source"), ".claude-plugin/marketplace.json")]: catalogOf(),
    });

    await build.execute({ sourceDir: "rel-source", outDir: "rel-out", target: TOOL.copilot });

    expect(sink.targets[0]).toMatchObject({
      sourceDir: resolve("rel-source"),
      outDir: resolve("rel-out"),
      mode: "marketplace",
    });
  });

  it("refuses an output directory inside the source and writes nothing", async () => {
    const { build, sink } = buildOver({ [CATALOG]: catalogOf() });

    await expect(
      build.execute({ sourceDir: SOURCE, outDir: join(SOURCE, "dist"), target: TOOL.copilot })
    ).rejects.toBeInstanceOf(InvalidBuildPathsError);
    expect(sink.calls).toEqual([]);
  });

  it.each([
    ["no catalog", {}, "cannot read"],
    ["malformed JSON", { [CATALOG]: "{" }, "malformed JSON"],
    ["a catalog that is no object", { [CATALOG]: "[]" }, "root must be an object"],
    ["a catalog without plugins", { [CATALOG]: "{}" }, "missing 'plugins' array"],
    ["a plugin without a name", { [CATALOG]: '{"plugins":[{}]}' }, "'name' string"],
  ])("refuses %s", async (_label, files, detail) => {
    const { run, sink } = buildOver(files);

    const refused = run();

    await expect(refused).rejects.toBeInstanceOf(InvalidSourceMarketplaceError);
    await expect(refused).rejects.toThrow(detail);
    expect(sink.calls).toEqual([]);
  });

  it("refuses a plugin the catalog lists and the source lacks", async () => {
    const { run } = buildOver({ [CATALOG]: catalogOf("ghost") });

    await expect(run()).rejects.toThrow(/plugin 'ghost' not found/);
  });

  it("warns about the sections it leaves out and reports them", async () => {
    const { run, logger } = buildOver({
      [CATALOG]: catalogOf("a"),
      [join(SOURCE, "plugins/a/commands/c.md")]: "",
      [join(SOURCE, "plugins/a/rules/r.md")]: "",
    });

    const result = await run();

    expect(result.plugins[0]?.skippedSections).toEqual(["commands", "rules"]);
    expect(logger.warnMessages).toEqual([
      "Skipping commands/ in plugin 'a' (out of scope for MVP1).",
      "Skipping rules/ in plugin 'a' (out of scope for MVP1).",
    ]);
  });
});
