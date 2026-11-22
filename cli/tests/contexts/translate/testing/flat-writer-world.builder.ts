import { resolve } from "node:path";
import { agentsIn, skillsIn } from "../../../../src/contexts/tools/contract/artifact-path.js";
import type {
  ArtifactContract,
  ArtifactPlacement,
  ToolBuildContract,
} from "../../../../src/contexts/tools/contract/build-contract.js";
import { JsonSchemaValidationError } from "../../../../src/contexts/translate/domain/translate.error.js";
import type { JsonSchemaValidator } from "../../../../src/contexts/translate/ports/json-schema-validator.js";
import { flatArtifactLayout } from "../../../../src/shared/domain/materialization/flat-paths.js";
import type { AssetProvider } from "../../../../src/shared/ports/asset-provider.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import type { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskSink } from "./disk-sink.builder.js";

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

export function makeAssetProvider(): AssetProvider {
  return {
    loadConfigAsset: (_toolId, fileName) => {
      if (fileName === "opencode-events.js") {
        return "export async function setupOpencodeEvents() {}";
      }
      if (fileName === "opencode.json") {
        return {
          $schema: "https://opencode.ai/config.json",
          instructions: [".opencode/rules/**/*.md"],
        };
      }
      throw new Error("not used");
    },
    loadSchema: (name) => {
      if (name === "plugin-manifest") return MINIMAL_MANIFEST_SCHEMA;
      if (name === "marketplace") return MINIMAL_MARKETPLACE_SCHEMA;
      return {};
    },
  };
}

/** A layout stated in the test itself: the shipped contracts cover no artifact that declares
 * no transform, no extension and no merge, and those are the branches a flat build turns on. */
// Posix on every platform: the adapter keys writes that way and expectations concatenate on it.
export const STUB_OUT = resolve("/tmp/aidd-flat-stub-test").replaceAll("\\", "/");
export const STUB_PLUGIN_SRC = "/src/plugins/aidd-test";
export const STUB_LAYOUT = flatArtifactLayout(".stub/", {
  skills: "nested",
  agent: { ext: ".md" },
});
export const STUB_HOOKS = { kind: "hooks", scriptsDir: ".stub/hooks/" } as const;

export function supportedArtifact(
  placement: ArtifactPlacement,
  extra: Partial<Extract<ArtifactContract, { supported: true }>> = {}
): ArtifactContract {
  return {
    supported: true,
    source: { kind: "fullTree", srcDir: "." },
    placement,
    ...extra,
  };
}

export function stubContract(over: Partial<ToolBuildContract> = {}): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      agents: supportedArtifact(agentsIn(STUB_LAYOUT)),
      skills: supportedArtifact(skillsIn(STUB_LAYOUT)),
      hooks: supportedArtifact(STUB_HOOKS),
      mcp: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    ...over,
  };
}

export function stubSink(memFs: InMemoryFileAdapter, logger?: CapturingLogger) {
  return aDiskSink(memFs, makeValidator(), makeAssetProvider(), logger ?? new CapturingLogger());
}

export function stubTarget(contract: ToolBuildContract, force = false) {
  return { contract, mode: "flat", force, sourceDir: "/src", outDir: STUB_OUT } as const;
}

/** Builds the stub plugin whole: the source holds one artifact kind, so the count is that kind's. */
export async function stubWrite(
  memFs: InMemoryFileAdapter,
  contract: ToolBuildContract,
  logger?: CapturingLogger,
  force = false
): Promise<number> {
  if (!memFs.has(`${STUB_PLUGIN_SRC}/.claude-plugin/plugin.json`)) {
    memFs.setFile(`${STUB_PLUGIN_SRC}/.claude-plugin/plugin.json`, "{}");
  }
  const { files } = await stubSink(memFs, logger).writePlugin(
    stubTarget(contract, force),
    "aidd-test",
    STUB_PLUGIN_SRC
  );
  return files;
}

export function writtenUnder(
  memFs: InMemoryFileAdapter,
  dir: string
): Record<string, string | undefined> {
  return Object.fromEntries(memFs.listUnder(dir).map((path) => [path, memFs.getFile(path)]));
}
