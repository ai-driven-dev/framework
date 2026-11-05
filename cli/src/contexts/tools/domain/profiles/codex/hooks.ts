import { HooksCapability } from "../../capabilities/hooks-capability.js";
import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";

export const CODEX_HOOKS = {
  rootToken: PLUGIN_ROOT_TOKEN,
  // Measured: four consecutive `codex exec` sessions installed a plugin's hooks and ran none of
  // them, with no warning, until `--dangerously-bypass-hook-trust` made the same install run
  // all three. Codex writes one `trusted_hash` per hook under `[hooks.state]` when a person
  // approves it; a hook with no entry is skipped in silence, and nothing prompts outside a
  // terminal.
  trustNotice:
    "Codex will not run this plugin's hooks until each one is trusted — approve the prompt " +
    "once in an interactive session, or pass --dangerously-bypass-hook-trust to codex exec " +
    "for a headless run. Until then, none of its hooks run and nothing says why.",
  flat: { scriptsDir: ".codex/hooks/", sharedFile: ".codex/hooks.json" },
  config: new HooksCapability({
    outputPath: ".codex/hooks.json",
    mergeStrategy: "user-prime",
    entrySection: "SessionStart",
    consumes: ["codex-hooks"],
  }),
} as const satisfies HooksDescriptor;
