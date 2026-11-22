/**
 * The rules of the kind gate about what a tool's plugin sections and answers expose: a section
 * method has a caller, a plugin answer is asked and never read. Each takes the files as text and
 * returns violations; `kinds.rules.arch.test.ts` holds the tree to them, with no violation tolerated.
 *
 * Written limits: a call is spelled as `.method(` in another file and nothing proves a real path
 * reaches it; a plugin answer held in a variable and read from there is out of sight, which a `#`
 * field prevents.
 */
import { present } from "../shared/testing/present.builder.js";
import { violation } from "./kind-rule-support.js";
import type { Violation } from "./kinds.js";

// A section declares nothing nobody calls. `knip` cannot hold this: its entries include the tests,
// so a method only a test calls reads as used.

const SECTION_FILE = /^src\/contexts\/[^/]+\/domain\/sections\/[^/]+\.ts$/;
const SECTION_CLASS = /^export class (\w+)Section\b[^{]*\{([\s\S]*?)\n\}/gm;
const CLASS_METHOD = /^ {2}(?:(static) )?(?:async )?(?:(get) )?(\w+)\s*(?:<[^>]*>)?\(/gm;

/** The receivers a section is reached through: its key, the key with `Cap` or `Section`, or the
 * generic `cap`, `section` and `capability`, as whole identifiers. */
const namesSection = (receiver: string, key: string): boolean =>
  [key, `${key}cap`, `${key}section`, "cap", "section", "capability"].includes(
    receiver.toLowerCase()
  );

interface SectionMethod {
  readonly file: string;
  readonly className: string;
  readonly key: string;
  readonly name: string;
  readonly isStatic: boolean;
  readonly isGetter: boolean;
}

/** The methods of the section classes of one file, but for the constructor. */
function sectionMethods([file, text]: readonly [string, string]): SectionMethod[] {
  if (!SECTION_FILE.test(file)) return [];
  return [...text.matchAll(SECTION_CLASS)].flatMap((block) =>
    [...present(block[2]).matchAll(CLASS_METHOD)]
      .filter((member) => member[3] !== "constructor")
      .map((member) => ({
        file,
        className: `${block[1]}Section`,
        key: present(block[1]).toLowerCase(),
        name: present(member[3]),
        isStatic: member[1] !== undefined,
        isGetter: member[2] !== undefined,
      }))
  );
}

/** Whether the call found at `match`, in the file `caller`, reaches the method of a section. */
function reachesSection(method: SectionMethod, caller: string, match: RegExpMatchArray): boolean {
  const receiver = present(match[1]);
  if (caller === method.file) return receiver === "this";
  if (method.isStatic) return receiver === method.className;
  if (match[2] === undefined) return namesSection(receiver, method.key);
  return /Section$/.test(receiver) || (receiver === "section" && match[2] === `("${method.key}")`);
}

function isCalled(method: SectionMethod, bodies: ReadonlyMap<string, string>): boolean {
  const use = new RegExp(
    `([\\w$]+)(\\([^()]*\\))?\\??\\.${method.name}${method.isGetter ? "\\b(?!\\s*\\()" : "\\s*\\("}`,
    "g"
  );
  return [...bodies].some(
    ([caller, body]) =>
      body.includes(`.${method.name}`) &&
      [...body.matchAll(use)].some((match) => reachesSection(method, caller, match))
  );
}

/** A method is called through `this.m(` in its own file, `<receiver>.m(` elsewhere where the
 * receiver names the section or is a call to a `...Section` resolver, a static on the class, a
 * getter without parentheses. */
export function sectionViolations(bodies: ReadonlyMap<string, string>): Violation[] {
  return [...bodies]
    .flatMap(sectionMethods)
    .filter((method) => !isCalled(method, bodies))
    .map((method) =>
      violation(
        "sections",
        `${method.file} :: ${method.className}.${method.name}`,
        "no file of src calls it",
        "a section declares no method nobody in src calls",
        "add the caller, or delete the method"
      )
    );
}

// A tool's plugin delivery is asked, never read.

const CLASS_BLOCK = /^(?:export )?(?:abstract )?class (\w+)[^{]*\{([\s\S]*?)\n\}/gm;
const PUBLIC_FIELD =
  /^ {2}(?!static |constructor|abstract |override |async |get |set )(?:(?:public|private|protected) )?(?:readonly )?(\w+)[?!]?\s*[:=]/gm;
/** A parameter property cannot be a `#` field, so it is refused outright. */
const PARAMETER_PROPERTY = /constructor\([^)]*\b(?:public|private|protected|readonly)\s+(\w+)/g;
/** What a stored-value answer hands back: a stored field, an optional read of one, a `?? literal`
 * default over it, or a spread copy of it. A call in the expression makes it a computation. */
const STORED = String.raw`(?:this\.#?\w+(?:\??\.\w+)*(?: \?\? [^;()]+)?|\{\s*\.\.\.this\.#?\w+(?:\.\w+)*\s*\})`;
const STORED_VALUE_GETTER = new RegExp(
  String.raw`^ {2}(?:override )?get (\w+)\(\)[^{]*\{\s*return ${STORED};\s*\}`,
  "gm"
);
const STORED_VALUE_METHOD = new RegExp(
  String.raw`^ {2}(?!get |set )(?:override )?(?:public )?(\w+)(?:<[^>]*>)?\([^)]*\)[^{]*\{\s*return ${STORED};\s*\}`,
  "gm"
);
/** A method that returns an object literal built only of stored fields: the declaration handed
 * out whole, field by field. */
const STORED_OBJECT_COPY =
  /^ {2}(?!get |set )(?:override )?(?:public )?(\w+)\([^)]*\)[^{]*\{\s*(?:const (\w+) = this\.#?\w+;\s*)?return \{\s*(?:(?:\.\.\.this\.#?\w+|\w+: (?:this\.#?\w+|\w+)\.\w+),\s*)+\};\s*\}/gm;

/** The files whose classes answer about plugins. */
export const isPluginAnswerFile = (path: string): boolean =>
  /^src\/contexts\/tools\/domain\/(?:sections|native-registration)\/[^/]+\.ts$/.test(path) ||
  path === "src/contexts/tools/domain/profile/plugin-answers.ts";

const ANSWER_FILE = "src/contexts/tools/domain";

/** The stored values a caller needs as they are, because the raw value crosses a file boundary
 * unchanged: a path read, written and hashed, a binary looked up by name, a declaration handed to
 * an adapter. A permanent list, never debt: each entry names its caller and why no method can
 * answer in its place. A question a method can answer is asked, not listed. */
export const STORED_ANSWERS: readonly {
  readonly file: string;
  readonly member: string;
  readonly caller: string;
  readonly reason: string;
}[] = [
  {
    file: `${ANSWER_FILE}/sections/config-section.ts`,
    member: "ConfigSection.outputPath",
    caller: "installation/application/install/config/install-ide-config.use-case.ts",
    reason: "the path is checked against the manifest and its basename names the asset to load",
  },
  {
    file: `${ANSWER_FILE}/native-registration/marketplace-registration.ts`,
    member: "MarketplaceRegistration.sharedSettingsFile",
    caller:
      "orchestration/sync/settings/sync-tool-settings-files.use-case.ts, installation/application/sync/record-activation.use-case.ts",
    reason: "the path is read, written, hashed and matched against the manifest",
  },
  {
    file: `${ANSWER_FILE}/native-registration/marketplace-registration.ts`,
    member: "MarketplaceRegistration.marketplacesKey",
    caller: "orchestration/sync/settings/sync-tool-settings-files.use-case.ts",
    reason:
      "the key names a member of a parsed settings file that host-registration's pure settings-declaration edits",
  },
  {
    file: `${ANSWER_FILE}/native-registration/marketplace-registration.ts`,
    member: "MarketplaceRegistration.enabledPluginsKey",
    caller: "orchestration/sync/settings/sync-tool-settings-files.use-case.ts",
    reason:
      "the key names a member of a parsed settings file that host-registration's pure settings-declaration edits",
  },
  {
    file: `${ANSWER_FILE}/native-registration/native-activation.ts`,
    member: "NativeActivation.hostBinary",
    caller:
      "host-registration/application, installation/application/sync/record-activation.use-case.ts, composition/host-registration.ts",
    reason: "the binary is looked up on the PATH and keys the host's activator",
  },
  {
    file: `${ANSWER_FILE}/native-registration/native-activation.ts`,
    member: "NativeActivation.cliShape",
    caller: "composition/host-registration.ts",
    reason: "the host CLI adapter is built from the verbs themselves",
  },
  {
    file: `${ANSWER_FILE}/native-registration/native-activation.ts`,
    member: "NativeActivation.marketplaceSourcesDeclaration",
    caller: "composition/host-registration.ts",
    reason: "the source readers are built from the declaration itself",
  },
];

/** A class of a plugin answer that leaves a stored value readable instead of answering, minus
 * the stored values a caller needs as they are. */
export function answerViolations(files: Readonly<Record<string, string>>): Violation[] {
  const kept = new Set(STORED_ANSWERS.map((a) => `${a.file} :: ${a.member}`));
  return storedValueViolations(files).filter((v) => !kept.has(v.entry));
}

const STORED_PATTERNS: readonly RegExp[] = [
  PUBLIC_FIELD,
  PARAMETER_PROPERTY,
  STORED_VALUE_GETTER,
  STORED_VALUE_METHOD,
  STORED_OBJECT_COPY,
];

/** Every plugin answer class leaving a stored value readable, kept or not. */
export function storedValueViolations(files: Readonly<Record<string, string>>): Violation[] {
  return Object.entries(files)
    .filter(([file]) => isPluginAnswerFile(file))
    .flatMap(([file, source]) =>
      [...source.matchAll(CLASS_BLOCK)].flatMap((block) =>
        STORED_PATTERNS.flatMap((pattern) =>
          [...present(block[2]).matchAll(pattern)].map((field) =>
            violation(
              "answers",
              `${file} :: ${block[1]}.${field[1]}`,
              "leaves a stored value readable",
              "a plugin answer is a method, and its data is a # field",
              "answer by a method and make the field #private"
            )
          )
        )
      )
    );
}
