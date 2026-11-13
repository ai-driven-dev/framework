// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-kiro.cjs";
import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { KIRO_DIRECTORY } from "./kiro-paths.js";

export const KIRO_HOOKS = {
  // Claude and Kiro name their tools differently, so only the tool-free event is carried over.
  eventMap: { SessionStart: ["SessionStart"] },
  // The IDE and CLI V3 load every `.kiro/hooks/*.json`, in a project and in the home alike:
  // every plugin's entries share one file of AIDD's own, beside their scripts.
  flat: { scriptsDir: `${KIRO_DIRECTORY}hooks/`, sharedFile: `${KIRO_DIRECTORY}hooks/aidd.json` },
  runtime: { adapter },
} as const satisfies HooksDescriptor;
