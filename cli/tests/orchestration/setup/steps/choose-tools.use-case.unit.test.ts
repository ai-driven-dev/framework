import { describe, expect, it } from "vitest";
import { ChooseTools } from "../../../../src/orchestration/setup/steps/choose-tools.use-case.js";
import { ScriptedPrompter } from "../../../shared/testing/scripted-prompter.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("ChooseTools", () => {
  describe("non-interactive mode", () => {
    it("returns flow tools unchanged without prompting", async () => {
      const prompter = new ScriptedPrompter([]); // no prompts expected
      const useCase = new ChooseTools(prompter, syntheticMixedCatalog());

      const result = await useCase.execute({
        interactive: false,
        aiTools: [],
        ideTools: [],
      });

      expect(result.aiTools).toEqual([]);
      expect(result.ideTools).toEqual([]);
    });
  });

  describe("interactive mode with tools already provided", () => {
    it("returns provided tools without prompting when flags given", async () => {
      const prompter = new ScriptedPrompter([]); // no prompts expected
      const useCase = new ChooseTools(prompter, syntheticMixedCatalog());

      const result = await useCase.execute({
        interactive: true,
        aiTools: [SECOND_SYNTHETIC_TOOL],
        ideTools: [],
      });

      expect(result.aiTools).toEqual([SECOND_SYNTHETIC_TOOL]);
      expect(result.ideTools).toEqual([]);
    });

    it("returns provided ide tools without prompting", async () => {
      const prompter = new ScriptedPrompter([]); // no prompts expected
      const useCase = new ChooseTools(prompter, syntheticMixedCatalog());

      const result = await useCase.execute({
        interactive: true,
        aiTools: [],
        ideTools: [SYNTHETIC_IDE_TOOL],
      });

      expect(result.aiTools).toEqual([]);
      expect(result.ideTools).toEqual([SYNTHETIC_IDE_TOOL]);
    });
  });

  describe("interactive mode with no tools provided", () => {
    it("prompts and returns user-selected tools", async () => {
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.checkbox([SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL]),
        ScriptedPrompter.answer.checkbox([SYNTHETIC_IDE_TOOL]),
      ]);
      const useCase = new ChooseTools(prompter, syntheticMixedCatalog());

      const result = await useCase.execute({
        interactive: true,
        aiTools: [],
        ideTools: [],
      });

      expect(result.aiTools).toEqual([SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL]);
      expect(result.ideTools).toEqual([SYNTHETIC_IDE_TOOL]);
    });

    it("prompts and returns empty arrays when user selects nothing", async () => {
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.checkbox([]),
        ScriptedPrompter.answer.checkbox([]),
      ]);
      const useCase = new ChooseTools(prompter, syntheticMixedCatalog());

      const result = await useCase.execute({
        interactive: true,
        aiTools: [],
        ideTools: [],
      });

      expect(result.aiTools).toEqual([]);
      expect(result.ideTools).toEqual([]);
    });
  });
});
