import type { Settings } from "../models/settings.js";

export interface SettingsRepository {
  load(): Promise<Settings>;
}
