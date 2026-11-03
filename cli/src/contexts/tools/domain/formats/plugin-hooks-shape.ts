/**
 * The hooks source a plugin ships: matcher groups of commands keyed by event name. Each tool's
 * own hooks format reads it, so the shape lives here and the formats live in their profiles.
 */

export type PluginHookItem = { type?: string; command?: string; [key: string]: unknown };
export type PluginMatcherGroup = { matcher?: string; hooks: PluginHookItem[] };
export type PluginHooksShape = { hooks?: Record<string, PluginMatcherGroup[]> };
