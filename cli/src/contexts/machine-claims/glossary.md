# Machine claims glossary
import type { PathContainment } from "../../shared/domain/paths.model.js";

The language of the `machine-claims` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Claim | A statement kept on the machine that one project, or one tool, holds a plugin, a ref or a marketplace | `HeldRefClaim`, `ClaimedOutcome` |
| Plugin claims | The per-tool file recording which refs and which project roots hold each plugin | `plugin-claims.json`, `PluginClaimsRepository` |
| Dependent | A project root that holds a machine plugin, listed in that plugin's claim | `readDependents`, `plugin-claim.model.ts` |
| Ref claim | The claim on one native plugin ref, merged when a project claims it again and dropped when none holds it | `mergeRefClaims`, `claimsKeeping` |
| Machine record | What the machine manifest holds for a tool: its native registrations, split from and joined back to the plugin claims | `MachineManifest`, `splitPluginClaims`, `joinPluginClaims` |
| Shared source reference | The project that points at the machine's single shared framework source, counted before the source is dropped | `UserSourceReferences` |
| User-scope containment | The proof that a path a record names sits strictly inside the directory that owns it, before anything deletes it | `isStrictlyWithin` (shared `paths.model.ts`), `PathContainment` |
| Ownership | Whether a user-scope plugin, its files or its enablement belong to aidd, so aidd may remove them | `application/ownership/` |
| Removal claims | The claims a plugin removal lets go of, and the dependents it leaves behind | `PluginRemovalClaims`, `application/removal/` |
