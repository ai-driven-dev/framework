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

const commandsDescriptor: ContentSectionDescriptor<MarkdownSectionAnswers> = {
  answersOf: (tool) => tool.markdownSection("commands"),
  convertFrontmatter: (cap, frontmatter, relativeFileName) =>
    cap.convertFrontmatter(frontmatter, relativeFileName),
};

interface InstallCommandsOptions {
  toolConfig: AiToolProfile;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallCommandsUseCase {
  private readonly inner: InstallContentSectionUseCase<MarkdownSectionAnswers>;

  constructor(hasher: Hasher) {
    this.inner = new InstallContentSectionUseCase(hasher, commandsDescriptor);
  }

  execute(options: InstallCommandsOptions): InstallationFile[] {
    return this.inner.execute(options);
  }
}
