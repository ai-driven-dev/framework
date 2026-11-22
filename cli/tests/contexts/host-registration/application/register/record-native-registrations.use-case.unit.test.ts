import { describe, expect, it } from "vitest";
import {
  RecordNativeRegistrations,
  type RegistrationRecordBook,
} from "../../../../../src/contexts/host-registration/application/register/record-native-registrations.use-case.js";
import type { HostRegistrationOutcome } from "../../../../../src/contexts/host-registration/application/register/registration-outcome.js";
import type { RegistrationRecordData } from "../../../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const { claude } = TOOL;

const outcome = (pluginRefs: string[]): HostRegistrationOutcome => ({
  marketplaces: [],
  preservedMarketplaces: [],
  catalogClaims: [],
  pluginRefs,
  buildFailed: false,
});

function bookOf(initial: Map<ToolId, RegistrationRecordData> = new Map()) {
  const held = new Map(initial);
  const book: RegistrationRecordBook = {
    get: (toolId) => held.get(toolId),
    set: (toolId, record) => void held.set(toolId, record),
  };
  return { book, held };
}

describe("recording native registrations", () => {
  const record = new RecordNativeRegistrations(registeredTools());

  it("records what a tool's host registered, then reports no change for the same outcome", () => {
    const { book, held } = bookOf();
    const activated = new Map([[claude, outcome(["plug@host"])]]);

    expect(record.execute({ records: book, activated, narrowed: false })).toBe(true);
    expect(held.get(claude)).toMatchObject({ pluginRefs: ["plug@host"] });
    expect(record.execute({ records: book, activated, narrowed: false })).toBe(false);
  });

  it("records nothing for a tool with no native activation", () => {
    const { book, held } = bookOf();
    const { cursor: unactivated } = TOOL;

    const changed = record.execute({
      records: book,
      activated: new Map([[unactivated, outcome(["plug@host"])]]),
      narrowed: false,
    });

    expect(changed).toBe(false);
    expect(held.size).toBe(0);
  });
});
