import { GitHubAdapter } from "../../../../src/shared/infrastructure/github-adapter.js";
import { HttpClient } from "../../../../src/shared/infrastructure/http-client.js";
import { InMemoryRawCatalog } from "../testing/in-memory-raw-catalog.fake.js";
import { startLocalGitHub } from "../testing/local-github-server.builder.js";
import { describeRawCatalogContract } from "../testing/raw-catalog.contract.js";

describeRawCatalogContract("from memory", async () => ({
  fetcher: new InMemoryRawCatalog(),
  dispose: async () => {},
}));

describeRawCatalogContract("through the GitHub adapter on a local server", async () => {
  const { apiBase, close } = await startLocalGitHub();
  return { fetcher: new GitHubAdapter(new HttpClient(), { apiBase }), dispose: close };
});
