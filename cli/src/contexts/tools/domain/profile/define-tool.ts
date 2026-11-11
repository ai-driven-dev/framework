import { isAbsolute } from "node:path";
import { InvalidToolProfileError } from "../../../../kernel/errors.js";
import {
  AI_TOOL_IDS,
  type AiToolId,
  IDE_TOOL_IDS,
  type IdeToolId,
} from "../../../../kernel/tool.js";
import type { AiTool, IdeToolConfig } from "../contracts.js";
import { stripToolSuffix } from "../formats/command.js";
import {
  isProfileSectionKey,
  type ProfileSection,
  type ProfileSectionKey,
  type ProfileSections,
} from "./profile-sections.js";
import { ToolSuffix } from "./tool-suffix.js";

/** Only `defineAiTool` and `defineIdeTool` can produce one: an object literal lacks the private
 * field, so a profile cannot skip the factory's refusals. */
export declare class ProfileBrand {
  private readonly profileBrand: true;
}

/** The directory and suffix a profile states once, handed to its sections. */
export interface BoundTool {
  readonly directory: string;
  readonly toolSuffix: string;
  /** Where a built file lands: `<directory><subdirectory><name without the tool suffix>`. */
  installUnder(subdirectory: string): (fileName: string) => string;
}

type AiToolFields = Omit<AiTool<ProfileSections>, "kind" | "toolId" | "capabilities" | "section">;

export interface AiToolSpec<C extends ProfileSections> extends AiToolFields {
  readonly toolId: string;
  readonly capabilities: (bound: BoundTool) => C;
}

export interface IdeToolSpec<C extends ProfileSections> {
  readonly toolId: string;
  readonly directory: string;
  readonly signalDir: string | null;
  readonly capabilities: () => C;
}

function refuseDirectory(toolId: string, directory: string): void {
  if (isAbsolute(directory)) {
    throw new InvalidToolProfileError(
      toolId,
      "directory-not-relative",
      `'${directory}' must be relative to the project root.`
    );
  }
  if (!directory.endsWith("/")) {
    throw new InvalidToolProfileError(
      toolId,
      "directory-without-trailing-slash",
      `'${directory}' must end with '/'.`
    );
  }
}

function refuseUnknownSections(toolId: string, sections: ProfileSections): void {
  for (const key of Object.keys(sections)) {
    if (!isProfileSectionKey(key)) {
      throw new InvalidToolProfileError(toolId, "unknown-section", `'${key}' is no section.`);
    }
  }
}

function bind(directory: string, toolSuffix: string): BoundTool {
  return {
    directory,
    toolSuffix,
    installUnder: (subdirectory) => (fileName) =>
      `${directory}${subdirectory}${stripToolSuffix(toolSuffix, fileName)}`,
  };
}

/** Answers from the sections captured at construction, so the method survives being detached
 * and no caller reads the record itself. */
function sectionReader(
  sections: ProfileSections
): <K extends ProfileSectionKey>(key: K) => ProfileSection<K> | null {
  return (key) => sections[key] ?? null;
}

function aiToolId(id: string): AiToolId {
  const known = AI_TOOL_IDS.find((candidate) => candidate === id);
  if (known === undefined) {
    throw new InvalidToolProfileError(id, "unknown-tool-id", `no AI tool is named '${id}'.`);
  }
  return known;
}

function ideToolId(id: string): IdeToolId {
  const known = IDE_TOOL_IDS.find((candidate) => candidate === id);
  if (known === undefined) {
    throw new InvalidToolProfileError(id, "unknown-tool-id", `no IDE tool is named '${id}'.`);
  }
  return known;
}

export function defineAiTool<C extends ProfileSections>(
  spec: AiToolSpec<C>
): AiTool<C> & ProfileBrand {
  const { toolId: id, capabilities: declare, ...fields } = spec;
  const toolId = aiToolId(id);
  refuseDirectory(toolId, spec.directory);
  new ToolSuffix(spec.toolSuffix);
  const contracts = spec.buildContracts;
  if (contracts.marketplace === undefined && contracts.flat === undefined) {
    throw new InvalidToolProfileError(
      toolId,
      "no-build-contract",
      "an AI tool declares a marketplace or a flat build contract."
    );
  }
  const capabilities = declare(bind(spec.directory, spec.toolSuffix));
  refuseUnknownSections(toolId, capabilities);
  const profile = {
    ...fields,
    kind: "ai",
    toolId,
    section: sectionReader(capabilities),
  };
  return profile as AiTool<C> & ProfileBrand;
}

export function defineIdeTool<C extends ProfileSections>(
  spec: IdeToolSpec<C>
): IdeToolConfig<C> & ProfileBrand {
  const { toolId: id, capabilities: declare, ...fields } = spec;
  const toolId = ideToolId(id);
  refuseDirectory(toolId, spec.directory);
  const capabilities = declare();
  refuseUnknownSections(toolId, capabilities);
  const profile = {
    ...fields,
    kind: "ide",
    toolId,
    section: sectionReader(capabilities),
  };
  return profile as IdeToolConfig<C> & ProfileBrand;
}
