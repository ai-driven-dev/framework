import type {
  NativePluginAnswers,
  PluginAnswers,
} from "../../../src/contexts/tools/contract/tool-profile.js";

/** A test about a native tool's answers: refuses any other kind rather than answering for it. */
export function nativeOf(plugins: PluginAnswers | null | undefined): NativePluginAnswers {
  if (plugins?.kind !== "native") throw new Error(`expected a native tool, got ${plugins?.kind}`);
  return plugins;
}
