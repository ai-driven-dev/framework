/** Where OpenCode keeps what this CLI writes for it. Held apart from the profile so the build
 * contract can read the same values: the profile imports the contract, so the contract cannot
 * import the profile back. */

export const OPENCODE_DIRECTORY = ".opencode/";

/** The one hook filename that is, by convention, a plugin's own OpenCode plugin module — the
 * runtime the loader is meant to import — rather than a script an external bridge must run. */
export const OPENCODE_PLUGIN_ENTRY_BASENAME = "opencode-plugin.js";
