import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { wireTools } from "../../../src/composition/contexts/tools.js";
import { supportedBuildTargets } from "../../../src/contexts/translate/contract/build-targets.js";
import { bindOutput } from "../../../src/presentation/controllers/menu/global-options.controller.js";
import { registerTranslateCommand } from "../../../src/presentation/controllers/translate.controller.js";
import { processOutputFactory } from "../../shared/testing/output-factory.builder.js";

/**
 * The help text names targets in prose nothing derives, while the validation beside it reads
 * the profiles. Asserting the set, not the sentence, leaves the wording free.
 */
const noContainer = async () => {
  throw new Error("help builds no container");
};

describe("translate --to help text", () => {
  it("names exactly the targets the command accepts", () => {
    const tools = wireTools();
    const targets: readonly string[] = supportedBuildTargets(tools);
    const program = new Command();
    bindOutput(program, processOutputFactory());
    registerTranslateCommand(program, tools, noContainer);

    const translate = program.commands.find((command) => command.name() === "translate");
    const description = translate?.options.find((option) => option.long === "--to")?.description;

    const named = [...(description ?? "").matchAll(/[a-z][a-z-]+/g)]
      .map((match) => match[0])
      .filter((word) => targets.includes(word));

    expect([...named].sort()).toEqual([...targets].sort());
  });
});
