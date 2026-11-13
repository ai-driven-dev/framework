import { CapabilityConfigError } from "../../../../kernel/errors.js";

const TOOL_SUFFIX = /^\.[a-z]+\.md$/;

function basenameOf(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf("/") + 1);
}

/** The `.<tool>.md` ending that marks a source file as written for one tool. */
export class ToolSuffix {
  constructor(readonly value: string) {
    if (!TOOL_SUFFIX.test(value)) {
      throw new CapabilityConfigError(`"${value}" is not a tool suffix, expected ".<tool>.md".`);
    }
  }

  /** The file name with this suffix replaced by a plain `.md`, its directory kept; a name that
   * does not carry the suffix comes back as it was. */
  strip(fileName: string): string {
    const basename = basenameOf(fileName);
    if (!basename.endsWith(this.value)) return fileName;
    const directory = fileName.slice(0, fileName.length - basename.length);
    return `${directory}${basename.slice(0, -this.value.length)}.md`;
  }

  /** Whether the file name carries this suffix, which makes it foreign to every reader whose
   * own suffix is another. */
  isForeign(fileName: string): boolean {
    return basenameOf(fileName).endsWith(this.value);
  }
}
