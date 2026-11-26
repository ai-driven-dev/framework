import type { ArtifactContract, SupportedArtifact } from "./build-contract.js";
import type { LinkSyntax } from "./link-syntax.js";

/** How a tool keeps a command: the prefix its name carries, and how its links are written. */
export interface CommandMarkdown {
  readonly namePrefix: string;
  readonly linkSyntax: LinkSyntax;
}

/** A commands artifact a tool carries: it declares how a command's name and links are kept. */
export type CommandsArtifact = SupportedArtifact & { readonly commandMarkdown: CommandMarkdown };

/** The commands of a tool that carries them as files. Absent, the build leaves them out and says so. */
export type CommandsSlot = {
  readonly commands?: Exclude<ArtifactContract, { supported: true }> | CommandsArtifact;
};
