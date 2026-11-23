import { resolve } from "node:path";
import type { BuildNativeTree } from "../../../../src/contexts/translate/application/build-native-tree.use-case.js";
import { JsonSchemaValidationError } from "../../../../src/contexts/translate/contract/translate.error.js";
import type { JsonSchemaValidator } from "../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { AssetProvider } from "../../../../src/shared/ports/asset-provider.js";
import { buildContractOf } from "../../../shared/testing/build-contract-of.builder.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import { buildTree } from "./build-tree.builder.js";
import { minimalSchemas } from "./schema-provider.builder.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");
export const SOURCE_DIR = FIXTURE_DIR;
// resolve(), not the bare literal: on Windows a leading "/" is drive-relative, so
// production's own resolve(outDir) would key the tree differently from this constant.
export const OUT_DIR = resolve("/tmp/aidd-build-test-out");

export function makeValidator(fail = false): JsonSchemaValidator {
  return {
    validate(_schema: object, _data: unknown): void {
      if (fail) throw new JsonSchemaValidationError(["schema validation failed"]);
    },
  };
}

export function makeAssetProvider(): AssetProvider {
  return {
    loadConfigAsset: () => {
      throw new Error("not used");
    },
  };
}

export async function makeSeededFs(): Promise<InMemoryFileAdapter> {
  const fs = new InMemoryFileAdapter();
  await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });
  return fs;
}

export function makeUseCase(
  fs: InMemoryFileAdapter,
  validator?: JsonSchemaValidator,
  assetProvider?: AssetProvider
): BuildNativeTree {
  const v = validator ?? makeValidator();
  const ap = assetProvider ?? makeAssetProvider();
  return buildTree(
    fs,
    v,
    ap,
    new CapturingLogger(),
    buildContractOf(registeredTools(), TOOL.copilot, "marketplace"),
    "marketplace",
    false,
    minimalSchemas
  );
}
