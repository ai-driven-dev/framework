import { ConfigSection } from "../../../../src/contexts/tools/domain/sections/config-section.js";
import { InvalidToolProfileError } from "../../../../src/contexts/tools/domain/tools.error.js";
import { anEmptyContract } from "../../../shared/testing/empty-build-contract.builder.js";

export const settings = new ConfigSection({
  outputPath: ".x/settings.json",
  mergeStrategy: "none",
});

export const aiSpec = {
  toolId: "claude" as const,
  directory: ".x/",
  toolSuffix: ".claude.md",
  signalDir: null,
  displayName: "X",
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({}),
  linkSyntax: [],
};

export const ideSpec = {
  toolId: "vscode" as const,
  directory: ".x/",
  signalDir: null,
  capabilities: () => ({}),
};

export function refusalOf(build: () => unknown): InvalidToolProfileError {
  try {
    build();
  } catch (error) {
    if (error instanceof InvalidToolProfileError) return error;
    throw error;
  }
  throw new Error("the profile was accepted");
}
