import type {
  HooksAcceptance,
  PluginDelivery,
} from "../../../../src/contexts/tools/contract/tool-profile.js";

/** A delivery with no scope, no global file and no project hooks: only what it says of hooks. */
export function pluginDeliveryAccepting(hooks: HooksAcceptance): PluginDelivery {
  return {
    requiresUserScope: () => false,
    materializesFromBuiltTree: () => false,
    supportsUserScopeActivation: () => false,
    copiesFilesGlobally: () => false,
    userPluginsBaseDir: () => null,
    globalFiles: () => null,
    hooksAcceptance: () => hooks,
    deliversHooksToProject: () => false,
  };
}
