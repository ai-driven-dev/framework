/**
 * The context chain as a graph rather than a paragraph. A per-file biome override cannot see
 * it: an override matches the text of a specifier, not the path it resolves to, and answers
 * one file at a time. `presentation` and `composition` may depend on anything below them, so a
 * context reaching back into either is an edge recorded here. Data lives in `allowed-edges.ts`.
 */
import { describe, expect, it } from "vitest";
import { present } from "../shared/testing/present.js";
import { ALLOWED, TRANSITIONAL_PAIRS } from "./allowed-edges.js";
import {
  contextImportPairs,
  contextOf,
  edgesBetweenContexts,
  expectRatchet,
  isContext,
  isCrossing,
  sourceFiles,
} from "./helpers.js";

function forbiddenEdges(edges: readonly string[], allowed: ReadonlySet<string>): string[] {
  return edges.filter((edge) => !allowed.has(edge));
}

function edgeBetween(importer: string, target: string): string {
  return `${contextOf(importer)}->${contextOf(target)}`;
}

describe("the context graph has only the edges the plan allows", () => {
  it("no context reaches another the chain does not permit", () => {
    const violations = forbiddenEdges(edgesBetweenContexts(sourceFiles()), ALLOWED);

    expect(violations, "an edge the chain forbids — see arborescence.md invariant 2").toEqual([]);
  });
});

type ImportPair = ReturnType<typeof contextImportPairs>[number];

/** Another context is read through its `contract/` and nothing else: its application, domain,
 * ports and infrastructure are its own. Presentation, orchestration and composition are not
 * contexts, so they keep reading `application/` and `contract/`. */
