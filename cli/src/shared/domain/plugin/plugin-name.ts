import { InvalidPluginNameError } from "../shared.error.js";

declare const pluginNameBrand: unique symbol;

/** A plugin's name: lowercase words joined by single hyphens, which is also one safe path
 * segment. `parsePluginName` is the only place a written name becomes one. */
export type PluginName = string & { readonly [pluginNameBrand]: true };

const PLUGIN_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isPluginName(value: string): value is PluginName {
  return PLUGIN_NAME.test(value);
}

export function parsePluginName(value: string): PluginName {
  if (!isPluginName(value)) throw new InvalidPluginNameError(value);
  return value;
}
