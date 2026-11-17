import type { InstallationFile } from "../../../../../shared/domain/file.js";
import type { Hasher } from "../../../../../shared/ports/hasher.js";
import type { MarkdownSectionAnswers } from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../domain/canon.js";
import type { ContentSections } from "../../../ports/tool-sections.js";
import { type ContentSectionDescriptor, InstallContentSection } from "./install-content-section.js";

const commandsDescriptor: ContentSectionDescriptor<MarkdownSectionAnswers> = {
  answersOf: (tool) => tool.markdownSection("commands"),
  convertFrontmatter: (cap, frontmatter, relativeFileName) =>
    cap.convertFrontmatter(frontmatter, relativeFileName),
};

interface InstallCommandsCommand {
  toolConfig: ContentSections;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallCommands {
  private readonly inner: InstallContentSection<MarkdownSectionAnswers>;

  constructor(hasher: Hasher) {
    this.inner = new InstallContentSection(hasher, commandsDescriptor);
  }

  execute(options: InstallCommandsCommand): InstallationFile[] {
    return this.inner.execute(options);
  }
}
