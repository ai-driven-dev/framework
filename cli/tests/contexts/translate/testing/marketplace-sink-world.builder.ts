import { resolve } from "node:path";
import type {
  ArtifactContract,
  SourceMarketplaceRef,
  ToolBuildContract,
} from "../../../../src/contexts/tools/contract/build-contract.js";
import type { JsonSchemaValidator } from "../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { AssetProvider } from "../../../../src/shared/ports/asset-provider.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import type { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskSink } from "./disk-sink.builder.js";

export const PLUGIN = "aidd-test";
// resolve(): on Windows a leading "/" is drive-relative. Posix after: the adapter keys writes so.
export const OUT_DIR = resolve("/tmp/aidd-marketplace-stub-out").replaceAll("\\", "/");
export const PLUGIN_SRC = "/src/plugins/aidd-test";
export const PLUGIN_OUT = `${OUT_DIR}/plugins/${PLUGIN}`;
// Avoid biome noTemplateCurlyInString: split literal for the placeholder.
export const CLAUDE_ROOT_TOKEN = "$" + "{CLAUDE_PLUGIN_ROOT}";
export const STUB_ROOT_TOKEN = "$" + "{STUB_PLUGIN_ROOT}";

const passingValidator: JsonSchemaValidator = {
  validate(_schema: object, _data: unknown): void {},
};

export function assetProviderNaming(loaded: string[]): AssetProvider {
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

export function supportedArtifact(
  path: (plugin: string, relPath: string) => string,
  extra: Partial<Extract<ArtifactContract, { supported: true }>> = {}
): ArtifactContract {
  return { supported: true, source: { kind: "fullTree", srcDir: "." }, path, ...extra };
}

export function stubContract(over: Partial<ToolBuildContract> = {}): ToolBuildContract {
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
export function sinkFor(
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
      return sink.writePlugin(target, PLUGIN, PLUGIN_SRC).then((written) => written.files);
    },
    finish: (source: SourceMarketplaceRef, built: { name: string }[]) =>
      sink.finish(target, source, built),
  };
}

export function writtenUnder(
  fs: InMemoryFileAdapter,
  dir: string
): Record<string, string | undefined> {
  return Object.fromEntries(fs.listUnder(dir).map((path) => [path, fs.getFile(path)]));
}