function interiorReaches(pairs: readonly ImportPair[]): string[] {
  return pairs
    .filter(({ target }) => !/^src\/contexts\/[^/]+\/contract\//.test(target))
    .map(({ importer, target }) => `${importer} -> ${target}`)
    .sort();
}

/** What a transitional row admits is its listed pairs: one the code holds and the list lacks,
 * and one the list holds and the code no longer does, both name themselves. */
function transitionalDrift(
  pairs: readonly ImportPair[],
  listed: Readonly<Record<string, readonly string[]>>
): { added: string[]; gone: string[] } {
  const held = pairs
    .filter(({ edge }) => edge in listed)
    .map(({ edge, importer, target }) => `${edge}: ${importer} -> ${target}`);
  const declared = Object.entries(listed).flatMap(([edge, entries]) =>
    entries.map((entry) => `${edge}: ${entry}`)
  );
  const { added, fixed } = expectRatchet(held, declared);
  return { added, gone: fixed };
}

describe("a context reads another context through its contract only", () => {
  it("no context imports another context's application, domain, ports or infrastructure", () => {
    expect(
      interiorReaches(contextImportPairs(sourceFiles())),
      "move the shape the importer needs into its own ports/, or the shared type into the supplier's contract/"
    ).toEqual([]);
  });
});

describe("a transitional edge admits its listed imports and no other", () => {
  it("lists every import of each transitional edge, and every listed import still exists", () => {
    const drift = transitionalDrift(contextImportPairs(sourceFiles()), TRANSITIONAL_PAIRS);

    expect(
      drift.added,
      "a new import under a transitional edge: the row is debt, not a licence"
    ).toEqual([]);
    expect(drift.gone, "no longer imported: remove it from TRANSITIONAL_PAIRS").toEqual([]);
  });

  it("only names an edge ALLOWED admits", () => {
    expect(Object.keys(TRANSITIONAL_PAIRS).filter((edge) => !ALLOWED.has(edge))).toEqual([]);
  });
});

describe("the guard itself", () => {
  it("flags a planted reach into a supplier's application, domain, ports and infrastructure, and clears its contract", () => {
    const pair = (target: string): ImportPair => ({
      edge: "installation->distribution",
      importer: "src/contexts/installation/application/x.ts",
      target,
    });

    expect(
      interiorReaches([
        pair("src/contexts/distribution/application/resolve-marketplace.ts"),
        pair("src/contexts/distribution/domain/marketplace.ts"),
        pair("src/contexts/distribution/ports/marketplace-registry.ts"),
        pair("src/contexts/distribution/infrastructure/adapter.ts"),
        pair("src/contexts/distribution/contract/marketplace.ts"),
      ])
    ).toEqual([
      "src/contexts/installation/application/x.ts -> src/contexts/distribution/application/resolve-marketplace.ts",
      "src/contexts/installation/application/x.ts -> src/contexts/distribution/domain/marketplace.ts",
      "src/contexts/installation/application/x.ts -> src/contexts/distribution/infrastructure/adapter.ts",
      "src/contexts/installation/application/x.ts -> src/contexts/distribution/ports/marketplace-registry.ts",
    ]);
  });

  it("flags a new import under a transitional edge and one the code dropped, and clears a listed one", () => {
    const held = {
      edge: "installation->distribution",
      importer: "src/contexts/installation/application/a.ts",
      target: "src/contexts/distribution/contract/marketplace.ts",
    };
    const fresh = { ...held, importer: "src/contexts/installation/application/b.ts" };
    const stable = {
      edge: "installation->tools",
      importer: "src/contexts/installation/application/c.ts",
      target: "src/contexts/tools/contract/tool-profile.ts",
    };
    const listed = {
      "installation->distribution": [
        "src/contexts/installation/application/a.ts -> src/contexts/distribution/contract/marketplace.ts",
        "src/contexts/installation/application/gone.ts -> src/contexts/distribution/contract/marketplace.ts",
      ],
    };

    expect(transitionalDrift([held, fresh, stable], listed)).toEqual({
      added: [
        "installation->distribution: src/contexts/installation/application/b.ts -> src/contexts/distribution/contract/marketplace.ts",
      ],
      gone: [
        "installation->distribution: src/contexts/installation/application/gone.ts -> src/contexts/distribution/contract/marketplace.ts",
      ],
    });
    expect(
      transitionalDrift([held, stable], {
        "installation->distribution": [present(listed["installation->distribution"][0])],
      })
    ).toEqual({ added: [], gone: [] });
  });

  it("names the edge it is given, and stays silent on one it allows", () => {
    expect(contextOf("src/contexts/tools/domain/registry.ts")).toBe("tools");
    expect(contextOf("src/shared/domain/tool.ts")).toBe("shared");
    expect(contextOf("src/somewhere-that-is-no-layer/thing.ts")).toBe("outside");
    expect(ALLOWED.has("translate->tools")).toBe(true);
    expect(ALLOWED.has("tools->translate")).toBe(false);
  });

  it("reports a planted crossing the chain forbids and clears one it permits", () => {
    const forbidden = edgeBetween(
      "src/contexts/tools/domain/registry.ts",
      "src/contexts/translate/contract/build-targets.ts"
    );
    const permitted = edgeBetween(
      "src/contexts/translate/application/build-native-tree.ts",
      "src/contexts/tools/domain/registry.ts"
    );

    expect(forbiddenEdges([forbidden, permitted], ALLOWED)).toEqual(["tools->translate"]);
    expect(forbiddenEdges([permitted], ALLOWED)).toEqual([]);
  });

  it("reports a planted tools to auth crossing and clears the two edges into auth", () => {
    const auth = "src/contexts/auth/contract/token-provider.ts";
    const planted = edgeBetween("src/contexts/tools/domain/registry.ts", auth);
    const distribution = edgeBetween(
      "src/contexts/distribution/infrastructure/plugin-fetcher-adapter.ts",
      auth
    );
    const update = edgeBetween(
      "src/contexts/update/infrastructure/npm-registry-release-adapter.ts",
      auth
    );
    const leaving = edgeBetween(auth, "src/contexts/distribution/domain/marketplace.ts");

    expect(forbiddenEdges([planted, distribution, update, leaving], ALLOWED)).toEqual([
      "tools->auth",
      "auth->distribution",
    ]);
  });

  it("names shared apart from every context, and counts no context among its files", () => {
    expect(contextOf("src/shared/ports/http-get.ts")).toBe("shared");
    expect(contextOf("src/shared/infrastructure/http-client.ts")).toBe("shared");
    expect(isContext("shared")).toBe(false);
  });

  it("clears a context reaching shared and reports shared reaching a context", () => {
    const reaching = isCrossing(
      contextOf("src/contexts/tools/domain/registry.ts"),
      contextOf("src/shared/ports/http-get.ts")
    );
    const reached = isCrossing(
      contextOf("src/shared/ports/http-get.ts"),
      contextOf("src/contexts/tools/domain/registry.ts")
    );

    expect(reaching, "a context may import shared/ports").toBe(false);
    expect(reached, "shared imports no context").toBe(true);
    expect(
      forbiddenEdges(
        [edgeBetween("src/shared/ports/x.ts", "src/contexts/tools/domain/registry.ts")],
        ALLOWED
      )
    ).toEqual(["shared->tools"]);
  });

  it.each(["src/composition/auth.ts", "src/orchestration/setup/setup.ts"])(
    "names %s apart from every context, reports a context reaching it and clears it reaching a context",
    (composition) => {
      expect(contextOf(composition)).toBe(composition.split("/")[1]);
      expect(isContext(contextOf(composition))).toBe(false);

      const reaching = isCrossing(
        contextOf("src/contexts/tools/domain/registry.ts"),
        contextOf(composition)
      );
      const reached = isCrossing(
        contextOf(composition),
        contextOf("src/contexts/tools/domain/registry.ts")
      );

      expect(reaching, "a context never imports a layer above it").toBe(true);
      expect(reached, "a layer above the contexts reads any of them").toBe(false);
      expect(
        forbiddenEdges([edgeBetween("src/contexts/tools/domain/registry.ts", composition)], ALLOWED)
      ).toEqual([`tools->${contextOf(composition)}`]);
    }
  );
});
