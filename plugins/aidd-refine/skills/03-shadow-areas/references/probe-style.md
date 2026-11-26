# Probe style

How a gap's probe is worded, so the author can act on it at once.

## Rules

1. Open with one of the question forms that `scripts/custom/locked-sets.json` lists under `probe.question_forms`.
2. End with `?`.
3. Target one gap, never two questions in one probe.
4. Name the specific subject (role, field, condition, term), not the artifact or a generic concept.
5. Use the shortest form that makes the gap actionable, without preamble.

## Examples

| Probe | Verdict |
| --- | --- |
| Who is responsible for approving the access request before it is acted on? | Follows every rule. |
| What should the system return to the caller when the payment provider responds with a timeout? | Follows every rule. |
| Which user roles are permitted to delete a published record? | Follows every rule. |
| How is the session invalidated when the user's account is suspended mid-session? | Follows every rule. |
| Does the 10 MB file-size limit apply to each file in a multi-file upload or to their total? | Follows every rule. |
| The spec is unclear about authentication. | A statement with no question form and no `?`, about the problem rather than the missing fact: breaks rules 1, 2 and 4. |
| Authentication and authorization both need clarification, and the roles section is incomplete. | Several targets in one sentence: breaks rule 3. |
| Could you clarify the access control model? | A vague subject that names no missing part: breaks rule 4. |
