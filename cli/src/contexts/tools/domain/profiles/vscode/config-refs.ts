import { CONFIG_PREFIX, type ConfigRef } from "../../../contract/config-refs.js";

export const VSCODE_EXTENSIONS_REF: ConfigRef = {
  name: "vscodeExtensions",
  path: `${CONFIG_PREFIX}vscode/extensions.json`,
};
export const VSCODE_KEYBINDINGS_REF: ConfigRef = {
  name: "vscodeKeybindings",
  path: `${CONFIG_PREFIX}vscode/keybindings.json`,
};
export const VSCODE_SETTINGS_REF: ConfigRef = {
  name: "vscodeSettings",
  path: `${CONFIG_PREFIX}vscode/settings.json`,
};
