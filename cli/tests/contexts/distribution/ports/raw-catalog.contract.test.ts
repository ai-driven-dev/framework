import { GitHubAdapter } from "../../../../src/shared/infrastructure/github-adapter.js";
import { HttpClient } from "../../../../src/shared/infrastructure/http-client.js";
import { InMemoryRawCatalog } from "../../../shared/testing/raw-catalog.fake.js";
import { startLocalGitHub } from "../testing/local-github-server.builder.js";
import { contractWorld, describeRawCatalogContract } from "../testing/raw-catalog.contract.js";

describeRawCatalogContract("from memory", async () => ({
  fetcher: new InMemoryRawCatalog(contractWorld),
  dispose: async () => {},
}));

describeRawCatalogContract("through the GitHub adapter on a local server", async () => {
  const { apiBase, close } = await startLocalGitHub();
  return { fetcher: new GitHubAdapter(new HttpClient(), { apiBase }), dispose: close };
});
