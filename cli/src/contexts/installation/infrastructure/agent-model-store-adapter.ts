import { join } from "node:path";
import { errorMessage } from "../../../shared/domain/describe-error.js";
import { tryParseJson } from "../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { AgentModelStore, AgentProviders, MainModels } from "../ports/agent-model-store.js";

/** The providers and the main models written, as two JSON files in aidd's user configuration
 * directory. A missing file reads as empty; an empty one is deleted rather than written. */
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
    const json = tryParseJson(await this.fs.readFile(path));
    if (!json.ok) throw new Error(`${path} is not valid JSON: ${errorMessage(json.error)}`);
    const parsed = json.value;
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
