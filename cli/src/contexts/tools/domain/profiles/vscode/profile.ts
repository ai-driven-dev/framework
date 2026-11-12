import vscodeExtensions from "../../../../../../assets/configs/vscode/extensions.json" with {
  type: "json",
};
import vscodeKeybindings from "../../../../../../assets/configs/vscode/keybindings.json" with {
  type: "json",
};
import vscodeSettings from "../../../../../../assets/configs/vscode/settings.json" with {
  type: "json",
};
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
  configAssets: {
    "settings.json": vscodeSettings,
    "keybindings.json": vscodeKeybindings,
    "extensions.json": vscodeExtensions,
  },
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
