import type {
  CliRelease,
  CliReleaseSource,
} from "../../../../src/contexts/update/ports/cli-release-source.js";

/** A release source that answers one release, or fails with one error; counts its asks. */
export class FakeCliReleaseSource implements CliReleaseSource {
  asked = 0;

  constructor(
    private readonly answer: CliRelease | Error = { version: "2.0.0", changelog: null }
  ) {}

  async fetchLatestRelease(): Promise<CliRelease> {
    this.asked += 1;
    if (this.answer instanceof Error) throw this.answer;
    return this.answer;
  }
}
