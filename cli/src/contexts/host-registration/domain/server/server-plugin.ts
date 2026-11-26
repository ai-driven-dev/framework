import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";

import type { NativeRefusal } from "../native-refusal.js";

/** What installing a plugin came to: the plugin the host now holds, or why it refused. A refusal
 * is returned, never thrown, so one plugin the host will not take does not stop the others. */
export type ServerInstallation =
  | { readonly plugin: ServerPlugin }
  | { readonly refusal: NativeRefusal };

/** A plugin a host's own server holds: its id, the directory it was installed from and whether
 * the host loaded it without error. */
export interface ServerPlugin {
  readonly id: string;
  readonly originalSource: string;
  readonly healthy: boolean;
}

/** One plugin as the server describes it. Limit: a plugin without an id or a source is read as
 * one with empty ones, since the server has never been seen to answer such. */
export function serverPluginOf(data: unknown): ServerPlugin {
  const plugin = asPlainObject(data) ?? {};
  return {
    id: typeof plugin.id === "string" ? plugin.id : "",
    originalSource: typeof plugin.originalSource === "string" ? plugin.originalSource : "",
    healthy: plugin.state === "ok" && plugin.hasErrors !== true,
  };
}
