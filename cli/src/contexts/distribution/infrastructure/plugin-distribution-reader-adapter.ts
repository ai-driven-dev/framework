import { join } from "node:path";
import {
  type PluginComponentFile,
  type PluginComponents,
  PluginDistribution,
  type PluginManifestFields,
} from "../../../shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../shared/domain/plugin/plugin-name.js";
import { isSemver } from "../../../shared/domain/plugin/semver.js";
import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import {
  InvalidPluginManifestError,
  InvalidPluginVersionError,
} from "../../../shared/domain/shared.error.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { PluginDistributionReader } from "../ports/plugin-distribution-reader.js";

const README_FILENAME = "README.md";

/** Where a plugin manifest can sit, and the tool whose layout that is. */
export interface ManifestProbe {
  readonly format: AiToolId;
  readonly relativePath: string;
}

export class PluginDistributionReaderAdapter implements PluginDistributionReader {
  /** `manifestProbes` is the ordered list of places a manifest can sit, deepest first, built
   * once by the composition from the registered profiles. */
  constructor(
    private readonly fs: FileReader,
    private readonly manifestProbes: readonly ManifestProbe[]
  ) {}

  async read(pluginRoot: string): Promise<PluginDistribution> {
    const { format, manifestPath, manifestRelativePath } = await this.probeManifest(pluginRoot);
    const manifest = await this.readManifest(manifestPath);
    const files = await this.collectFiles(pluginRoot, manifestPath, manifestRelativePath);
    const components = categorize(files);
    return new PluginDistribution({ manifest, format, files, components });
  }

  private async probeManifest(
    pluginRoot: string
  ): Promise<{ format: AiToolId; manifestPath: string; manifestRelativePath: string }> {
    for (const probe of this.manifestProbes) {
      const fullPath = join(pluginRoot, probe.relativePath);
      if (await this.fs.fileExists(fullPath)) {
        return {
          format: probe.format,
          manifestPath: fullPath,
          manifestRelativePath: probe.relativePath,
        };
      }
    }
    throw new InvalidPluginManifestError(`no plugin.json found in "${pluginRoot}"`);
  }

  private async readManifest(manifestPath: string): Promise<PluginManifestFields> {
    let raw: unknown;
    try {
      raw = JSON.parse(await this.fs.readFile(manifestPath));
    } catch {
      throw new InvalidPluginManifestError("plugin.json is not valid JSON");
    }
    return validateManifest(raw);
  }

  private async collectFiles(
    pluginRoot: string,
    manifestPath: string,
    manifestRelativePath: string
  ): Promise<PluginComponentFile[]> {
    const allPaths = await this.fs.listDirectory(pluginRoot);
    const files: PluginComponentFile[] = [];
    for (const rawPath of allPaths) {
      const relativePath = toPosix(rawPath);
      if (relativePath === README_FILENAME) continue;
      if (!isComponentFile(relativePath)) continue;
      const content = await this.fs.readFile(join(pluginRoot, rawPath));
      files.push({ relativePath, content });
    }
    const manifestContent = await this.fs.readFile(manifestPath);
    files.push({ relativePath: manifestRelativePath, content: manifestContent });
    return files;
  }
}

function toPosix(p: string): string {
  return p.split("\\").join("/");
}

/** The component group each top-level plugin directory feeds. */
const DIRECTORY_GROUPS = new Map<string, keyof PluginComponents>([
  ["skills", "skills"],
  ["commands", "commands"],
  ["agents", "agents"],
  ["rules", "rules"],
  ["hooks", "hooks"],
]);

function groupOf(relativePath: string): keyof PluginComponents | undefined {
  if (relativePath === ".mcp.json") return "mcp";
  return DIRECTORY_GROUPS.get(relativePath.split("/")[0] ?? "");
}

function isComponentFile(relativePath: string): boolean {
  return groupOf(relativePath) !== undefined;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidPluginManifestError(`"${field}" must be a non-empty string`);
  }
  return value;
}

function validateManifest(raw: unknown): PluginManifestFields {
  const obj = asPlainObject(raw);
  if (obj === null) {
    throw new InvalidPluginManifestError("plugin.json must be a JSON object");
  }
  const name = parsePluginName(requiredString(obj.name, "name"));
  const version = requiredString(obj.version, "version");
  if (!isSemver(version)) throw new InvalidPluginVersionError(version);

  const result: PluginManifestFields = { name, version };
  if (typeof obj.description === "string") result.description = obj.description;
  const author = authorOf(asPlainObject(obj.author));
  if (author !== undefined) result.author = author;
  return result;
}

function authorOf(raw: Record<string, unknown> | null): PluginManifestFields["author"] {
  if (raw === null || typeof raw.name !== "string") return undefined;
  return typeof raw.email === "string" ? { name: raw.name, email: raw.email } : { name: raw.name };
}

function categorize(files: readonly PluginComponentFile[]): PluginComponents {
  const groups: Record<keyof PluginComponents, PluginComponentFile[]> = {
    skills: [],
    commands: [],
    agents: [],
    rules: [],
    hooks: [],
    mcp: [],
  };
  for (const file of files) {
    const group = groupOf(file.relativePath);
    if (group !== undefined) groups[group].push(file);
  }
  return groups;
}
