/**
 * A reader outside the tools context names the sections of a tool it reads, never the whole
 * profile. Biome holds the half that names it (`biome-plugins/whole-profile-import.grit` and
 * `whole-profile-namespace-import.grit`): an import of `AiToolProfile`, `IdeToolProfile` or
 * `ToolProfile` outside the tools context and the composition root, each handing-on file carrying
 * a `biome-ignore lint/plugin` with its reason above the import.
 *
 * This is the half Biome cannot see, because it needs types: a file that never names the whole
 * profile is still a reader when it asks the catalog for a profile and passes it into a parameter
 * typed as the whole profile. `profile-flow.ts` reads that from the compiler, over the files that
 * call a whole-profile catalog method, and leaves out a call whose callee is declared in a file
 * that carries such a `biome-ignore`, which already carries that debt.
 *
 * Written limit: an element-access alias of a profile (`tools["aiProfile"](id)`, `profiles[0]`) is
 * not read; no file under src/ writes one.
 */
import { describe, expect, it } from "vitest";
import { CLI_ROOT, read, sourceFiles } from "./helpers.js";
import { wholeProfileFlows, wholeProfileFlowsInSources } from "./profile-flow.js";

const OWNER_OR_WIRING = /^src\/(contexts\/tools\/|composition\/)/;
const PROFILE_MODULE_FILE = "src/contexts/tools/contract/tool-profile.ts";

/** The catalog methods that answer a whole profile. */
const CATALOG_PROFILE_METHODS = [
  "profile",
  "aiProfile",
  "ideProfile",
  "aiProfileIfAny",
  "sortedById",
];
const CATALOG_PROFILE_CALL = new RegExp(String.raw`\.(?:${CATALOG_PROFILE_METHODS.join("|")})\(`);
/** An import of the profile module under a `biome-ignore lint/plugin` comment: a file that hands the profile on. */
const HANDS_PROFILE_ON =
  /biome-ignore lint\/plugin:[^\n]*\n(?:import|export)[^;]*tools\/contract\/tool-profile\.js/;

/**
 * The flow reading starts a compiler process and checks the project: measured 0.3s alone, 0.7s in
 * the architecture batch and up to 3.3s with other suites running, so the 5s default has little
 * room under load.
 */
const FLOW_TIMEOUT_MS = 30_000;

describe("a reader names the sections of a tool it reads", () => {
  it("no file outside the tools context passes a catalog profile into a whole-profile parameter", {
    timeout: FLOW_TIMEOUT_MS,
  }, () => {
    const watched = sourceFiles().filter((file) => !OWNER_OR_WIRING.test(file));
    const handsOn = watched.filter((file) => HANDS_PROFILE_ON.test(read(file)));
    expect(
      handsOn.length,
      "no file hands the profile on: the exemption reads nothing"
    ).toBeGreaterThan(0);

    const flowing = wholeProfileFlows(
      CLI_ROOT,
      PROFILE_MODULE_FILE,
      watched.filter((file) => CATALOG_PROFILE_CALL.test(read(file))),
      handsOn
    );
    expect(flowing, "name the sections it reads, in its own ports/").toEqual([]);
  });

  it("the guard itself: lists every catalog method that answers a whole profile", () => {
    const answering = [
      ...read("src/contexts/tools/contract/tool-catalog.ts").matchAll(
        /^\s+(\w+)\([^)]*\):[^;]*\b(?:Ai|Ide)?ToolProfile\b/gm
      ),
    ].map((match) => match[1]);
    expect([...new Set(answering)].sort()).toEqual([...CATALOG_PROFILE_METHODS].sort());
  });

  it("the guard itself: reads a file that hands the profile on, multi-line or not", () => {
    const single =
      '// biome-ignore lint/plugin: hands it on\nimport type { AiToolProfile } from "../tools/contract/tool-profile.js";';
    const multi =
      '// biome-ignore lint/plugin: hands it on\nimport type {\n  AiToolProfile,\n} from "../tools/contract/tool-profile.js";';
    const bare = 'import type { AiToolProfile } from "../tools/contract/tool-profile.js";';
    expect(HANDS_PROFILE_ON.test(single)).toBe(true);
    expect(HANDS_PROFILE_ON.test(multi)).toBe(true);
    expect(HANDS_PROFILE_ON.test(bare)).toBe(false);
  });
});

describe("the flow guard itself", () => {
  const MODULE = PROFILE_MODULE_FILE;
  const LISTED_CALLEE = "src/contexts/b/listed.ts";
  const project = (caller: string): Record<string, string> => ({
    [MODULE]: [
      "export interface AiToolProfile { kind: 'ai'; toolId: string; hostBinary(): string }",
      "export interface IdeToolProfile { kind: 'ide'; toolId: string }",
      "export type ToolProfile = AiToolProfile | IdeToolProfile;",
    ].join("\n"),
    "src/contexts/tools/contract/tool-catalog.ts": [
      "import type { AiToolProfile } from './tool-profile.js';",
      "export interface ToolCatalog { aiProfile(id: string): AiToolProfile }",
    ].join("\n"),
    "src/contexts/b/sinks.ts": [
      "import type { AiToolProfile } from '../tools/contract/tool-profile.js';",
      "export declare function whole(profile: AiToolProfile): void;",
      "export declare function narrow(profile: { toolId: string }): void;",
      "export declare function generic<T>(value: T): void;",
      "export declare function options(o: { tool: AiToolProfile }): void;",
      "export declare function narrowOptions(o: { tool: { toolId: string } }): void;",
    ].join("\n"),
    [LISTED_CALLEE]: [
      "import type { AiToolProfile } from '../tools/contract/tool-profile.js';",
      "export declare function handoff(profile: AiToolProfile): void;",
    ].join("\n"),
    "src/contexts/b/caller.ts": [
      "import { handoff } from './listed.js';",
      "import type { ToolCatalog } from '../tools/contract/tool-catalog.js';",
      "import { generic, narrow, narrowOptions, options, whole } from './sinks.js';",
      "declare const tools: ToolCatalog;",
      caller,
    ].join("\n"),
  });
  const flows = (caller: string, exempt: readonly string[] = []): string[] =>
    wholeProfileFlowsInSources(project(caller), MODULE, ["src/contexts/b/caller.ts"], exempt);

  it("flags a catalog profile passed directly into a whole-profile parameter", () => {
    expect(flows("whole(tools.aiProfile('x'));")).toHaveLength(1);
  });

  it("flags a profile passed through a name into a whole-profile parameter", () => {
    expect(flows("const p = tools.aiProfile('x');\nwhole(p);")).toHaveLength(1);
  });

  it("flags a profile inside an object literal argument whose property is the whole profile", () => {
    expect(flows("options({ tool: tools.aiProfile('x') });")).toHaveLength(1);
  });

  it("clears a profile passed into a narrow parameter or a narrow property", () => {
    expect(flows("narrow(tools.aiProfile('x'));")).toEqual([]);
    expect(flows("narrowOptions({ tool: tools.aiProfile('x') });")).toEqual([]);
  });

  it("clears a profile passed to a generic call, whose parameter the compiler infers from it", () => {
    expect(flows("generic(tools.aiProfile('x'));")).toEqual([]);
  });

  it("clears a profile passed to a callee declared in an exempt file, and flags it otherwise", () => {
    const call = "handoff(tools.aiProfile('x'));";
    expect(flows(call, [LISTED_CALLEE])).toEqual([]);
    expect(flows(call)).toHaveLength(1);
  });
});
