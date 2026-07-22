import { dirname, join, relative } from "node:path";
import { InvalidPluginNameError, PluginTargetExistsError } from "../../../domain/errors.js";
import { appendPluginToMarketplace } from "../../../domain/formats/marketplace-json.js";
import { PLUGIN_NAME_REGEX } from "../../../domain/models/plugin.js";
import type { PluginComponentKind } from "../../../domain/models/plugin-component-kind.js";
import { buildScaffold } from "../../../domain/models/plugin-scaffold.js";
import type { AssetProvider } from "../../../domain/ports/asset-provider.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { JsonSchemaValidator } from "../../../domain/ports/json-schema-validator.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { Prompter } from "../../../domain/ports/prompter.js";

export interface PluginCreateInput {
  name: string;
  kind: PluginComponentKind | undefined;
  outputDir: string;
  force: boolean;
  yes: boolean;
  interactive: boolean;
  projectRoot: string;
}

export interface PluginCreateResult {
  pluginDir: string;
  filesWritten: number;
  marketplaceUpdated: boolean;
}

const PLUGIN_VERSION = "0.1.0";

export class PluginCreateUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly prompter: Prompter,
    private readonly jsonSchemaValidator: JsonSchemaValidator,
    private readonly assetProvider: AssetProvider,
    private readonly logger: Logger
  ) {}

  async execute(input: PluginCreateInput): Promise<PluginCreateResult> {
    if (!PLUGIN_NAME_REGEX.test(input.name)) throw new InvalidPluginNameError(input.name);
    const kind = await this.resolveKind(input);
    const description = `${input.name} plugin scaffold`;
    const pluginDir = join(input.outputDir, input.name);
    const scaffold = await this.buildAndValidateScaffold(input.name, kind, description);
    await this.ensureWritableTarget(pluginDir, input.force);
    const filesWritten = await this.writeScaffoldFiles(scaffold, pluginDir);
    const marketplaceUpdated = await this.maybeAppendMarketplaceEntry(
      input,
      pluginDir,
      description
    );
    return { pluginDir, filesWritten, marketplaceUpdated };
  }

  private async resolveKind(input: PluginCreateInput): Promise<PluginComponentKind> {
    if (input.kind !== undefined) return input.kind;
    if (!input.interactive || input.yes) return "full";
    return this.prompter.select("Plugin type:", [
      { name: "full", value: "full" as PluginComponentKind },
      { name: "skills", value: "skills" as PluginComponentKind },
      { name: "agents", value: "agents" as PluginComponentKind },
      { name: "hooks", value: "hooks" as PluginComponentKind },
      { name: "mcp", value: "mcp" as PluginComponentKind },
    ]);
  }

  private async buildAndValidateScaffold(
    name: string,
    kind: PluginComponentKind,
    description: string
  ): Promise<ReadonlyMap<string, string>> {
    const scaffold = buildScaffold({ name, kind, version: PLUGIN_VERSION, description });
    const manifestStr = scaffold.get(".claude-plugin/plugin.json");
    const schema = this.assetProvider.loadSchema("plugin-manifest");
    this.jsonSchemaValidator.validate(schema, JSON.parse(manifestStr ?? "{}"));
    return scaffold;
  }

  private async ensureWritableTarget(pluginDir: string, force: boolean): Promise<void> {
    const exists = await this.fs.fileExists(pluginDir);
    if (!exists) return;
    if (!force) throw new PluginTargetExistsError(pluginDir);
    this.logger.info(`Overwriting existing directory ${pluginDir}.`);
    await this.fs.deleteDirectory(pluginDir);
  }

  private async writeScaffoldFiles(
    scaffold: ReadonlyMap<string, string>,
    pluginDir: string
  ): Promise<number> {
    for (const [relPath, content] of scaffold) {
      await this.fs.writeFile(join(pluginDir, relPath), content);
    }
    return scaffold.size;
  }

  private async maybeAppendMarketplaceEntry(
    input: PluginCreateInput,
    pluginDir: string,
    description: string
  ): Promise<boolean> {
    const marketplacePath = join(input.projectRoot, ".claude-plugin", "marketplace.json");
    if (!(await this.fs.fileExists(marketplacePath))) return false;
    if (!input.interactive || input.yes) return false;
    const confirmed = await this.prompter.confirm("Add to local marketplace.json?", true);
    if (!confirmed) return false;
    return this.appendToMarketplace(marketplacePath, input.name, pluginDir, description);
  }

  private async appendToMarketplace(
    marketplacePath: string,
    name: string,
    pluginDir: string,
    description: string
  ): Promise<boolean> {
    const content = await this.fs.readFile(marketplacePath);
    const rel = relative(dirname(marketplacePath), pluginDir);
    const source = rel.startsWith(".") ? rel : `./${rel}`;
    const entry = {
      name,
      version: PLUGIN_VERSION,
      source,
      description,
      recommended: false,
      strict: true,
    };
    const updated = appendPluginToMarketplace(content, entry);
    await this.fs.writeFile(marketplacePath, updated);
    return true;
  }
}
