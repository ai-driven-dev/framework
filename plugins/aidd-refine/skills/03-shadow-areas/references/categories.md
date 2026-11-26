# Categories

The seven categories a gap can take, in the order a scan walks them. The validator reads the same names from `scripts/custom/locked-sets.json`; no other category is valid.

| Category | Definition | Counts | Does not count |
| --- | --- | --- | --- |
| unstated assumption | The author treats a condition as obvious or pre-agreed without writing it down, so another reader would not know it exists. | A PRD describes the checkout flow but never states that users must be signed in to enter it. | "The PRD should clarify the checkout flow": vague feedback, not a named assumption. |
| ambiguous term | A word or phrase has more than one reasonable reading in the document, and no definition or example pins it down. | A spec says the system must respond "quickly", with no threshold or benchmark. | "Users receive a confirmation email", when the document always uses "users" for signed-in account holders. |
| missing edge case | A boundary condition or exceptional input the described behavior does not cover. | A file-upload spec covers valid files under 10 MB but not files of exactly 10 MB or of zero bytes. | "What happens if the network is slow?": a failure mode, so `missing failure mode`. |
| missing actor | A person, system or role that acts or is affected is absent, so the process cannot be traced. | An approval story names the requester but not the reviewer role or the system that sends the approval notice. | "The admin panel is not described in detail": the actor is present, so `missing acceptance criterion`. |
| missing failure mode | The success path is specified but a way the operation can fail, and the response to it, is not. | A payment spec defines a successful charge but not a provider timeout, a declined card or a duplicate charge. | "The spec does not mention two-factor authentication": an unstated assumption or a missing feature. |
| missing acceptance criterion | A described requirement has no testable pass or fail condition, so done cannot be verified. | "Search must return relevant results", with no relevance score, response time or expected result set. | "The login screen is not covered": an absent feature is a `missing edge case` or `missing actor`. |
| missing dependency | The behavior relies on an external system, service, library, data set or prior step that is not named or whose readiness is not addressed. | A spec sends SMS notifications but names no provider, API contract or credential handling. | "The spec assumes the database schema is ready", when a prerequisite section lists the schema. |
