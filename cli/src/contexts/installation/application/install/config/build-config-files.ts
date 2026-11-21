import { join } from "node:path";
import { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import { isErrnoException } from "../../../../../shared/domain/reading/json-file.js";
import type { AssetProvider } from "../../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { McpConfigAnswers } from "../../../../tools/contract/tool-profile.js";
import type { InstallRuntimeConfigRequest } from "./install-runtime-config.use-case.js";
import type { TrackedConfigFiles } from "./tracked-config-files.use-case.js";

/** What reading a tool's config assets and the project they land in needs. */
export interface ConfigFilesDeps {
  readonly trackedConfigFiles: TrackedConfigFiles;
  readonly fs: FileReader;
  readonly assets: AssetProvider;
}

/** The tool's config files to write: each asset at its resolved path, except a file the user owns. */
export async function buildConfigFiles(
  deps: ConfigFilesDeps,
  tools: ToolCatalog,
  options: InstallRuntimeConfigRequest
): Promise<InstallationFile[]> {
  const profile = tools.aiProfile(options.toolId);
  const mcp = profile.mcpConfig();
  const files: InstallationFile[] = [];
  for (const [fileName, outputPath] of Object.entries(profile.configFiles())) {
    const resolvedPath = await resolveConfigPath(deps.fs, {
      mcp,
      fileName,
      outputPath,
      projectRoot: options.projectRoot,
    });
    const asset = deps.assets.loadConfigAsset(options.toolId, fileName);
    const content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
    const userOwned = await deps.trackedConfigFiles.execute({
      kind: "is-user-owned",
      relativePath: resolvedPath,
      projectRoot: options.projectRoot,
      manifest: options.manifest,
    });
    if (userOwned) continue;
    const framed =
      mcp?.isFrameworkPrimeJson(fileName) === true
        ? mcp.frameworkConfigOver(
            content,
            await readExistingConfig(deps.fs, resolvedPath, options.projectRoot),
            {}
          )
        : content;
    files.push(InstallationFile.hashing(resolvedPath, framed));
  }
  return files;
}

async function resolveConfigPath(
  fs: FileReader,
  config: {
    mcp: McpConfigAnswers | null;
    fileName: string;
    outputPath: string;
    projectRoot: string;
  }
): Promise<string> {
  const { mcp, fileName, outputPath, projectRoot } = config;
  if (mcp === null || !mcp.accepts(fileName)) return outputPath;
  return mcp.resolveOutputPath((relativePath) => fs.fileExists(join(projectRoot, relativePath)));
}

async function readExistingConfig(
  fs: FileReader,
  relativePath: string,
  projectRoot: string
): Promise<string | null> {
  try {
    return await fs.readFile(join(projectRoot, relativePath));
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  }
}
