# 03 - Assert Frontend

Iterate until a frontend feature works as intended by inspecting the running UI, mapping behavior to code, and tracking attempts.

## Input

The expected behavior, from `$ARGUMENTS`, and the entry URL of the already-running frontend.

## Output

A pass or fail verdict, with the per-iteration attempts (hypothesis, fix, result) recorded in the tracking file.

## Process

1. **Parse.** Extract the visual, functional, and technical requirements from the expected behavior. Trace the action paths, for example a click calls a function in one file that updates state in another.
2. **Inspect.** Open the URL in the configured browsing tool. Inspect the page visually and technically, capturing a screenshot of the issue.
3. **Locate.** Explore the codebase for the files behind the issue.
4. **Track.** Fill the tracking file from `@../assets/task-template.md` with the three best candidate causes, each with a short description and a confidence level.
5. **Fix loop.** Take a cause, apply a candidate fix, validate against the expected behavior. On failure, mark it and take the next. When the three are exhausted, add three fresh causes and repeat.
6. **Boundary.** Assume the servers are running. Accept minor visual differences (1 to 2 px, slight color) unless the request specifies otherwise. Confirm every UI change with a screenshot.

## Test

- The tracking file updates on every iteration.
- The final recorded attempt validates as a pass, confirmed by a screenshot taken after it.
