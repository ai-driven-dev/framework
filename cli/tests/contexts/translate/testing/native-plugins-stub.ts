import type {
  HooksAcceptance,
  NativePluginAnswers,
} from "../../../../src/contexts/tools/contract/tool-profile.js";
import { pluginDeliveryAccepting } from "./plugin-delivery-stub.js";

export interface NativePluginsStub {
  readonly pluginsDir?: string;
  readonly pluginRootToken?: string;
  readonly manifestPath?: string | null;
  readonly hooksFile?: string;
  readonly hooks?: HooksAcceptance;
  readonly mcp?: { readonly accepts: boolean; readonly relativePath: string };
}

/** A tool installing a plugin below `pluginsDir`, taking its hooks and mcp unless told not to. */
export function nativePluginsStub(stub: NativePluginsStub = {}): NativePluginAnswers {
  const {
    pluginsDir = ".fake/plugins/",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a host expands
    pluginRootToken = "${FAKE_PLUGIN_ROOT}",
    manifestPath = null,
    hooksFile = "hooks/hooks.json",
    hooks = { accepts: true },
    mcp = { accepts: true, relativePath: ".mcp.json" },
  } = stub;
  return {
    ...pluginDeliveryAccepting(hooks),
    kind: "native",
    translatesAsMarketplace: () => false,
    pluginOutputDir: (pluginName) => `${pluginsDir}${pluginName}/`,
    manifestPath: () => manifestPath,
    rootToken: () => pluginRootToken,
    trustNotice: () => null,
    mcpFile: () => mcp,
    hooksFilePath: () => hooksFile,
    hookScript: (_pluginPath, content) => content,
  };
}
