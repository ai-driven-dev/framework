import vscodeExtensions from "../../../../../../assets/configs/vscode/extensions.json" with {
  type: "json",
};
import vscodeKeybindings from "../../../../../../assets/configs/vscode/keybindings.json" with {
  type: "json",
};
import vscodeSettings from "../../../../../../assets/configs/vscode/settings.json" with {
  type: "json",
};
import { defineIdeTool } from "../../profile/define-tool.js";
import { ConfigSection } from "../../sections/config-section.js";
import {
  VSCODE_EXTENSIONS_REF,
  VSCODE_KEYBINDINGS_REF,
  VSCODE_SETTINGS_REF,
} from "./config-refs.js";

const DIRECTORY = ".vscode/";
const EXTENSIONS_PATH = ".vscode/extensions.json";
const KEYBINDINGS_PATH = ".vscode/keybindings.json";
const SETTINGS_PATH = ".vscode/settings.json";

export const vscode = defineIdeTool({
  toolId: "vscode",
  directory: DIRECTORY,
  signalDir: null,
  configAssets: [
    {
      name: "settings.json",
      content: vscodeSettings,
      destination: SETTINGS_PATH,
      delivery: "section",
    },
    {
      name: "keybindings.json",
      content: vscodeKeybindings,
      destination: KEYBINDINGS_PATH,
      delivery: "section",
    },
    {
      name: "extensions.json",
      content: vscodeExtensions,
      destination: EXTENSIONS_PATH,
      delivery: "section",
    },
  ],
  capabilities: () => ({
    config: [
      new ConfigSection({
        outputPath: EXTENSIONS_PATH,
        mergeStrategy: "user-prime",
        consumes: [VSCODE_EXTENSIONS_REF],
      }),
      new ConfigSection({
        outputPath: KEYBINDINGS_PATH,
        mergeStrategy: "none",
        consumes: [VSCODE_KEYBINDINGS_REF],
      }),
      new ConfigSection({
        outputPath: SETTINGS_PATH,
        mergeStrategy: "user-prime",
        consumes: [VSCODE_SETTINGS_REF],
      }),
    ],
  }),
});
