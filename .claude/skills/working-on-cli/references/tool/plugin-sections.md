# Plugin sections

A tool says how it takes plugins with three sections: `layout` (a union on `mode`), `manifest` (native only) and `hooks` (how hooks are delivered). `domain/profile/plugin-answers.ts` composes them into the answers a caller asks, and `define-tool.ts` refuses a profile whose three disagree. The params are documented in `sections/layout-section.ts`, `sections/manifest-section.ts` and `sections/hooks-section.ts`; read them there.

## Layout mode

| Mode | Declared by | When |
| --- | --- | --- |
| `native` | `nativeLayout` | the tool has a plugin directory and, usually, its own plugin CLI |
| `flat` | `flatPlacement` | the tool loads a plugin's files from its workspace under a name prefix |
| `unsupported` | `{ mode: "unsupported" }` | the tool has no plugin concept |

## Agreement

| Layout | Manifest | Hooks delivery |
| --- | --- | --- |
| `native` | required | `plugin-file`, `project-merge` or `none` |
| `flat` | refused | `bridge`, `project-merge` with a `flat` part, or `none` |
| `unsupported` | refused | `none` |

## Hooks delivery

- A `hooks` section is required whenever a layout is declared.
- `none` carries the reason the tool runs no plugin hook.

## Install scope

- `project` (the default): plugins land under the project root.
- `user`: plugins land under the home directory and need a `userPluginsDir` resolver.

## Native activation

- Declaring `nativeActivation` says the tool writes its own marketplace registration through its own CLI, so the marketplace sync stands back.
- `marketplaceSettings` still says where the registration file is, for the gitignore and for `status`.
- Measure every verb and argument against the real binary; the doc comments of `NativeActivationSpec` in `contract/native-registration-spec.ts` say what each measurement found.
- Never add one by analogy with another tool.

## MCP namespacing

- A flat MCP merge prefixes every server key with the plugin name, through `flatMcpKeyPrefix` in `shared/domain/materialization/flat-paths.ts`.
- The prefix is mandatory: two plugins that declare a server of the same name would otherwise collide.
