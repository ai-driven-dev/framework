import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import {
  type KiloChatRequest,
  type KiloChatTool,
  type LocalModelReply,
  localModel,
} from "./helpers/kilo-local-model.js";
import { createTestEnv, execFileAsync } from "./helpers.js";

const describeNative = process.env.KILO_NATIVE_GENERATION === "1" ? describe : describe.skip;
const fixtures = join(REPOSITORY_ROOT, "cli", "tests", "e2e", "fixtures", "kilo-native-generation");
const skill = join(fixtures, ".kilo", "skills", "verify-payload");
const codeFence = "```";
const phase6GeneratedSkill = {
  "SKILL.md": `---
name: verify-payload
description: Reads the bundled payload file and replies with its exact content. Use when the user wants to verify the payload or retrieve the contents of assets/payload.txt.
---

# Verify Payload

${codeFence}mermaid
flowchart LR
  start([request]) --> verify --> done([payload content returned])
${codeFence}

## Actions

Read [01-verify.md](actions/01-verify.md) to run the verify action.

| Action | Does |
| --- | --- |
| verify | read the payload and reply with its content |
`,
  "actions/01-verify.md": `# 01 - Verify

## Input

The bundled payload file.

## Output

A reply containing the exact payload file content.

## Process

1. **Read.** Read [payload.txt](../assets/payload.txt) relative to this action file.
2. **Reply.** Return the complete content exactly as read, preserving whitespace and adding no commentary or formatting.

## Test

| Case | Pass |
| --- | --- |
| Run verify with the bundled payload | The reply matches the content of the payload file exactly |
`,
  "assets/payload.txt": "PHASE6_SYNTHETIC_PAYLOAD\n",
} as const;
const phase6ArtifactHashes: Record<keyof typeof phase6GeneratedSkill, string> = {
  "SKILL.md": "ad472e5fa9663cc9a291525d8b9528e07d05411680a1eca9f9183dfab3185945",
  "actions/01-verify.md": "583404c6f75ae05db061fbfbe90f0688636aba574ae832ec565282b056a7e534",
  "assets/payload.txt": "e201189cdbacfb224377377efa94b45898c37abdf2145efa36a8926af772a5d7",
};

type ToolParameter = { type?: string; description?: string; enum?: unknown[] };
type ObjectParameters = {
  properties?: Record<string, ToolParameter>;
  required?: string[];
};

function toolByName(request: KiloChatRequest, name: string): KiloChatTool | undefined {
  return request.tools?.find((tool) => tool.function.name === name);
}

function stringArgument(
  tool: KiloChatTool,
  value: string,
  fieldPattern: RegExp
): Record<string, string> {
  const schema = tool.function.parameters as ObjectParameters | undefined;
  const properties = schema?.properties ?? {};
  const required = schema?.required ?? [];
  const candidates = Object.entries(properties).filter(([key, property]) => {
    const described = `${key} ${property.description ?? ""}`;
    return property.type === "string" && fieldPattern.test(described);
  });
  const matchingEnum = candidates.find(([, property]) => property.enum?.includes(value));
  const field = matchingEnum?.[0] ?? (candidates.length === 1 ? candidates[0][0] : undefined);
  if (field === undefined || required.some((name) => name !== field)) {
    throw new Error(
      `Unrecognized Kilo ${tool.function.name} tool schema: ${JSON.stringify(tool.function.parameters)}`
    );
  }
  return { [field]: value };
}

function textLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textLeaves);
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    const text = typeof object.text === "string" ? [object.text] : [];
    return [
      ...text,
      ...Object.entries(object)
        .filter(([key]) => key !== "text")
        .flatMap(([, nested]) => textLeaves(nested)),
    ];
  }
  return [];
}

function toolResult(request: KiloChatRequest, id: string): string | undefined {
  const message = request.messages.find(
    (candidate) => candidate.role === "tool" && candidate.tool_call_id === id
  );
  return message === undefined ? undefined : textLeaves(message.content).join("\n");
}

