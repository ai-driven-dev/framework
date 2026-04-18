import {
  CONFIG_VSCODE_EXTENSIONS,
  CONFIG_VSCODE_KEYBINDINGS,
  CONFIG_VSCODE_SETTINGS,
} from "../../models/framework-descriptor.js";
import type { MergeStrategy } from "../../models/merge-strategy.js";
import { type ConfigHandler, type IdeToolConfig, registerTool } from "../../models/tool-config.js";

const DIRECTORY = ".vscode/";

export const vscodeToolConfig: IdeToolConfig = {
  toolId: "vscode",
  directory: DIRECTORY,
  signalDir: null,

  config(): ConfigHandler {
    return {
      outputPath(configName: string): string | null {
        if (configName === CONFIG_VSCODE_EXTENSIONS) return ".vscode/extensions.json";
        if (configName === CONFIG_VSCODE_KEYBINDINGS) return ".vscode/keybindings.json";
        if (configName === CONFIG_VSCODE_SETTINGS) return ".vscode/settings.json";
        return null;
      },
      mergeStrategy(_configName: string): MergeStrategy {
        return "user-prime";
      },
      entrySection(_configName: string): null {
        return null;
      },
    };
  },
};

registerTool(vscodeToolConfig);
