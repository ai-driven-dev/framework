import { join } from "node:path";
import type { RetentionSettingsSource } from "../../../ports/switch/retention-settings-source.js";
import { readTextIfPresent } from "../../reading/text-file.js";

/** Read only: nothing is ever written into a Claude profile. */
export class ClaudeSettingsAdapter implements RetentionSettingsSource {
  constructor(private readonly claudeConfigDir: string) {}

  async texts(root: string): Promise<readonly (string | null)[]> {
    return Promise.all([
      readTextIfPresent(join(root, ".claude", "settings.local.json")),
      readTextIfPresent(join(root, ".claude", "settings.json")),
      readTextIfPresent(join(this.claudeConfigDir, "settings.json")),
    ]);
  }
}
