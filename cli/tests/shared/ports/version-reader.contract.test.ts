import { CurrentVersionAdapter } from "../../../src/shared/infrastructure/current-version-adapter.js";
import { FakeCurrentVersion } from "../testing/fake-current-version.js";
import { describeVersionReaderContract } from "../testing/run-version-reader-contract.js";

describeVersionReaderContract("the fake", () => new FakeCurrentVersion());

describeVersionReaderContract("the bundled package version", () => new CurrentVersionAdapter());
