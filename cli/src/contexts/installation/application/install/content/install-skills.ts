import type { InstallationFile } from "../../../../../shared/domain/file.js";
import type { Hasher } from "../../../../../shared/ports/hasher.js";
import type {
  AiToolProfile,
  SkillsSectionAnswers,
} from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../domain/canon.js";
import { type ContentSectionDescriptor, InstallContentSection } from "./install-content-section.js";

const skillsDescriptor: ContentSectionDescriptor<SkillsSectionAnswers> = {
  answersOf: (tool) => tool.skillsSection(),
  convertFrontmatter: (cap, frontmatter) => cap.convertFrontmatter(frontmatter),
};

interface InstallSkillsCommand {
  toolConfig: AiToolProfile;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallSkills {
  private readonly inner: InstallContentSection<SkillsSectionAnswers>;

  constructor(hasher: Hasher) {
    this.inner = new InstallContentSection(hasher, skillsDescriptor);
  }

  execute(options: InstallSkillsCommand): InstallationFile[] {
    return this.inner.execute(options);
  }
}
