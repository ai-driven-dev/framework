/**
 * The profile flow reading (`profile-flow.ts`): a reader names the sections of a tool it reads,
 * held to the case it names and then to the real tree.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { entries, expectNone, src } from "./kind-rule-fixtures.js";
import { profileViolations } from "./kind-rules.js";
import {
  CATALOG_PROFILE_METHODS,
  HANDS_PROFILE_ON,
  PROFILE_MODULE_FILE,
  profileReaders,
  wholeProfileFlowsInSources,
} from "./profile-flow.js";
import { CLI_ROOT } from "./source-graph.js";

const FLOW_TIMEOUT_MS = 30_000;

describe("a reader names the sections of a tool it reads", () => {
  it("holds the tree, with no violation", { timeout: FLOW_TIMEOUT_MS }, () => {
    const tree = src();
    expect(
      profileReaders(tree).handsOn.length,
      "no file hands the profile on: the exemption reads nothing"
    ).toBeGreaterThan(0);
    expectNone(profileViolations(tree, CLI_ROOT));
  });

  it("lists every catalog method that answers a whole profile", () => {
    const answering = [
      ...(src()["src/contexts/tools/contract/tool-catalog.ts"]?.matchAll(
        /^\s+(\w+)\([^)]*\):[^;]*\b(?:Ai|Ide)?ToolProfile\b/gm
      ) ?? []),
    ].map((match) => match[1]);
    expect([...new Set(answering)].sort()).toEqual([...CATALOG_PROFILE_METHODS].sort());
  });

  it("reads a file that hands the profile on, multi-line or not", () => {
    const single =
      '// biome-ignore lint/plugin: hands it on\nimport type { AiToolProfile } from "../tools/contract/tool-profile.js";';
    const multi =
      '// biome-ignore lint/plugin: hands it on\nimport type {\n  AiToolProfile,\n} from "../tools/contract/tool-profile.js";';
    const bare = 'import type { AiToolProfile } from "../tools/contract/tool-profile.js";';
    expect(HANDS_PROFILE_ON.test(single)).toBe(true);
    expect(HANDS_PROFILE_ON.test(multi)).toBe(true);
    expect(HANDS_PROFILE_ON.test(bare)).toBe(false);
  });

  it("leaves out the tools context and the composition root", () => {
    const call = "tools.aiProfile('x');";
    expect(
      profileReaders({
        "src/a.ts": call,
        "src/contexts/tools/x.ts": call,
        "src/composition/c.ts": call,
      }).readers
    ).toEqual(["src/a.ts"]);
  });
});

describe("a reader names the sections of a tool it reads: the flow reading", () => {
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

  it("reports a reader of a planted project as a profile violation of its file", () => {
    const dir = mkdtempSync(join(tmpdir(), "aidd-profile-flow-"));
    try {
      const texts = project("whole(tools.aiProfile('x'));");
      for (const [path, text] of Object.entries(texts)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            noLib: true,
            types: [],
            module: "esnext",
            moduleResolution: "bundler",
          },
          files: Object.keys(texts),
        })
      );
      expect(entries(profileViolations(texts, dir))).toEqual(["src/contexts/b/caller.ts"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
