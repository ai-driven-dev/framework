/**
 * The kind table itself: what each kind of file is called, where it lives, what it may import and
 * which test it owes. `kinds.ts` reads it to classify a file, `kind-imports.ts` to judge an import.
 */
export type KindId =
  | "use-case"
  | "model"
  | "port"
  | "adapter"
  | "profile"
  | "error"
  | "presenter"
  | "controller"
  | "composition"
  | "test"
  | "builder"
  | "fake"
  | "contract-suite"
  | "setup";

export type TestLevel = "unit" | "contract" | "integration" | "golden" | "e2e" | "arch";

export interface Kind {
  readonly id: KindId;
  /** A file named like this is of the kind, whatever its folder. */
  readonly suffix: RegExp;
  /** Where a file with the suffix may sit. */
  readonly folders: readonly string[];
  /** A file with no kind suffix in these folders is of the kind, minus `except`. */
  readonly fallback: readonly string[];
  readonly except: readonly string[];
  /** The kinds a file of this kind may import, or any. */
  readonly imports: readonly KindId[] | "any";
  /** The node builtins and packages it may import, or any. */
  readonly externals: readonly string[] | "any";
  /** When set, an import must land in one of these folders. */
  readonly within?: readonly string[];
  /** A builder, fake or suite imports no other context's kit. */
  readonly ownKitOnly?: true;
  /** The levels of the test a source of this kind owes at its mirror path, none when it owes none. */
  readonly tests: readonly TestLevel[];
}

const PURE_BUILTINS = ["node:path", "node:crypto"];
const ANY_TEST_FOLDER = ["tests/**/*"];
export const KIT_FOLDER = ["tests/**/testing/**/*"];
export const SETUP_FOLDER = ["tests/setup/**/*", "tests/mutation/**/*"];
/** The global setup that redirects HOME: a vitest config loads it, kept beside the kits. */
const SETUP_FILE = ["tests/shared/testing/throwaway-profile.ts"];

