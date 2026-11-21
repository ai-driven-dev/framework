import type { AgentMarkdown, SupportedArtifact } from "../../../tools/contract/build-contract.js";
import { reshapeFrontmatter } from "./frontmatter.js";
import type { LinkForm } from "./links.js";

/** Where an agent is written and how its links are read from there. */
export interface AgentPlace {
  readonly plugin: string;
  readonly outName: string;
  readonly from: string;
  readonly resolveTarget?: (pluginRelPath: string) => string;
  /** What an agent its tool shapes in no way becomes: `carry` keeps it as it is, `links` reads
   * the links of its body. */
  readonly unshaped: "carry" | "links";
}

const KEEPS_FRONTMATTER: AgentMarkdown = { frontmatter: (frontmatter) => frontmatter };

/** One agent, as every layout writes it: the tool's own frontmatter. A tool whose agent is no
 * markdown converts it whole. An agent a tool shapes in no way follows `unshaped`. Its links are
 * the plan's to read, by `agentLinks`. */
export function agentContent(content: string, artifact: SupportedArtifact, at: AgentPlace): string {
  const shape = artifact.agentMarkdown;
  if (shape === undefined && artifact.transform) {
    return artifact.transform(content, at.plugin, at.outName);
  }
  if (shape === undefined && at.unshaped === "carry") return content;
  const kept = shape ?? KEEPS_FRONTMATTER;
  return reshapeFrontmatter(content, {
    frontmatter: (frontmatter) =>
      kept.frontmatter(frontmatter, { plugin: at.plugin, outName: at.outName }),
    quote: kept.quote,
  });
}

/** How an agent's links are read from where the layout puts it: none for an agent a tool converts
 * whole or one carried as it is. */
export function agentLinks(artifact: SupportedArtifact, at: AgentPlace): LinkForm | undefined {
  const shaped = artifact.agentMarkdown !== undefined;
  if (!shaped && (artifact.transform !== undefined || at.unshaped === "carry")) return undefined;
  return {
    kind: "relative",
    currentFilePluginRelative: at.from,
    resolveTargetPath: at.resolveTarget,
  };
}
