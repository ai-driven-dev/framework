# 01 - Test

Identify untested behaviors in the target, then write and iterate tests until they pass with modern testing practices.

## Input

The scope to cover, a feature, module, or file glob, from the arguments.

## Output

The behaviors found and, per behavior, a passing test with its file path and its effectiveness check, `run` or `reasoned` with its reason, or a `pending` entry with a one-line reason when deliberately skipped or blocked by a missing seam. Any deviation from a quality criterion that a project convention imposes is noted beside its test.

## Process

1. **List.** Enumerate the untested behaviors in the target area. Reason from the existing ones, score each from 0 (not needed) to 5 (critical core flow), group by section, prioritize by score and impact, and show a minimal bullet list with each score.
2. **Approve.** Wait for user approval of the list and its scores before generating any test. A behavior the user declines becomes a `pending` entry with a one-line reason, not tested.
3. **Generate.** Write the initial test for the highest-priority behavior, applying current testing practices and project conventions.
4. **Iterate.** Run the test. On failure, analyze it, improve the test, and repeat. On pass, check it against every quality criterion below and improve it until it meets them all.
5. **Next.** Move to the next behavior and repeat from Generate until the list is exhausted.

## Quality criteria

The project's testing commands, frameworks and conventions stay authoritative: where one conflicts with a criterion, follow it and note the deviation. A convention is a documented rule or the project's test configuration, never a pattern found in existing tests. Never install a mocking, coverage or mutation dependency to meet these criteria. Otherwise every criterion holds, whatever the language.

- **Observable behavior.** Assert what a caller or user can observe: a returned value, a state change, an output, an error, or an outgoing command as Stub queries, mock commands defines it. A test that checks only internal structure, calls to a stub, or which collaborators were called without the values the subject computed is not done.
- **Real subject.** The behavior under test runs for real. Never replace its own logic with a double; the boundaries it crosses follow Doubles at seams.
- **Doubles at seams.** For each dependency of the subject, take the first case that applies:
  1. It is the behavior under test: never double it.
  2. The subject sends it a command whose call is the behavior: mock it for that call only, as Stub queries, mock commands says, where the test can substitute it without patching the subject.
  3. It crosses a boundary (network, filesystem, clock, randomness, a third-party service) through a seam: a seam the project defines such as a port, a module whose sole job is that boundary, or the test framework's own interception of it such as fake timers. Double it at that seam, or use an isolated real resource that exposes the effect, such as a temporary directory or an in-memory store.
  4. It receives such a command or crosses such a boundary, but no seam lets the test substitute it and no isolated real resource exposes the effect: never patch the subject. Show the behavior to the user with its score and `missing seam at <dependency>`; once they agree, it becomes `pending` with that reason and the design change is left to its owner.
  5. Anything else, including a collaborator carrying domain logic: use the real one.
- **Stub queries, mock commands.** A double that feeds the subject data is a stub: never assert on it. A double whose call changes something outside the subject, such as sending a message, writing a record or emitting an event, is a mock: asserting that call, with the values the subject computed, is the behavior, and the test's name says so. A call that only fetches data is a stub's, whatever the double is called.
- **No tautology.** Reject a test that passes whatever the subject does, such as one whose expected value only echoes what a stub was configured to return.
- **Effectiveness.** Name the break that would defeat the intended behavior, such as a removed branch, an inverted condition, or an input returned unchanged. The break keeps the subject running and targets the behavior's own logic; deleting the subject or making it throw does not count. For a behavior scored 4 or 5, the check is `run`: copy the files the break touches, apply it and watch the test fail, restore them, confirm they match the copy, then rerun and watch the test pass. Below 4, a `reasoned` check may replace it, stating why the test fails under the break. A test no break can fail protects nothing: strengthen it. Use mutation testing only when the project already configures it.

## Test

- Every behavior in the approved list has a corresponding test in the project suite that passes, with its file path recorded.
- Every such test meets each quality criterion, or notes the convention it defers to, and records its effectiveness check: `run` for a behavior scored 4 or 5, `run` or `reasoned` with its reason below.
- Each behavior deliberately skipped or blocked by a missing seam has a `pending` entry with a one-line reason.
