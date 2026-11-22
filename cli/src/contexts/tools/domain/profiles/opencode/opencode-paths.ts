/** Where OpenCode keeps what this CLI writes for it. Held apart from the profile so the build
 * contract can read the same values: the profile imports the contract, so the contract cannot
 * import the profile back. */

import { flatGlobalFilePath } from "../../capabilities/plugins-capability.js";

export const OPENCODE_DIRECTORY = ".opencode/";

/** A machine-scope install puts a plugin's skills and agents where OpenCode loads them for every
 * project: its global config directory. */
export const opencodeGlobalFilePath = flatGlobalFilePath(OPENCODE_DIRECTORY);

/** The one hook filename that is, by convention, a plugin's own OpenCode plugin module — the
 * runtime the loader is meant to import — rather than a script an external bridge must run. */
export const OPENCODE_PLUGIN_ENTRY_BASENAME = "opencode-plugin.js";
