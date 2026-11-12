import {
  CONFIG_VSCODE_EXTENSIONS,
  CONFIG_VSCODE_KEYBINDINGS,
  CONFIG_VSCODE_SETTINGS,
} from "../../../contract/config-refs.js";
import { defineIdeTool } from "../../profile/define-tool.js";
import { ConfigSection } from "../../sections/config-section.js";

const DIRECTORY = ".vscode/";

export const vscode = defineIdeTool({
  toolId: "vscode",
  directory: DIRECTORY,
  signalDir: null,
  capabilities: () => ({
    config: [
      new ConfigSection({
        outputPath: ".vscode/extensions.json",
        mergeStrategy: "user-prime",
        consumes: [CONFIG_VSCODE_EXTENSIONS],
      }),
      new ConfigSection({
        outputPath: ".vscode/keybindings.json",
        mergeStrategy: "none",
        consumes: [CONFIG_VSCODE_KEYBINDINGS],
      }),
      new ConfigSection({
        outputPath: ".vscode/settings.json",
        mergeStrategy: "user-prime",
        consumes: [CONFIG_VSCODE_SETTINGS],
      }),
    ],
  }),
});
