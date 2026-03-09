import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Settings } from "../../domain/models/settings.js";

const SETTINGS_FILENAME = "settings.json";
const AIDD_DIR = ".aidd";

export class SettingsRepositoryAdapter {
  constructor(private readonly projectRoot: string) {}

  private get settingsPath(): string {
    return join(this.projectRoot, AIDD_DIR, SETTINGS_FILENAME);
  }

  async load(): Promise<Settings> {
    let raw: string;
    try {
      raw = await readFile(this.settingsPath, "utf-8");
    } catch {
      return new Settings();
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON in settings file '${this.settingsPath}': ${message}`);
    }

    // Ignore token key for security
    const { token: _ignored, ...safeData } = data;

    return new Settings({
      repo: typeof safeData.repo === "string" ? safeData.repo : undefined,
      docsDir: typeof safeData.docsDir === "string" ? safeData.docsDir : undefined,
      verbose: typeof safeData.verbose === "boolean" ? safeData.verbose : undefined,
    });
  }
}
