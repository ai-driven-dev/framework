# 02 - Draft

Draft the candidate rule and compare it with the project's policies.

## Input

The confirmed operation, hosts and topic, the revision asked in plan, or the source removed by a rename or host drop.

## Process

1. Draft the category, slug, description, scope and body per [rule-authoring.md](../references/rule-authoring.md).
   - Update: start from the existing source, keeping the meaning of each line the request does not change.
   - Add after a rename or host drop: start from the source read in frame.
2. Shape the draft on [rule-template.md](../assets/rule-template.md): description, paths and targets are writer input fields, and the body is the template after its front matter, starting with its `# <title>` line.
3. Find the policies per [policy-discovery.md](../references/policy-discovery.md).
4. Label the candidate against each found policy per [rule-assessment.md](../references/rule-assessment.md).
   - Hand-written rule on the same topic: offer to import it as the source, naming the original for the user to remove.
5. Read [plan](03-plan.md).

## Output

The candidate rule, with each finding quoting the policy's file.
