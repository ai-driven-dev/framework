import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRAMEWORK_REPO,
  remoteFrameworkSource,
} from "../../../../src/contexts/distribution/contract/framework-source.js";

describe("naming the framework's remote source", () => {
  it("names the framework's own repository, at its tip, when given nothing", () => {
    expect(DEFAULT_FRAMEWORK_REPO).toBe("ai-driven-dev/framework");
    expect(remoteFrameworkSource()).toStrictEqual({
      kind: "github",
      repo: DEFAULT_FRAMEWORK_REPO,
      ref: undefined,
    });
  });
});
