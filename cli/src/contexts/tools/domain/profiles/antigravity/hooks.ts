// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-antigravity.cjs";
import { declareHooks } from "../../formats/hooks-descriptor.js";
import { ANTIGRAVITY_DIRECTORY } from "./antigravity-paths.js";

export const ANTIGRAVITY_HOOKS = declareHooks("antigravity", ANTIGRAVITY_DIRECTORY, adapter, {
  events: { SessionStart: "SessionStart" },
  undeclaredEvents: "skipped",
  // Claude and `agy` name their tools differently, so only the tool-free event is carried over.
  // `agy` reads hooks only from the project's `.agents/hooks.json`, keyed by hook name, and runs
  // each handler from `<repo>/.agents`.
  flat: {
    scriptsDir: `${ANTIGRAVITY_DIRECTORY}hooks/`,
    sharedFile: `${ANTIGRAVITY_DIRECTORY}hooks.json`,
  },
});
