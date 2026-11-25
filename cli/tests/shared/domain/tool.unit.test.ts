import { describe, expectTypeOf, it } from "vitest";
import type { AiToolId, IdeToolId, ToolId } from "../../../src/shared/domain/tool.js";

describe("tool ids", () => {
  it("accepts no plain string as a tool id", () => {
    expectTypeOf<string>().not.toExtend<AiToolId>();
    expectTypeOf<string>().not.toExtend<IdeToolId>();
  });

  it("keeps the ai and ide ids apart", () => {
    expectTypeOf<AiToolId>().not.toExtend<IdeToolId>();
    expectTypeOf<IdeToolId>().not.toExtend<AiToolId>();
  });

  it("reads an ai id and an ide id as a tool id", () => {
    expectTypeOf<AiToolId>().toExtend<ToolId>();
    expectTypeOf<IdeToolId>().toExtend<ToolId>();
  });
});
