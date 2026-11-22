import { resolve } from "node:path";
import type { BuildNativeTree } from "../../../../src/contexts/translate/application/build-native-tree.use-case.js";
import { JsonSchemaValidationError } from "../../../../src/contexts/translate/domain/translate.error.js";
import type { JsonSchemaValidator } from "../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { AssetProvider } from "../../../../src/shared/ports/asset-provider.js";
import { buildContractOf } from "../../../shared/testing/build-contract-of.builder.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import { buildTree } from "./build-tree.builder.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");
export const SOURCE_DIR = FIXTURE_DIR;
// resolve(), not the bare literal: on Windows a leading "/" is drive-relative, so
// production's own resolve(outDir) would key the tree differently from this constant.
export const OUT_DIR = resolve("/tmp/aidd-build-test-out");

const MINIMAL_MANIFEST_SCHEMA = {
  type: "object",
  required: ["name"],
  properties: { name: { type: "string" } },
};

const MINIMAL_MARKETPLACE_SCHEMA = {
  type: "object",
  required: ["name", "metadata", "owner", "plugins"],
  properties: {
    name: { type: "string" },
    metadata: { type: "object" },
    owner: { type: "object" },
    plugins: { type: "array" },
  },
};

export function makeValidator(fail = false): JsonSchemaValidator {
  return {
    validate(_schema: object, _data: unknown): void {
      if (fail) throw new JsonSchemaValidationError(["schema validation failed"]);
    },
  };
}

export function makeAssetProvider(
  manifestSchema: object = MINIMAL_MANIFEST_SCHEMA,
  marketplaceSchema: object = MINIMAL_MARKETPLACE_SCHEMA
): AssetProvider {
  return {
    loadConfigAsset: () => {
      throw new Error("not used");
    },
    loadSchema: (name) => {
      if (name === "plugin-manifest") return manifestSchema;
      if (name === "marketplace") return marketplaceSchema;
      return {};
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
    "marketplace"
  );
}
