# Probing

How to dig until an idea is clear. No scoreboard, no fixed round count. Depth comes from following threads, not from ticking topics.

## Read the altitude first

An idea sits at a level: functional (what it does and for whom), technical (a design or tooling choice), or mixed. Probe at that level, never one finer. For a technical idea the technical choice is the subject, so engaging it is right. The how-to that implements the choice belongs to planning, leave it as a flagged assumption.

## Follow the thread

Each answer opens a new thread. Pull it. The richest threads are forks, where two materially different builds are still possible, for example searching a filename versus searching the full text inside a file. Name the fork and ask which side. Cycling a fixed list of topics gives breadth and no depth. Following the thread gives depth.

## Tactics to draw from

Reach for one when it fits, never run them all.

- **Five whys.** When the stated goal looks like a chosen solution, ask why a few times to reach the real need underneath.
- **Job to be done.** Reframe a named feature as "when [situation], I want [motivation], so I can [outcome]" to separate the job from the solution.
- **Concrete example.** When a term has two readings, ask for one example that fits and one that does not.
- **Premortem.** To surface failures, ask the user to imagine the idea shipped and then failed, and to name what went wrong. Working back from the failure finds modes a generic checklist misses.

## Flag, never fake

When a gap stays open at the end, state it as an assumption or a risk to confirm at design time. A reasonable assumption clearly flagged is useful. A guess presented as settled is not.

## Know when to stop

The idea is clear enough when a competent reader would build the same thing from it, the forks that change the build are answered or consciously deferred, and the edges and failures have been raised. Stop there, or the moment the user is satisfied. Never stop on a count.
