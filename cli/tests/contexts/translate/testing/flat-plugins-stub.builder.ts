import type {
  FlatLayout,
  FlatPluginAnswers,
  HooksAcceptance,
} from "../../../../src/contexts/tools/contract/tool-profile.js";
import { flatHooksPathWithLoaderEntry } from "../../../../src/shared/domain/materialization/flat-paths.js";
import { pluginDeliveryAccepting } from "./plugin-delivery-stub.builder.js";

export interface FlatPluginsStub {
  readonly namespacePrefix?: string;
  readonly hooks?: HooksAcceptance;
  readonly layout?: Partial<FlatLayout>;
}

/** A tool injecting a plugin into the project tree, placing no hook unless its layout names a
 * directory for them. */
export function flatPluginsStub(stub: FlatPluginsStub = {}): FlatPluginAnswers {
  const { namespacePrefix = "fake-", hooks = { accepts: false, reason: "synthetic" } } = stub;
  const layout: FlatLayout = {
    skillLayout: "nested",
    namespacePrefix,
    hooksDir: null,
    hooksLoaderEntry: null,
    hooksBridge: null,
    ...stub.layout,
  };
  return {
    ...pluginDeliveryAccepting(hooks),
    kind: "flat",
    flatLayout: () => layout,
    hooksInstallPath: (pluginName, hooksRelativePath) =>
      layout.hooksDir === null
        ? null
        : flatHooksPathWithLoaderEntry(
            layout.hooksDir,
            layout.hooksLoaderEntry,
            pluginName,
            hooksRelativePath
          ),
    hookScript: (_pluginPath, content) => content,
  };
}
