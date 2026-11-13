# 02 - Draft

Draft the candidate rule and compare it with the project's policies.

## Input

The confirmed operation, hosts and topic, or the revision asked in plan.

## Process

1. Draft the category, slug, description, scope and body with [rule-template.md](../assets/rule-template.md) per [rule-authoring.md](../references/rule-authoring.md).
   - Update: start from the existing source.
   - Rename: remove the old rule, then add the new one.
2. Find the policies per [policy-discovery.md](../references/policy-discovery.md), read-only in the project and loaded ancestors, never home or account scans.
3. Label the candidate against each found policy per [rule-assessment.md](../references/rule-assessment.md).
   - Hand-written rule on the same topic: offer to import it as the source, naming the original for the user to remove.
4. Read [plan](03-plan.md).

## Output

The candidate rule, with each finding quoting its source.
