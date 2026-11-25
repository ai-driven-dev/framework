import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { asPlainObject } from "../../../../src/shared/domain/reading/plain-object.js";
import { buildContractOf } from "../../../shared/testing/build-contract-of.builder.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import { buildTree } from "../testing/build-tree.builder.js";
import { makeValidator } from "../testing/flat-writer-world.builder.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");
const OUT = resolve("/tmp/aidd-flat-rules-test").replaceAll("\\", "/");
const RULE = `${OUT}/.kilo/rules/aidd-test-01-standards-naming.md`;
const CONFIG = `${OUT}/.kilo/kilo.jsonc`;

const KILO_BASE = { $schema: "https://app.kilo.ai/config.json" };

async function buildKilo(target: typeof TOOL.kilo | typeof TOOL.opencode = TOOL.kilo) {
  const fs = new InMemoryFileAdapter();
  await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });
  fs.setFile(`${OUT}/.keep`, "");
  const logger = new CapturingLogger();
  const assets = {
    loadConfigAsset: (_tool: string, name: string) => {
      if (name === "kilo.json" || name === "opencode.json") return KILO_BASE;
      return "export async function setupOpencodeEvents() {}";
    },
  };
  const build = buildTree(
    fs,
    makeValidator(),
    assets,
    logger,
    buildContractOf(registeredTools(), target, "flat"),
    "flat"
  );
  await build.execute({ sourceDir: FIXTURE_DIR, outDir: OUT, target });
  return { fs, logger };
}

describe("a flat build of the rules of a plugin for OpenCode", () => {
  it("writes the rule in its plugin's folder, as shipped, and does not warn it skipped it", async () => {
    const { fs, logger } = await buildKilo(TOOL.opencode);

    expect(fs.getFile(`${OUT}/.opencode/rules/aidd-test/01-standards/naming.md`)).toContain(
      "paths:"
    );
    expect(logger.warnMessages.filter((line) => line.includes("rules/"))).toEqual([]);
  });
});

describe("a flat build of the rules of a plugin", () => {
  let kilo: Awaited<ReturnType<typeof buildKilo>>;
  beforeAll(async () => {
    kilo = await buildKilo();
  });

  it("writes a path-scoped rule with its scope stated in the body", () => {
    expect(kilo.fs.getFile(RULE)?.startsWith("Applies to files matching `src/**/*.ts`.\n\n")).toBe(
      true
    );
    expect(kilo.fs.getFile(RULE)).not.toContain("paths:");
  });

  it("lists the plugin's rules in the config's instructions", () => {
    const config = asPlainObject(JSON.parse(kilo.fs.getFile(CONFIG) ?? "null"));

    expect(config?.instructions).toEqual([".kilo/rules/aidd-test-*.md"]);
  });

  it("does not warn that it skipped the rules", () => {
    expect(kilo.logger.warnMessages.filter((line) => line.includes("rules/"))).toEqual([]);
  });

  it("still warns, for a tool that carries no rules, that it skipped them", async () => {
    const { logger } = await buildKilo(TOOL.kimi);

    expect(logger.warnMessages).toContain(
      "Skipping rules/ in plugin 'aidd-test' (out of scope for MVP1)."
    );
  });
});
