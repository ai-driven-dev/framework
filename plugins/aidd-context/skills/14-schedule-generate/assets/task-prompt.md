# {{task name}}

{{Outcome to achieve on each run}}

## Trigger conditions

- Schedule: {{one-time instant or cadence and applicable time zone}}
- Proceed when {{observable condition on the input}}.
- When the input is valid but nothing qualifies, {{skip outcome and whether to deliver anything}}.

## Rules

- {{scope and constraints that apply throughout the run}}
- {{on a repeat run, how to recognize work already delivered if duplicates matter}}

## Inputs

- {{input, source, workspace or time window and how to read it}}

## Process

1. {{Read the named input and check the trigger condition.}}
2. {{Perform an operation or call an installed skill with its input. Name the result that the next step consumes.}}
3. {{Use that result in the next operation or skill. Check the result before delivery.}}

## Output

- Success: {{artifact or message, format and destination, including who handles delivery}}
- Failure: {{what to report and where to stop when a required input is unreadable or invalid, or a skill or step fails}}

> Replace every slot, expand or shorten the numbered process to fit the task, and remove this note and inapplicable rules.
