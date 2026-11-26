import { GitHubAdapter } from "../../../src/shared/infrastructure/github-adapter.js";
import { HttpClient } from "../../../src/shared/infrastructure/http-client.js";
import { InMemoryReleaseLister } from "../testing/in-memory-release-lister.fake.js";
import { startLocalReleases } from "../testing/local-releases-server.builder.js";
import {
  describeReleaseListerContract,
  NOTES,
  NOTES_TAG,
  PRIVATE_REPO,
  RELEASE_TAGS,
  RELEASES_REPO,
} from "../testing/run-release-lister.contract.js";

describeReleaseListerContract("from memory", async () => ({
  lister: new InMemoryReleaseLister(
    { [RELEASES_REPO]: { tags: RELEASE_TAGS, notes: { [NOTES_TAG]: NOTES } } },
    [PRIVATE_REPO]
  ),
  dispose: async () => {},
}));

describeReleaseListerContract("through the GitHub adapter on a local server", async () => {
  const { apiBase, close } = await startLocalReleases();
  return { lister: new GitHubAdapter(new HttpClient(), { apiBase }), dispose: close };
});
