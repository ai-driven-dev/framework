import { PluginDeliveryBase } from "./plugin-delivery.js";
import type { UnsupportedParams } from "./plugin-params.js";

/** A tool that takes no plugin: it states why its hooks cannot be delivered. */
export class UnsupportedPlugins extends PluginDeliveryBase {
  readonly #unsupportedReason: string;

  constructor(params: UnsupportedParams) {
    super(params.globalFiles ?? null);
    this.#unsupportedReason = params.hooksUnsupportedReason;
  }

  hooksAcceptance(): { accepts: boolean; unsupportedReason: string | null } {
    return { accepts: false, unsupportedReason: this.#unsupportedReason };
  }
}
