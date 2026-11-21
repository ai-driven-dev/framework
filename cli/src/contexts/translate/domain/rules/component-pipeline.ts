import type { ArtifactContract } from "../../../tools/contract/build-contract.js";
import type { OutputFile } from "../output-file.js";
import { assertNoToolsPlaceholder } from "../tools-placeholder.js";
import { type AgentPlace, agentContent } from "./agent-markdown.js";
import { type LinkForm, rewriteLinks } from "./links.js";
import { withRootToken } from "./root-token.js";
import { namedAfterFolder } from "./skill-name.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** One file a layout writes, and the rules it goes through. A layout decides the path and which
 * rules apply, as data; `applyPlan` is the only place a rule is run, whichever layout planned it.
 * A step left out is a rule the layout does not apply to this file. */
export interface ComponentPlan {
  /** The canon path the file comes from, empty for a file the layout generates. */
  readonly source: string;
  readonly path: string;
  readonly content: string;
  /** Refuses the framework's tools placeholder: the plugin and the name the error reports. */
  readonly guard?: { readonly plugin: string; readonly name: string };
  /** Reads the links of the content from where the layout puts the file. */
  readonly links?: LinkForm;
  /** Writes the content as the tool keeps this kind of file, frontmatter included. */
  readonly shape?: (content: string) => string;
  /** The folder the entry is named after: for a tool that finds a skill by that name. */
  readonly namedAfterFolder?: true;
  /** The plugin-root variable the tool expands. */
  readonly rootToken?: string;
  /** The tool's own rewrite of a script it runs. */
  readonly script?: (content: string) => string;
}

/** Runs a plan's rules in the one order every layout shares: guard, links, shape, name, root
 * token, script. */
export function applyPlan(plan: ComponentPlan): OutputFile {
  const { guard, path } = plan;
  if (guard) assertNoToolsPlaceholder(plan.content, guard.plugin, guard.name);
  const linked = plan.links ? rewriteLinks(plan.content, plan.links) : plan.content;
  const shaped = plan.shape ? plan.shape(linked) : linked;
  const named = plan.namedAfterFolder ? namedAfterFolder(shaped, path) : shaped;
  const rooted = withRootToken(named, plan.rootToken);
  return { relativePath: path, content: plan.script ? plan.script(rooted) : rooted };
}

/** An agent shaped as its tool keeps it, wherever the layout writes it: the one rule both layouts
 * bind to the place they give the file. */
export function agentShape(
  artifact: SupportedArtifact,
  at: AgentPlace
): (content: string) => string {
  return (content) => agentContent(content, artifact, at);
}
