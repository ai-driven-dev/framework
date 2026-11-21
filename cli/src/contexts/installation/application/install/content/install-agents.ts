import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { MarkdownSectionAnswers } from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../domain/canon.js";
import type { ContentSections } from "../../../ports/tool-sections.js";
import { type ContentSectionDescriptor, InstallContentSection } from "./install-content-section.js";

const agentsDescriptor: ContentSectionDescriptor<MarkdownSectionAnswers> = {
  answersOf: (tool) => tool.markdownSection("agents"),
  convertFrontmatter: (cap, frontmatter, relativeFileName) =>
    cap.convertFrontmatter(frontmatter, relativeFileName),
};

interface InstallAgentsCommand {
  toolConfig: ContentSections;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallAgents {
  private readonly inner: InstallContentSection<MarkdownSectionAnswers> = new InstallContentSection(
    agentsDescriptor
  );

  execute(options: InstallAgentsCommand): InstallationFile[] {
    return this.inner.execute(options);
  }
}