export const KINDS: readonly Kind[] = [
  {
    id: "use-case",
    suffix: /\.use-case\.ts$/,
    folders: ["src/contexts/*/application/**/*", "src/orchestration/**/*"],
    fallback: ["src/contexts/*/application/**/*", "src/orchestration/**/*"],
    except: ["src/orchestration/ports/**/*"],
    imports: ["use-case", "model", "port", "error"],
    externals: "any",
    tests: ["unit"],
  },
  {
    id: "model",
    suffix: /\.model\.ts$/,
    folders: [
      "src/contexts/*/domain/**/*",
      "src/contexts/*/contract/**/*",
      "src/shared/domain/**/*",
      // What the terminal adapter implements and presenters and controllers read.
      "src/presentation/terminal/output.model.ts",
      // The values a scenario carries between its steps, each beside its scenario.
      "src/orchestration/setup/setup-flow.model.ts",
      "src/orchestration/sync/bulk-conflict-state.model.ts",
    ],
    fallback: [
      "src/contexts/*/domain/**/*",
      "src/contexts/*/contract/**/*",
      "src/shared/domain/**/*",
    ],
    except: [],
    imports: ["model", "error"],
    externals: PURE_BUILTINS,
    tests: ["unit"],
  },
  {
    id: "port",
    suffix: /\.port\.ts$/,
    folders: [
      "src/contexts/*/ports/**/*",
      "src/contexts/*/contract/**/*",
      "src/shared/ports/**/*",
      "src/orchestration/ports/**/*",
    ],
    fallback: [
      "src/contexts/*/ports/**/*",
      "src/shared/ports/**/*",
      "src/orchestration/ports/**/*",
    ],
    except: [],
    imports: ["model", "port"],
    externals: [],
    tests: [],
  },
  {
    id: "adapter",
    suffix: /\.adapter\.ts$/,
    folders: [
      "src/contexts/*/infrastructure/**/*",
      "src/shared/infrastructure/**/*",
      "src/presentation/terminal/**/*",
    ],
    fallback: [
      "src/contexts/*/infrastructure/**/*",
      "src/shared/infrastructure/**/*",
      "src/presentation/terminal/**/*",
    ],
    except: [],
    imports: ["adapter", "model", "port", "error"],
    externals: "any",
    tests: ["integration", "contract"],
  },
  {
    id: "profile",
    suffix: /\.profile\.ts$/,
    folders: ["src/composition/tool-profiles/*"],
    fallback: ["src/composition/tool-profiles/*"],
    except: ["src/composition/tool-profiles/index.ts"],
    imports: ["model", "error", "adapter"],
    externals: PURE_BUILTINS,
    within: [
      "src/contexts/tools/domain/**/*",
      // A profile hands the codecs its formats name, the adapters the tools context owns.
      "src/contexts/tools/infrastructure/**/*",
      "src/contexts/tools/contract/**/*",
      // The native-registration section a profile file exports is typed by its reader.
      "src/contexts/host-registration/contract/**/*",
      "src/shared/domain/**/*",
    ],
    tests: ["unit"],
  },
  {
    id: "error",
    suffix: /\.error\.ts$/,
    folders: [
      "src/contexts/*/contract/**/*",
      "src/shared/domain/**/*",
      "src/orchestration/**/*",
      "src/presentation/**/*",
    ],
    fallback: [],
    except: [],
    imports: ["model", "error"],
    externals: [],
    tests: ["unit"],
  },
  {
    id: "presenter",
    suffix: /\.presenter\.ts$/,
    folders: [
      "src/presentation/presenters/**/*",
      "src/presentation/errors/**/*",
      "src/presentation/menu/**/*",
    ],
    fallback: [
      "src/presentation/presenters/**/*",
      "src/presentation/errors/**/*",
      "src/presentation/menu/**/*",
    ],
    except: [],
    imports: ["model", "use-case", "presenter", "error"],
    externals: "any",
    tests: ["unit"],
  },
  {
    id: "controller",
    suffix: /\.controller\.ts$/,
    folders: ["src/presentation/controllers/**/*", "src/presentation/hooks/**/*"],
    fallback: ["src/presentation/controllers/**/*", "src/presentation/hooks/**/*"],
    except: [],
    imports: ["use-case", "presenter", "model", "controller", "error"],
    externals: "any",
    tests: ["unit"],
  },
  {
    id: "composition",
    suffix: /\.composition\.ts$/,
    folders: ["src/composition/**/*"],
    fallback: [
      "src/composition/*",
      "src/composition/contexts/**/*",
      "src/composition/orchestration/**/*",
      "src/composition/tool-profiles/index.ts",
    ],
    except: [],
    imports: ["use-case", "adapter", "port", "model", "error", "profile", "composition"],
    externals: "any",
    tests: [],
  },
  {
    id: "test",
    suffix: /\.(?:unit|contract|integration|golden|e2e|arch)\.test\.ts$/,
    folders: ANY_TEST_FOLDER,
    fallback: [],
    except: [],
    imports: "any",
    externals: "any",
    tests: [],
  },
  {
    id: "builder",
    suffix: /\.builder\.ts$/,
    folders: KIT_FOLDER,
    fallback: [],
    except: [],
    imports: "any",
    externals: "any",
    ownKitOnly: true,
    tests: [],
  },
  {
    id: "fake",
    suffix: /\.fake\.ts$/,
    folders: KIT_FOLDER,
    fallback: [],
    except: [],
    imports: "any",
    externals: "any",
    ownKitOnly: true,
    tests: [],
  },
  {
    id: "contract-suite",
    suffix: /\.contract\.ts$/,
    folders: KIT_FOLDER,
    fallback: [],
    except: [],
    imports: "any",
    externals: "any",
    ownKitOnly: true,
    tests: [],
  },
  {
    // A setup file is claimed by its folder or its named file alone: a vitest config loads it, nothing imports it. The
    // mutation run's sequencer and reporter filter sit beside their tests in `tests/mutation/`.
    id: "setup",
    suffix: /(?!)/,
    folders: [...SETUP_FOLDER, ...SETUP_FILE],
    fallback: [...SETUP_FOLDER, ...SETUP_FILE],
    except: [],
    imports: "any",
    externals: "any",
    tests: [],
  },
];

/** Outside the catalog on purpose: the entry point, ambient declarations, glossaries, test data and
 * the architecture gate's own support files. */
export const OUTSIDE: readonly string[] = [
  "src/cli.ts",
  "src/**/*.d.ts",
  "src/**/*.md",
  "tests/fixtures/**/*",
  "tests/golden/snapshots/**/*",
  "tests/architecture/*.ts",
];
