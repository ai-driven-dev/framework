import { PlatformAdapter } from "../../../../src/contexts/installation/infrastructure/platform-adapter.js";
import { FakePlatform } from "../../../helpers/ports/fake-platform.js";
import { describePlatformContract } from "../testing/platform-contract.js";

describePlatformContract("by the fake", () => ({
  platform: new FakePlatform("win32"),
  expected: "win32",
}));

describePlatformContract("by PlatformAdapter", () => ({
  platform: new PlatformAdapter(),
  expected: process.platform,
}));
