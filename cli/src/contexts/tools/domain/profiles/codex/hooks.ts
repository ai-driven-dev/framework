// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-codex.cjs";
import { declareHooks } from "../../formats/hooks-descriptor.js";
import { CODEX_DIRECTORY, CODEX_PLUGIN_ROOT_TOKEN } from "./codex-paths.js";

export const CODEX_HOOKS = declareHooks("codex", CODEX_DIRECTORY, adapter, {
  // Measured: four consecutive `codex exec` sessions installed a plugin's hooks and ran none of
  // them, with no warning, until `--dangerously-bypass-hook-trust` made the same install run
  // all three. Codex writes one `trusted_hash` per hook under `[hooks.state]` when a person
  // approves it; a hook with no entry is skipped in silence, and nothing prompts outside a
  // terminal.
  trustNotice:
    "Codex will not run this plugin's hooks until each one is trusted — approve the prompt " +
    "once in an interactive session, or pass --dangerously-bypass-hook-trust to codex exec " +
    "for a headless run. Until then, none of its hooks run and nothing says why.",
  // Each item kept whole: Codex trusts a hook by its whole entry, and an entry stripped of
  // `async` runs in the way of the session it was written to stay out of.
  file: { wrapper: {}, entries: { shape: "matchers", itemsKept: "commands" } },
  rootToken: CODEX_PLUGIN_ROOT_TOKEN,
  flat: { scriptsDir: ".codex/hooks/", sharedFile: ".codex/hooks.json" },
  config: {
    outputPath: ".codex/hooks.json",
    mergeStrategy: "user-prime",
    consumes: ["codex-hooks"],
  },
});
