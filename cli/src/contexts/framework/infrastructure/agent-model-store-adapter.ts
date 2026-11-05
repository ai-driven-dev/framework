import { join } from "node:path";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
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

  loadMainModels(): Promise<MainModels> {
    return this.read(join(this.userConfigDir(), "main-model.json"));
  }

  saveMainModels(models: MainModels): Promise<void> {
    return this.write(join(this.userConfigDir(), "main-model.json"), models);
  }

  private async read<T extends object>(path: string): Promise<T> {
    if (!(await this.fs.fileExists(path))) return {} as T;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await this.fs.readFile(path));
    } catch (error) {
      throw new Error(`${path} is not valid JSON: ${(error as Error).message}`);
    }
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
