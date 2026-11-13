import { resolvePluginsCapability, type ToolConfig } from "../../../../tools/domain/registry.js";
import type { PluginTranslator } from "./plugin-translator.js";
import { resolveTranslator, type TranslatorDeps } from "./plugin-translator-factory.js";

/** `null` when the tool is not an AI tool, or has no plugins capability. */
export function resolvePluginTranslator(
  toolConfig: ToolConfig,
  deps: TranslatorDeps
): PluginTranslator | null {
  const plugins = resolvePluginsCapability(toolConfig.toolId);
  return plugins === null ? null : resolveTranslator(plugins, deps);
}
