import { reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import type {
  AgentMarkdown,
  SupportedArtifact,
} from "../../../../shared/domain/materialization/build-contract.js";
import { pluginAgentName } from "../../../../shared/domain/materialization/flat-paths.js";
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

/** An agent's frontmatter named after its plugin when its tool's shape asks for it: the one
 * place that rule is decided. */
export function namedByPlugin(
  frontmatter: Record<string, unknown>,
  shape: AgentMarkdown | undefined,
  at: { readonly plugin: string; readonly outName: string }
): Record<string, unknown> {
  return shape?.pluginPrefixedName
    ? { ...frontmatter, name: pluginAgentName(at.plugin, at.outName) }
    : frontmatter;
}

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
      kept.frontmatter(namedByPlugin(frontmatter, kept, at), {
        plugin: at.plugin,
        outName: at.outName,
      }),
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
