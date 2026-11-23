import vscodeExtensions from "../../../assets/configs/vscode/extensions.json" with { type: "json" };
import vscodeKeybindings from "../../../assets/configs/vscode/keybindings.json" with {
  type: "json",
};
import vscodeSettings from "../../../assets/configs/vscode/settings.json" with { type: "json" };
import { CONFIG_PREFIX, type ConfigRef } from "../../contexts/tools/contract/config-refs.js";
import { defineIdeTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { ConfigSection } from "../../contexts/tools/domain/sections/config-section.js";

const DIRECTORY = ".vscode/";
const EXTENSIONS_PATH = ".vscode/extensions.json";
const KEYBINDINGS_PATH = ".vscode/keybindings.json";
const SETTINGS_PATH = ".vscode/settings.json";

const VSCODE_EXTENSIONS_REF: ConfigRef = {
  name: "vscodeExtensions",
  path: `${CONFIG_PREFIX}vscode/extensions.json`,
};
const VSCODE_KEYBINDINGS_REF: ConfigRef = {
  name: "vscodeKeybindings",
  path: `${CONFIG_PREFIX}vscode/keybindings.json`,
};
const VSCODE_SETTINGS_REF: ConfigRef = {
  name: "vscodeSettings",
  path: `${CONFIG_PREFIX}vscode/settings.json`,
};

export const vscode = defineIdeTool({
  toolId: "vscode",
  directory: DIRECTORY,
  signalDir: null,
  recommendedFor: (project) =>
    project !== undefined && (project.isMonorepo || project.stack === "typescript"),
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
