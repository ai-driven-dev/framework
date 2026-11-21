import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import type { AgentMarkdown, ArtifactContract } from "../../../tools/contract/build-contract.js";
import { rewriteRelativeLinks } from "./links.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

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

/** One agent, as every layout writes it: the tool's own frontmatter, the links of the body read
 * from where the layout puts the file. A tool whose agent is no markdown converts it whole. An
 * agent a tool shapes in no way follows `unshaped`. */
export function agentContent(content: string, artifact: SupportedArtifact, at: AgentPlace): string {
  const shape = artifact.agentMarkdown;
  if (shape === undefined && artifact.transform) {
    return artifact.transform(content, at.plugin, at.outName);
  }
  if (shape === undefined && at.unshaped === "carry") return content;
  const { frontmatter, body } = parseFrontmatter(content);
  const kept = shape ?? KEEPS_FRONTMATTER;
  return serializeFrontmatter(
    kept.frontmatter(frontmatter, { plugin: at.plugin, outName: at.outName }),
    rewriteRelativeLinks(body, {
      currentFilePluginRelative: at.from,
      resolveTargetPath: at.resolveTarget,
    }),
    kept.quote
  );
}
