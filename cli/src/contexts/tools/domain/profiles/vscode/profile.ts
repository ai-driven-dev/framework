import {
  CONFIG_VSCODE_EXTENSIONS,
  CONFIG_VSCODE_KEYBINDINGS,
  CONFIG_VSCODE_SETTINGS,
} from "../../../contract/config-refs.js";
import { SettingsCapability } from "../../capabilities/settings-capability.js";
import { defineIdeTool } from "../../profile/define-tool.js";

const DIRECTORY = ".vscode/";

export const vscode = defineIdeTool({
  toolId: "vscode",
  directory: DIRECTORY,
  signalDir: null,
  capabilities: () => ({
    settings: [
      new SettingsCapability({
        outputPath: ".vscode/extensions.json",
        mergeStrategy: "user-prime",
        consumes: [CONFIG_VSCODE_EXTENSIONS],
      }),
      new SettingsCapability({
        outputPath: ".vscode/keybindings.json",
        mergeStrategy: "none",
        consumes: [CONFIG_VSCODE_KEYBINDINGS],
      }),
      new SettingsCapability({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "user-prime",
        consumes: [CONFIG_VSCODE_SETTINGS],
      }),
    ],
  }),
});
