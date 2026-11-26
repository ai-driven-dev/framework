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
const OPENCODE_BASE = {
  $schema: "https://opencode.ai/config.json",
  instructions: [".opencode/rules/**/*.md"],
};

async function buildFlat(
  target:
    | typeof TOOL.kilo
    | typeof TOOL.opencode
    | typeof TOOL.kimi
    | typeof TOOL.codex = TOOL.kilo,
  existing: Record<string, string> = {}
) {
  const fs = new InMemoryFileAdapter();
  await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });
  fs.setFile(`${OUT}/.keep`, "");
  for (const [path, content] of Object.entries(existing)) fs.setFile(path, content);
  const logger = new CapturingLogger();
  const assets = {
    loadConfigAsset: (_tool: string, name: string) => {
      if (name === "kilo.json") return KILO_BASE;
      if (name === "opencode.json") return OPENCODE_BASE;
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
  const RULE_OC = `${OUT}/.opencode/rules/aidd-test-01-standards-naming.md`;

  it("writes a path-scoped rule with its scope stated in the body, and does not warn it skipped it", async () => {
    const { fs, logger } = await buildFlat(TOOL.opencode);

    expect(fs.getFile(RULE_OC)?.startsWith("Applies to files matching `src/**/*.ts`.\n\n")).toBe(
      true
    );
    expect(fs.getFile(RULE_OC)).not.toContain("paths:");
    expect(logger.warnMessages.filter((line) => line.includes("rules/"))).toEqual([]);
  });

  it("lists the rules in the config's instructions next to an entry a person listed, comments in their file or not", async () => {
    const { fs } = await buildFlat(TOOL.opencode, {
      [`${OUT}/opencode.jsonc`]: '// mine\n{ "instructions": ["mine.md"] }',
    });
    const config = asPlainObject(JSON.parse(fs.getFile(`${OUT}/opencode.jsonc`) ?? "null"));

    expect(config?.instructions).toEqual(["mine.md", ".opencode/rules/**/*.md"]);
  });
});

describe("a flat build of the rules of a plugin", () => {
  let kilo: Awaited<ReturnType<typeof buildFlat>>;
  beforeAll(async () => {
    kilo = await buildFlat();
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
});

describe.each([
  { tool: TOOL.kimi, directory: ".kimi-code" },
  { tool: TOOL.codex, directory: ".codex" },
])(
  "a flat build of the rules of a plugin for $tool, which reads guidance only from AGENTS.md",
  ({ tool, directory }) => {
    const PERSON = "# Team notes\n";

    it("writes the rule with its scope stated in the body, and lists the plugin's rules in AGENTS.md after the team's text", async () => {
      const { fs, logger } = await buildFlat(tool, { [`${OUT}/AGENTS.md`]: PERSON });

      expect(
        fs
          .getFile(`${OUT}/${directory}/instructions/aidd-test-01-standards-naming.md`)
          ?.startsWith("Applies to files matching `src/**/*.ts`.\n\n")
      ).toBe(true);
      expect(fs.getFile(`${OUT}/AGENTS.md`)).toContain(
        `${PERSON}\n<!-- aidd_plugin_rules:start -->`
      );
      expect(fs.getFile(`${OUT}/AGENTS.md`)).toContain(
        `- \`${directory}/instructions/aidd-test-*.md\``
      );
      expect(logger.warnMessages.filter((line) => line.includes("rules/"))).toEqual([]);
    });
  }
);
