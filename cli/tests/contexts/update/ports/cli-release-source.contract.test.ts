import { createServer, type Server } from "node:http";
import { FrameworkResolutionError } from "../../../../src/contexts/update/domain/update.error.js";
import { NpmRegistryReleaseAdapter } from "../../../../src/contexts/update/infrastructure/npm-registry-release-adapter.js";
import { GitHubAdapter } from "../../../../src/shared/infrastructure/github-adapter.js";
import { HttpClient } from "../../../../src/shared/infrastructure/http-client.js";
import {
  describeCliReleaseSourceContract,
  type ReleaseScenario,
  type ReleaseSubject,
} from "../testing/cli-release-source.contract.js";
import { FakeCliReleaseSource } from "../testing/fake-cli-release-source.fake.js";

describeCliReleaseSourceContract(
  "the fake",
  async (scenario: ReleaseScenario): Promise<ReleaseSubject> => ({
    source: new FakeCliReleaseSource(
      scenario.kind === "published"
        ? { version: scenario.version, changelog: scenario.notes }
        : new FrameworkResolutionError(scenario.kind)
    ),
    dispose: async () => undefined,
  })
);

function listen(server: Server): Promise<string> {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("no port to ask");
      resolve(`http://127.0.0.1:${address.port}`);
    })
  );
}

describeCliReleaseSourceContract(
  "NpmRegistryReleaseAdapter over a local registry",
  async (scenario: ReleaseScenario): Promise<ReleaseSubject> => {
    const server = createServer((request, response) => {
      const published = scenario.kind === "published";
      if (request.url?.endsWith("/dist-tags")) {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(published ? { latest: scenario.version } : { unexpected: 1 }));
      } else if (published && scenario.notes !== null) {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ body: scenario.notes }));
      } else {
        response.statusCode = 404;
        response.end();
      }
    });
    const base = await listen(server);
    // A closed port is a registry nobody answers on.
    if (scenario.kind === "unreachable")
      await new Promise<void>((done) => server.close(() => done()));
    const http = new HttpClient();
    return {
      source: new NpmRegistryReleaseAdapter(http, new GitHubAdapter(http, { apiBase: base }), {
        npmRegistryBase: base,
      }),
      dispose: () => new Promise<void>((done) => server.close(() => done())),
    };
  }
);