function outputStrings(output: string): string[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return textLeaves(JSON.parse(line));
      } catch {
        return [line];
      }
    });
}

describeNative("E2E: saved native generation in Kilo", () => {
  it("merges coexisting project instructions and deduplicates identical references", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv(
      "kilo-config-instruction-merge"
    );
    const rootMarker = "KILO_ROOT_CONFIG_RULE_914";
    const nestedMarker = "KILO_NESTED_CONFIG_RULE_914";
    const duplicateMarker = "KILO_DUPLICATE_CONFIG_RULE_914";
    const scenarios = [
      {
        name: "both-configs",
        root: [".kilo/rules/01-standards/1-root.md"],
        nested: [".kilo/rules/01-standards/2-nested.md"],
        expected: { root: 1, nested: 1, duplicate: 0 },
      },
      {
        name: "root-empty",
        root: [],
        nested: [".kilo/rules/01-standards/2-nested.md"],
        expected: { root: 0, nested: 1, duplicate: 0 },
      },
      {
        name: "nested-empty",
        root: [".kilo/rules/01-standards/1-root.md"],
        nested: [],
        expected: { root: 1, nested: 0, duplicate: 0 },
      },
      {
        name: "duplicate-reference",
        root: [".kilo/rules/01-standards/3-duplicate.md"],
        nested: [".kilo/rules/01-standards/3-duplicate.md"],
        expected: { root: 0, nested: 0, duplicate: 1 },
      },
    ] as const;
    let currentScenario = "";
    const observations: Array<{
      scenario: string;
      root: number;
      nested: number;
      duplicate: number;
    }> = [];
    let model: Awaited<ReturnType<typeof localModel>> | undefined;
    try {
      const xdg = join(tempDir, "xdg");
      const env = {
        ...process.env,
        HOME: fakeHome,
        XDG_CONFIG_HOME: join(xdg, "config"),
        XDG_DATA_HOME: join(xdg, "data"),
        XDG_STATE_HOME: join(xdg, "state"),
        XDG_CACHE_HOME: join(xdg, "cache"),
        KILO_PURE: "1",
        KILO_DISABLE_EXTERNAL_SKILLS: "true",
      };
      for (const name of ["config", "data", "state", "cache"]) {
        await mkdir(join(xdg, name), { recursive: true });
      }
      const localModelProvider = await localModel({
        respond(request) {
          const systemMessages = request.messages
            .filter((message) => message.role === "system")
            .map((message) => JSON.stringify(message.content))
            .join("\n");
          const count = (marker: string) => systemMessages.split(marker).length - 1;
          const observed = {
            scenario: currentScenario,
            root: count(rootMarker),
            nested: count(nestedMarker),
            duplicate: count(duplicateMarker),
          };
          observations.push(observed);
          return {
            content: `KILO_CONFIG_${observed.scenario}:root=${observed.root};nested=${observed.nested};duplicate=${observed.duplicate}`,
          };
        },
      });
      model = localModelProvider;

      const kilo = async (directory: string, ...args: string[]) => {
        const result = await execFileAsync("kilo", args, {
          cwd: directory,
          env,
          timeout: 30000,
          maxBuffer: 8 * 1024 * 1024,
        });
        return result.stdout;
      };
      expect((await kilo(projectDir, "--version")).trim()).toBe("7.7.5");

      for (const scenario of scenarios) {
        currentScenario = scenario.name;
        const directory = join(projectDir, scenario.name);
        const rules = join(directory, ".kilo", "rules", "01-standards");
        const scenarioXdg = join(xdg, scenario.name);
        await mkdir(rules, { recursive: true });
        for (const name of ["config", "data", "state", "cache"]) {
          await mkdir(join(scenarioXdg, name), { recursive: true });
        }
        await writeFile(join(rules, "1-root.md"), `# Root rule\n${rootMarker}\n`);
        await writeFile(join(rules, "2-nested.md"), `# Nested rule\n${nestedMarker}\n`);
        await writeFile(join(rules, "3-duplicate.md"), `# Shared rule\n${duplicateMarker}\n`);
        await writeFile(
          join(directory, "kilo.jsonc"),
          JSON.stringify({ instructions: scenario.root })
        );
        await writeFile(
          join(directory, ".kilo", "kilo.jsonc"),
          JSON.stringify({
            instructions: scenario.nested,
            model: "openai-compatible/fake",
            provider: {
              "openai-compatible": {
                options: { baseURL: localModelProvider.url },
                models: {
                  fake: {
                    name: "Local deterministic config merge test",
                    tool_call: true,
                    limit: { context: 8192, output: 256 },
                  },
                },
              },
            },
          })
        );

        const scenarioEnv = {
          ...env,
          XDG_CONFIG_HOME: join(scenarioXdg, "config"),
          XDG_DATA_HOME: join(scenarioXdg, "data"),
          XDG_STATE_HOME: join(scenarioXdg, "state"),
          XDG_CACHE_HOME: join(scenarioXdg, "cache"),
        };
        const result = await execFileAsync(
          "kilo",
          [
            "run",
            "--pure",
            "--dir",
            directory,
            "--format",
            "json",
            "--auto",
            "--model",
            "openai-compatible/fake",
            "Return the observed instruction counts.",
          ],
          {
            cwd: directory,
            env: scenarioEnv,
            timeout: 30000,
            maxBuffer: 8 * 1024 * 1024,
          }
        );
        const expected = scenario.expected;
        const answer = `KILO_CONFIG_${scenario.name}:root=${expected.root};nested=${expected.nested};duplicate=${expected.duplicate}`;
        expect(outputStrings(result.stdout)).toContain(answer);
        expect(observations.filter((item) => item.scenario === scenario.name)).toEqual([
          { scenario: scenario.name, ...expected },
        ]);
      }
    } finally {
      const server = model?.server;
      if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
      await cleanup();
    }
  }, 180000);

  it("loads the native skill, follows its action, and answers from the read payload", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv(
      "kilo-native-skill-consumption"
    );
    const observations: {
      skillParameters?: unknown;
      skillResult?: string;
      toolMessagesAfterAction?: Array<{ id?: string; name?: string; text: string }>;
      actionResult?: string;
      payloadResult?: string;
      finalAnswer?: string;
      skillArguments?: Record<string, string>;
      negativeSkillResult?: string;
      negativeFailureStage?: string;
      negativeReadCalls: number;
    } = { negativeReadCalls: 0 };
    let positiveModel: Awaited<ReturnType<typeof localModel>> | undefined;
    let negativeModel: Awaited<ReturnType<typeof localModel>> | undefined;
    try {
      const xdg = join(tempDir, "xdg");
      const env = {
        ...process.env,
        HOME: fakeHome,
        XDG_CONFIG_HOME: join(xdg, "config"),
        XDG_DATA_HOME: join(xdg, "data"),
        XDG_STATE_HOME: join(xdg, "state"),
        XDG_CACHE_HOME: join(xdg, "cache"),
        KILO_PURE: "1",
        KILO_DISABLE_EXTERNAL_SKILLS: "true",
        KILO_DISABLE_SKILL_SHELL: "true",
      };
      for (const name of ["config", "data", "state", "cache"]) {
        await mkdir(join(xdg, name), { recursive: true });
      }
      const kilo = async (...args: string[]) => {
        const result = await execFileAsync("kilo", args, {
          cwd: projectDir,
          env,
          timeout: 30000,
          maxBuffer: 8 * 1024 * 1024,
        });
        return result.stdout;
      };
      const configureModel = async (baseURL: string) =>
        writeFile(
          join(projectDir, "kilo.jsonc"),
          JSON.stringify({
            model: "openai-compatible/fake",
            provider: {
              "openai-compatible": {
                options: { baseURL },
                models: {
                  fake: {
                    name: "Local deterministic phase 6 test",
                    tool_call: true,
                    limit: { context: 8192, output: 256 },
                  },
                },
              },
            },
            permission: {
              "*": "deny",
              external_directory: "deny",
              // The isolated workspace contains only this skill, its payload and config.
              // External paths, commands and all non-skill tools remain denied.
              read: "allow",
              skill: { "*": "deny", "verify-payload": "allow" },
            },
          })
        );
      expect((await kilo("--version")).trim()).toBe("7.7.5");

      const skillDir = join(projectDir, ".kilo", "skills", "verify-payload");
      const actionPath = ".kilo/skills/verify-payload/actions/01-verify.md";
      const payloadPath = ".kilo/skills/verify-payload/assets/payload.txt";
      for (const [relative, content] of Object.entries(phase6GeneratedSkill)) {
        const path = join(skillDir, relative);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content);
        expect(createHash("sha256").update(content).digest("hex")).toBe(
          phase6ArtifactHashes[relative as keyof typeof phase6ArtifactHashes]
        );
      }
      const payloadMarker = `PHASE6_KILO_PAYLOAD_${randomUUID()}`;
      await writeFile(join(skillDir, "assets", "payload.txt"), `${payloadMarker}\n`);
      const catalog = JSON.parse(await kilo("debug", "skill", "--pure")) as Array<{
        name: string;
        location?: string;
      }>;
      expect(catalog.filter((entry) => entry.name === "verify-payload")).toHaveLength(1);
      expect(
        catalog.find((entry) => entry.name === "verify-payload")?.location?.replaceAll("\\", "/")
      ).toContain(".kilo/skills/verify-payload/SKILL.md");

      let positiveStage = "skill";
      positiveModel = await localModel({
        respond(request): LocalModelReply {
          if (positiveStage === "skill") {
            const skillTool = toolByName(request, "skill");
            if (skillTool === undefined) return { content: "PHASE6_SKILL_TOOL_UNAVAILABLE" };
            observations.skillParameters = skillTool.function.parameters;
            observations.skillArguments = stringArgument(
              skillTool,
              "verify-payload",
              /skill|name/i
            );
            positiveStage = "router";
            return {
              toolCall: {
                id: "phase6_skill",
                name: skillTool.function.name,
                arguments: observations.skillArguments,
              },
            };
          }
          if (positiveStage === "router") {
            observations.skillResult = toolResult(request, "phase6_skill");
            if (
              observations.skillResult === undefined ||
              !observations.skillResult.includes("# Verify Payload") ||
              !observations.skillResult.includes("01-verify.md")
            ) {
              return { content: "PHASE6_ROUTER_LOAD_FAILED" };
            }
            const readTool = toolByName(request, "read");
            if (readTool === undefined) return { content: "PHASE6_READ_TOOL_UNAVAILABLE" };
            positiveStage = "action";
            return {
              toolCall: {
                id: "phase6_action",
                name: readTool.function.name,
                arguments: stringArgument(readTool, actionPath, /path|file/i),
              },
            };
          }
          if (positiveStage === "action") {
            observations.toolMessagesAfterAction = request.messages
              .filter((message) => message.role === "tool")
              .map((message) => ({
                id: message.tool_call_id,
                name: message.name,
                text: textLeaves(message.content).join("\n").slice(0, 1200),
              }));
            observations.actionResult = toolResult(request, "phase6_action");
            if (
              observations.actionResult === undefined ||
              !observations.actionResult.includes("payload.txt") ||
              !observations.actionResult.includes("complete content exactly as read")
            ) {
              return { content: "PHASE6_ACTION_LOAD_FAILED" };
            }
            const readTool = toolByName(request, "read");
            if (readTool === undefined) return { content: "PHASE6_READ_TOOL_UNAVAILABLE" };
            positiveStage = "payload";
            return {
              toolCall: {
                id: "phase6_payload",
                name: readTool.function.name,
                arguments: stringArgument(readTool, payloadPath, /path|file/i),
              },
            };
          }
          observations.payloadResult = toolResult(request, "phase6_payload");
          const marker = observations.payloadResult?.match(/PHASE6_KILO_PAYLOAD_[0-9a-f-]+/i)?.[0];
          if (marker === undefined) return { content: "PHASE6_PAYLOAD_READ_FAILED" };
          observations.finalAnswer = `${marker}\n`;
          positiveStage = "done";
          return { content: observations.finalAnswer };
        },
      });
      await configureModel(positiveModel.url);
      const filesBeforeRun = (await readdir(projectDir, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => join(relative(projectDir, entry.parentPath), entry.name))
        .sort();
      expect(filesBeforeRun).toEqual(
        [
          ".kilo/.gitignore",
          ".kilo/skills/verify-payload/SKILL.md",
          ".kilo/skills/verify-payload/actions/01-verify.md",
          ".kilo/skills/verify-payload/assets/payload.txt",
          "kilo.jsonc",
        ].sort()
      );
      const positive = await kilo(
        "run",
        "--pure",
        "--dir",
        projectDir,
        "--format",
        "json",
        "--model",
        "openai-compatible/fake",
        "Use the verify-payload skill and follow its verify action. Read its bundled payload and return only the exact content."
      );
      expect(observations.skillParameters).toBeDefined();
      expect(observations.skillResult).toContain("# Verify Payload");
      expect(
        observations.actionResult,
        JSON.stringify(observations.toolMessagesAfterAction)
      ).toContain("complete content exactly as read");
      expect(observations.payloadResult).toContain(payloadMarker);
      expect(observations.finalAnswer).toBe(`${payloadMarker}\n`);
      expect(outputStrings(positive)).toContain(`${payloadMarker}\n`);
      expect(
        positiveModel.replies.map((reply) => ("toolCall" in reply ? reply.toolCall.name : "final"))
      ).toEqual(["skill", "read", "read", "final"]);

      await rm(skillDir, { recursive: true });
      const negativeCatalog = JSON.parse(await kilo("debug", "skill", "--pure")) as Array<{
        name: string;
      }>;
      expect(negativeCatalog.some((entry) => entry.name === "verify-payload")).toBe(false);
      let negativeStage = "skill";
      negativeModel = await localModel({
        respond(request): LocalModelReply {
          if (negativeStage === "skill") {
            const skillTool = toolByName(request, "skill");
            if (skillTool === undefined || observations.skillArguments === undefined) {
              observations.negativeFailureStage = "skill-unavailable";
              return { content: "PHASE6_NEGATIVE_SKILL_UNAVAILABLE" };
            }
            negativeStage = "result";
            return {
              toolCall: {
                id: "phase6_negative_skill",
                name: skillTool.function.name,
                arguments: observations.skillArguments,
              },
            };
          }
          observations.negativeSkillResult = toolResult(request, "phase6_negative_skill");
          observations.negativeFailureStage = "skill-load-absent";
          observations.negativeReadCalls =
            negativeModel?.replies.filter(
              (reply) => "toolCall" in reply && reply.toolCall.name === "read"
            ).length ?? 0;
          return { content: "PHASE6_NEGATIVE_SKILL_LOAD_FAILED" };
        },
      });
      await configureModel(negativeModel.url);
      const negative = await kilo(
        "run",
        "--pure",
        "--dir",
        projectDir,
        "--format",
        "json",
        "--model",
        "openai-compatible/fake",
        "Use the verify-payload skill and follow its verify action. Read its bundled payload and return only the exact content."
      );
      expect(observations.negativeFailureStage).toBe("skill-load-absent");
      expect(observations.negativeSkillResult).toBeDefined();
      expect(observations.negativeSkillResult).toMatch(
        /not found|unknown skill|unavailable|does not exist|could not load/i
      );
      expect(observations.negativeSkillResult).not.toContain("# Verify Payload");
      expect(observations.negativeReadCalls).toBe(0);
      expect(negative).not.toContain(payloadMarker);
      expect(
        negativeModel.replies.map((reply) => ("toolCall" in reply ? reply.toolCall.name : "final"))
      ).toEqual(["skill", "final"]);
      expect(new URL(positiveModel.url).hostname).toBe("127.0.0.1");
      expect(new URL(negativeModel.url).hostname).toBe("127.0.0.1");
    } finally {
      for (const model of [positiveModel, negativeModel]) {
        if (model !== undefined) {
          model.server.closeAllConnections();
          await new Promise<void>((resolve, reject) =>
            model.server.close((error) => (error ? reject(error) : resolve()))
          );
        }
      }
      await cleanup();
    }
  }, 120000);

  it("loads checked-in skill, rule, agent and workflow fixtures without changing memory", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } =
      await createTestEnv("kilo-native-generation");
    try {
      const xdg = join(tempDir, "xdg");
      const env = {
        ...process.env,
        HOME: fakeHome,
        XDG_CONFIG_HOME: join(xdg, "config"),
        XDG_DATA_HOME: join(xdg, "data"),
        XDG_STATE_HOME: join(xdg, "state"),
        XDG_CACHE_HOME: join(xdg, "cache"),
      };
      for (const name of ["config", "data", "state", "cache"]) {
        await mkdir(join(xdg, name), { recursive: true });
      }
      const kilo = async (...args: string[]) => {
        const result = await execFileAsync("kilo", args, {
          cwd: projectDir,
          env,
          timeout: 30000,
          maxBuffer: 8 * 1024 * 1024,
        });
        return result.stdout;
      };
      expect((await kilo("--version")).trim()).toBe("7.7.5");

      const fixtureManifest = JSON.parse(
        await readFile(join(fixtures, "manifest.json"), "utf8")
      ) as Record<string, string>;
      for (const [relative, expectedHash] of Object.entries(fixtureManifest)) {
        const source = await readFile(join(fixtures, relative));
        expect(createHash("sha256").update(source).digest("hex")).toBe(expectedHash);
      }

      const savedAgent = join(fixtures, ".kilo", "agents");
      const savedCommand = join(fixtures, ".kilo", "commands");
      const savedRule = join(fixtures, ".kilo", "rules", "01-standards", "1-naming.md");
      const rule = join(projectDir, ".kilo", "rules", "01-standards", "1-naming.md");
      await cp(join(fixtures, "AGENTS.md"), join(projectDir, "AGENTS.md"));
      await mkdir(join(projectDir, "aidd_docs", "memory"), { recursive: true });
      await cp(
        join(fixtures, "aidd_docs", "memory", "architecture.md"),
        join(projectDir, "aidd_docs", "memory", "architecture.md")
      );
      await cp(skill, join(projectDir, ".kilo", "skills", "verify-payload"), { recursive: true });
      await cp(savedAgent, join(projectDir, ".kilo", "agents"), { recursive: true });
      await cp(savedCommand, join(projectDir, ".kilo", "commands"), { recursive: true });
      await mkdir(join(projectDir, ".kilo", "rules", "01-standards"), { recursive: true });
      await cp(savedRule, rule);
      await cp(join(fixtures, ".kilo", "kilo.jsonc"), join(projectDir, ".kilo", "kilo.jsonc"));

      for (const relative of Object.keys(fixtureManifest)) {
        if (relative === "negative-config.jsonc") continue;
        expect(await readFile(join(projectDir, relative))).toEqual(
          await readFile(join(fixtures, relative))
        );
      }
      expect(await readFile(rule)).toEqual(await readFile(savedRule));

      const config = JSON.parse(await kilo("debug", "config", "--pure")) as {
        instructions?: string[];
        agent?: Record<string, { prompt?: string }>;
        command?: Record<string, { template?: string; agent?: string }>;
      };
      expect(config.instructions).toContain(".kilo/rules/01-standards/1-naming.md");
      expect(config.agent?.["verify-agent"]?.prompt).toContain("agent-payload.txt");
      expect(config.command?.["verify-workflow"]?.agent).toBe("verify-agent");
      expect(config.command?.["verify-workflow"]?.template).toContain("verify-agent");
      const catalog = JSON.parse(await kilo("debug", "skill", "--pure")) as Array<{
        name: string;
        location?: string;
      }>;
      expect(catalog.filter((entry) => entry.name === "verify-payload")).toHaveLength(1);
      expect(
        catalog.find((entry) => entry.name === "verify-payload")?.location?.replaceAll("\\", "/")
      ).toContain(".kilo/skills/verify-payload/SKILL.md");

      // The local backend captures what real Kilo sends and completes a read
      // turn. It proves loading and tool use, not reasoning by an external model.
      const model = await localModel("aidd_docs/memory/architecture.md");
      try {
        await writeFile(
          join(projectDir, "kilo.jsonc"),
          JSON.stringify({
            model: "openai-compatible/fake",
            provider: {
              "openai-compatible": {
                options: { baseURL: model.url },
                models: {
                  fake: {
                    name: "Local fake",
                    tool_call: true,
                    limit: { context: 8192, output: 256 },
                  },
                },
              },
            },
          })
        );
        const positive = await kilo(
          "run",
          "--pure",
          "--dir",
          projectDir,
          "--format",
          "json",
          "--auto",
          "--model",
          "openai-compatible/fake",
          "Read the project memory."
        );
        expect(positive).toContain("KILO_LOCAL_READ_CONFIRMED");
        expect(JSON.stringify(model.requests)).toContain("COBALT_914");
        expect(JSON.stringify(model.requests)).toContain(
          "User content must survive sync unchanged"
        );
        expect(model.requests.flatMap((request) => request.messages)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: "tool",
              content: expect.stringContaining("MEMORY_APPLIED:prune-6842"),
            }),
          ])
        );

        const beforeNegative = model.requests.length;
        await cp(join(fixtures, "negative-config.jsonc"), join(projectDir, ".kilo", "kilo.jsonc"));
        await rm(join(projectDir, ".kilo", "skills", "verify-payload"), { recursive: true });
        await rm(join(projectDir, ".kilo", "agents"), { recursive: true });
        await rm(join(projectDir, ".kilo", "commands"), { recursive: true });
        await kilo(
          "run",
          "--pure",
          "--dir",
          projectDir,
          "--format",
          "json",
          "--auto",
          "--model",
          "openai-compatible/fake",
          "Check the project context again."
        );
        expect(model.requests.length).toBeGreaterThan(beforeNegative);
        expect(JSON.stringify(model.requests.slice(beforeNegative))).not.toContain("COBALT_914");
      } finally {
        model.server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          model.server.close((error) => (error ? reject(error) : resolve()))
        );
      }
      const negativeConfig = JSON.parse(await kilo("debug", "config", "--pure")) as {
        instructions?: string[];
        agent?: Record<string, unknown>;
        command?: Record<string, unknown>;
      };
      expect(negativeConfig.instructions ?? []).not.toContain(
        ".kilo/rules/01-standards/1-naming.md"
      );
      expect(negativeConfig.agent ?? {}).not.toHaveProperty("verify-agent");
      expect(negativeConfig.command ?? {}).not.toHaveProperty("verify-workflow");
      const negativeCatalog = JSON.parse(await kilo("debug", "skill", "--pure")) as Array<{
        name: string;
      }>;
      expect(negativeCatalog.some((entry) => entry.name === "verify-payload")).toBe(false);
      expect(await readFile(rule)).toEqual(await readFile(savedRule));
      expect(await readFile(join(projectDir, "AGENTS.md"))).toEqual(
        await readFile(join(fixtures, "AGENTS.md"))
      );
      expect(await readFile(join(projectDir, "aidd_docs", "memory", "architecture.md"))).toEqual(
        await readFile(join(fixtures, "aidd_docs", "memory", "architecture.md"))
      );
    } finally {
      await cleanup();
    }
  }, 180000);
});
