import { join } from "node:path";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
import type { MarketplaceScope } from "../../../kernel/scope.js";
import type {
  AgentModelStore,
  AgentProviders,
  MainModels,
} from "../domain/ports/agent-model-store.js";

export class AgentModelStoreAdapter implements AgentModelStore {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly userConfigDir: () => string
  ) {}

  loadProviders(): Promise<AgentProviders> {
    return this.read(join(this.userConfigDir(), "agent-models.json"));
  }

  saveProviders(providers: AgentProviders): Promise<void> {
    return this.write(join(this.userConfigDir(), "agent-models.json"), providers);
  }

  loadMainModels(scope: MarketplaceScope, projectRoot: string): Promise<MainModels> {
    return this.read(this.mainModelsPath(scope, projectRoot));
  }

  saveMainModels(scope: MarketplaceScope, projectRoot: string, models: MainModels): Promise<void> {
    return this.write(this.mainModelsPath(scope, projectRoot), models);
  }

  private mainModelsPath(scope: MarketplaceScope, projectRoot: string): string {
    const root = scope === "user" ? this.userConfigDir() : join(projectRoot, ".aidd");
    return join(root, "main-model.json");
  }

  private async read<T extends object>(path: string): Promise<T> {
    if (!(await this.fs.fileExists(path))) return {} as T;
    const parsed: unknown = JSON.parse(await this.fs.readFile(path));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${path} must contain a JSON object.`);
    }
    return parsed as T;
  }

  private async write(path: string, value: object): Promise<void> {
    if (Object.keys(value).length > 0) {
      await this.fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
    } else if (await this.fs.fileExists(path)) {
      await this.fs.deleteFile(path);
    }
  }
}
