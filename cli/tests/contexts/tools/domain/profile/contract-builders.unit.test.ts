import { describe, expect, it, vi } from "vitest";
import { CapabilityConfigError } from "../../../../../src/contexts/tools/contract/errors/tools.error.js";
import {
  contract,
  contractOf,
  tomlContract,
} from "../../../../../src/contexts/tools/domain/profile/contract-builders.js";
import { SmolTomlCodec } from "../../../../../src/shared/infrastructure/smol-toml-codec.adapter.js";
import { anEmptyContract } from "../../../../shared/testing/empty-build-contract.builder.js";

describe("a build contract a profile declares through its builder", () => {
  it("hands the builder its arguments on first ask, never before", () => {
    const build = vi.fn((_layout: string) => anEmptyContract());
    const built = contractOf(contract(build, "flat/"), {});

    expect(build).not.toHaveBeenCalled();
    built();
    expect(build).toHaveBeenCalledWith("flat/");
  });

  it("hands a TOML builder the codec the composition wired, ahead of its arguments", () => {
    const toml = new SmolTomlCodec();
    const build = vi.fn((_codec: SmolTomlCodec, _layout: string) => anEmptyContract());

    contractOf(tomlContract(build, "flat/"), { toml })();

    expect(build).toHaveBeenCalledWith(toml, "flat/");
  });

  it("refuses a TOML builder when no codec was wired", () => {
    const built = contractOf(
      tomlContract(() => anEmptyContract()),
      {}
    );
    expect(built).toThrow(CapabilityConfigError);
  });

  it("passes a contract already built elsewhere through unchanged", () => {
    const prebuilt = () => anEmptyContract();
    expect(contractOf(prebuilt, {})).toBe(prebuilt);
  });
});
