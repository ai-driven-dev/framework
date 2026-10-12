# 02 - Assess existing rules

Compare a complete candidate with applicable policies and obtain an explicit resolution before any rule write.

## Input

From 01: confirmed intent, category, slug, description, scope, write mode and destinations.

## Output

In-context: the complete candidate, source evidence, assessment and explicit user decision. An approved resolution carries the exact candidate and affected existing sources to 03; keeping existing rules or cancelling ends here.

## Process

1. **Draft.** Prepare the complete Markdown body in context using [rule-template.md](../assets/rule-template.md) and [rule-authoring.md](../references/rule-authoring.md). Strip the scaffold and settle any needed split now, assessing each resulting candidate. Include metadata, literal scope and destinations; do not create a rule, request file or publication yet.
2. **Discover.** Read the relevant sources through the discovery contract in [tool-paths.md](../references/tool-paths.md), for the confirmed mode and hosts. Include user guidance and nested instructions that may apply to the candidate's scope. Record sources read, excluded sources with reasons, and unreadable or uncertain sources. Treat verified renderings of a canonical policy as one logical rule, retaining every source path; never hide differing user edits as duplicates.
3. **Compare.** Compare obligations, prohibitions, conditions, exceptions, priority and scope, regardless of title, category or filename. An update also compares its prior source and states what will change. Exclude a policy only when its applicability is provably disjoint from the candidate's scope, independently of which files currently exist. If host activation, scope intersection, precedence or meaning cannot be established, report **needs review**, not an assumed exclusion.
4. **Assess.** Report relevant findings with source paths, the decisive policy text and scope reasoning:
   - **new**: no applicable policy covers, overlaps or contradicts the candidate after the discovery above.
   - **covered**: an applicable policy already supplies every proposed obligation under the applicable conditions throughout the candidate's scope, even under a different title.
   - **overlap**: compatible policies partially repeat or extend each other; identify the repeated and added obligations.
   - **conflict**: applicable obligations cannot both be followed, or the candidate weakens an existing requirement without an explicit exception or priority.
   - **needs review**: evidence is insufficient to decide; name the missing evidence or decision.
   Keep distinct findings when different policies produce different results; a conflict or uncertainty must not disappear behind an overall new/covered label.
5. **Decide.** Show the complete candidate, findings and proposed resolution, then wait for an explicit user decision, including for **new**. Choices must fit the evidence: approve the exact candidate, keep the existing policy, revise scope/body, merge into or replace an identified existing source, or cancel. Approval of a topic or target in 01 is not approval of this candidate. Modifying or deleting an existing source needs explicit confirmation of that source and its affected publications; never clean up user guidance or native files automatically. An unresolved conflict or needs-review finding requires an explicit resolution of that finding before proceeding.
6. **Reassess.** Any change to body, metadata, scope, destinations or replacement/merge resolution returns to Draft and comparison, then requires a new decision. If relevant source evidence changes before writing, refresh the assessment too. Carry the final approved body unchanged to 03; do not generate a different body there. Keeping an existing policy and cancelling leave project bytes unchanged.

## Test

- The complete candidate was compared before any rule or request file was written.
- Covered, overlap, conflict and needs-review findings cite their evidence; canonical deduplication and scope exclusions are justified.
- The user explicitly resolved the final candidate and every relevant finding; changed candidates were reassessed.
- Keeping existing rules or cancelling changed no project bytes; an approved write carries the exact body and explicitly confirmed source changes.
