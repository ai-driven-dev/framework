import type { InstallationFile } from "../../../../../shared/domain/file.js";
import type { Hasher } from "../../../../../shared/ports/hasher.js";
import type {
  AiToolProfile,
  MarkdownSectionAnswers,
} from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../domain/canon.js";
import { type ContentSectionDescriptor, InstallContentSection } from "./install-content-section.js";

const rulesDescriptor: ContentSectionDescriptor<MarkdownSectionAnswers> = {
  answersOf: (tool) => tool.markdownSection("rules"),
  convertFrontmatter: (cap, frontmatter, relativeFileName) =>
    cap.convertFrontmatter(frontmatter, relativeFileName),
};

interface InstallRulesCommand {
  toolConfig: AiToolProfile;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallRules {
  private readonly inner: InstallContentSection<MarkdownSectionAnswers>;

  constructor(hasher: Hasher) {
    this.inner = new InstallContentSection(hasher, rulesDescriptor);
  }

  execute(options: InstallRulesCommand): InstallationFile[] {
    return this.inner.execute(options);
  }
}
