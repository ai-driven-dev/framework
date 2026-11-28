import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import type { PluginListLayout } from "../contract/native-registration-spec.js";
import { refOnHostName } from "../domain/record/host-ref.js";

/** One plugin a host's list names; `scope` only where the host has scopes. */
export interface ListedPlugin {
  readonly ref: string;
  readonly enabled: boolean;
  readonly scope?: string;
}

/** Reads a host's `plugin list --json`; throws on a shape it does not know. */
type PluginListParser = (output: string) => readonly ListedPlugin[];

function rowsOf(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("unexpected plugin list JSON shape");
  return value.map((row) => {
    const object = asPlainObject(row);
    if (object === null) throw new Error("unexpected plugin list JSON row");
    return object;
  });
}

function textOf(value: unknown): string {
  if (typeof value !== "string" || value === "")
    throw new Error("unexpected plugin list JSON field");
  return value;
}

/** `[{ id, scope, enabled }]`. */
const parseIdScopeRows: PluginListParser = (output) =>
  rowsOf(JSON.parse(output)).map((row) => ({
    ref: textOf(row.id),
    enabled: row.enabled === true,
    scope: textOf(row.scope),
  }));

/** `{ installed: [{ pluginId, enabled }] }`. */
const parseInstalledPluginIds: PluginListParser = (output) =>
  rowsOf(asPlainObject(JSON.parse(output))?.installed).map((row) => ({
    ref: textOf(row.pluginId),
    enabled: row.enabled === true,
  }));

/** `[{ name, marketplace, enabled }]`; a built-in plugin's empty marketplace names no ref. */
const parseNameMarketplaceRows: PluginListParser = (output) =>
  rowsOf(JSON.parse(output)).flatMap((row) =>
    row.marketplace === ""
      ? []
      : [
          {
            ref: refOnHostName(textOf(row.name), textOf(row.marketplace)),
            enabled: row.enabled === true,
          },
        ]
  );

export const PLUGIN_LIST_PARSERS = {
  "id-scope-rows": parseIdScopeRows,
  "installed-plugin-ids": parseInstalledPluginIds,
  "name-marketplace-rows": parseNameMarketplaceRows,
} satisfies Record<PluginListLayout, PluginListParser>;
