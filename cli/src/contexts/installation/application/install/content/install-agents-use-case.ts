import type { InstallationFile } from "../../../../../shared/domain/file.js";
import type { Hasher } from "../../../../../shared/ports/hasher.js";
import type {
  AiToolProfile,
  MarkdownSectionAnswers,
} from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../../translate/domain/canon.js";
import {
  type ContentSectionDescriptor,
  InstallContentSectionUseCase,
} from "./install-content-section-use-case.js";

const agentsDescriptor: ContentSectionDescriptor<MarkdownSectionAnswers> = {
  answersOf: (tool) => tool.markdownSection("agents"),
  convertFrontmatter: (cap, frontmatter, relativeFileName) =>
    cap.convertFrontmatter(frontmatter, relativeFileName),
};

interface InstallAgentsOptions {
  toolConfig: AiToolProfile;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallAgentsUseCase {
  private readonly inner: InstallContentSectionUseCase<MarkdownSectionAnswers>;

  constructor(hasher: Hasher) {
    this.inner = new InstallContentSectionUseCase(hasher, agentsDescriptor);
  }

  execute(options: InstallAgentsOptions): InstallationFile[] {
    return this.inner.execute(options);
  }
}
