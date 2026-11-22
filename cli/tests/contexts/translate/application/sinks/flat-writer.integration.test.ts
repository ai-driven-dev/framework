import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { BuildNativeTree } from "../../../../../src/contexts/translate/application/build-native-tree.use-case.js";
import {
  FlatTargetExistsError,
  JsonSchemaValidationError,
  OutDirNotDirectoryError,
} from "../../../../../src/contexts/translate/domain/translate.error.js";
import type { JsonSchemaValidator } from "../../../../../src/contexts/translate/ports/json-schema-validator.js";
import { buildContractOf } from "../../../../shared/testing/build-contract-of.builder.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildTree } from "../../testing/build-tree.builder.js";
import { aDiskSink } from "../../testing/disk-sink.builder.js";
import { makeAssetProvider, makeValidator } from "../../testing/flat-writer-world.builder.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");
// resolve(): on Windows a leading "/" gets the current drive, as production's resolve(outDir) does.
const ABS_OUT = resolve("/tmp/aidd-flat-test");
const PLUGIN = "aidd-test";

async function makeSeededFs(): Promise<InMemoryFileAdapter> {
  const memFs = new InMemoryFileAdapter();
  await seedFromDirectory(memFs, FIXTURE_DIR, { useAbsolutePaths: true });
  memFs.setFile(`${ABS_OUT}/.keep`, "");
  return memFs;
}

function makeUseCase(
  memFs: InMemoryFileAdapter,
  force = false,
  validator?: JsonSchemaValidator
): BuildNativeTree {
  const v = validator ?? makeValidator();
  const ap = makeAssetProvider();
  return buildTree(
    memFs,
    v,
    ap,
    new CapturingLogger(),
    buildContractOf(registeredTools(), TOOL.copilot, "flat"),
    "flat",
    force
  );
}

describe("FlatOutputStrategy integration", () => {
  let memFs: InMemoryFileAdapter;

  beforeEach(async () => {
    memFs = await makeSeededFs();
  });

  describe("collision detection without --force", () => {
    it("halts with FlatTargetExistsError when agent file already exists", async () => {
      const useCase1 = makeUseCase(memFs, false);
      await useCase1.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.copilot });

      const useCase2 = makeUseCase(memFs, false);
      await expect(
        useCase2.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.copilot })
      ).rejects.toBeInstanceOf(FlatTargetExistsError);
    });
  });

  describe("safety guards", () => {
    it("throws OutDirNotDirectoryError when outDir does not exist", async () => {
      const emptyFs = new InMemoryFileAdapter();
      await seedFromDirectory(emptyFs, FIXTURE_DIR, { useAbsolutePaths: true });
      const v = makeValidator();
      const ap = makeAssetProvider();
      const useCase = buildTree(
        emptyFs,
        v,
        ap,
        new CapturingLogger(),
        buildContractOf(registeredTools(), TOOL.copilot, "flat"),
        "flat"
      );
      await expect(
        useCase.execute({ sourceDir: FIXTURE_DIR, outDir: "/nonexistent", target: TOOL.copilot })
      ).rejects.toBeInstanceOf(OutDirNotDirectoryError);
    });

    it("throws OutDirNotDirectoryError when outDir is a file, not a directory", async () => {
      const fileFs = new InMemoryFileAdapter();
      await seedFromDirectory(fileFs, FIXTURE_DIR, { useAbsolutePaths: true });
      fileFs.setFile(ABS_OUT, "I am a file, not a directory");
      const v2 = makeValidator();
      const ap2 = makeAssetProvider();
      const useCase = buildTree(
        fileFs,
        v2,
        ap2,
        new CapturingLogger(),
        buildContractOf(registeredTools(), TOOL.copilot, "flat"),
        "flat"
      );
      await expect(
        useCase.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.copilot })
      ).rejects.toBeInstanceOf(OutDirNotDirectoryError);
    });
  });

  describe("invalid manifest", () => {
    it("throws JsonSchemaValidationError for invalid plugin.json (orchestrator-side)", async () => {
      const useCase = makeUseCase(memFs, false, makeValidator(true));
      await expect(
        useCase.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.copilot })
      ).rejects.toBeInstanceOf(JsonSchemaValidationError);
    });
  });

  describe("MCP key collision detection", () => {
    it("throws FlatTargetExistsError when two writeMcp calls produce the same prefixed key", async () => {
      const pluginSrc = `${FIXTURE_DIR}/plugins/${PLUGIN}`;
      const mcpOnly = new InMemoryFileAdapter({
        [`${pluginSrc}/.claude-plugin/plugin.json`]: "{}",
        [`${pluginSrc}/.mcp.json`]: memFs.getFile(`${pluginSrc}/.mcp.json`) ?? "",
      });
      const sink = aDiskSink(mcpOnly, makeValidator(), makeAssetProvider(), new CapturingLogger());
      const target = {
        contract: buildContractOf(registeredTools(), TOOL.copilot, "flat"),
        mode: "flat",
        force: false,
        sourceDir: FIXTURE_DIR,
        outDir: ABS_OUT,
      } as const;
      await sink.writePlugin(target, PLUGIN, pluginSrc);
      await expect(sink.writePlugin(target, PLUGIN, pluginSrc)).rejects.toBeInstanceOf(
        FlatTargetExistsError
      );
    });
  });

  describe("AC #11: unsupported hooks warn-and-skip", () => {
    it("warns and skips hooks for a hooks-bearing plugin when hooks is unsupported", async () => {
      const captLogger = new CapturingLogger();
      // No shipped flat contract declares hooks unsupported any more, so this exercises
      // writeHooks's own unsupported branch on a contract built for that case.
      const base = buildContractOf(registeredTools(), TOOL.opencode, "flat");
      const useCase = buildTree(
        memFs,
        makeValidator(),
        makeAssetProvider(),
        captLogger,
        { ...base, artifacts: { ...base.artifacts, hooks: { supported: false } } },
        "flat"
      );
      memFs.setFile(`${FIXTURE_DIR}/plugins/${PLUGIN}/hooks/hooks.json`, '{"hooks":{}}');
      await useCase.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.opencode });
      expect(captLogger.warnMessages.some((m) => m.includes("hooks"))).toBe(true);
      const hooksFiles = memFs
        .listAll()
        .filter((p) => p.startsWith(ABS_OUT) && p.includes("hooks"));
      expect(hooksFiles).toHaveLength(0);
    });
  });
});
