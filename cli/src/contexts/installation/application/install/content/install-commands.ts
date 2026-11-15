import type { InstallationFile } from "../../../../../shared/domain/file.js";
import type { Hasher } from "../../../../../shared/ports/hasher.js";
import type {
  AiToolProfile,
  MarkdownSectionAnswers,
} from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../../translate/domain/canon.js";
import { type ContentSectionDescriptor, InstallContentSection } from "./install-content-section.js";

const commandsDescriptor: ContentSectionDescriptor<MarkdownSectionAnswers> = {
  answersOf: (tool) => tool.markdownSection("commands"),
  convertFrontmatter: (cap, frontmatter, relativeFileName) =>
    cap.convertFrontmatter(frontmatter, relativeFileName),
};

interface InstallCommandsCommand {
  toolConfig: AiToolProfile;
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
