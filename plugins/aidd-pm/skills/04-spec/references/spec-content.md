# Spec content

What each section of a spec holds. A spec states intent, never implementation: no library, framework pattern or file layout. Mark a gap instead of guessing it.

| Section | Holds | Never |
| --- | --- | --- |
| Target | one outcome, in one verifiable sentence: the one the user picks, else the first | a second outcome: it goes to Non-goals |
| Hard constraints | each non-negotiable limit, concrete and testable | a limit no Done-when condition proves |
| Non-goals | what this run leaves out, said now | a deferral |
| Done-when | what the user or caller observes, at least one refused or failed case | a test command, an example value that decides nothing |
| Open Questions | one `TBD: <precise question>` per gap, the section dropped when there is none | an answer guessed, or a gap repeated in another section |
| Stakeholders | when known: the decider, who settles a tradeoff; the owner, who keeps it long-term; the consumer, who depends on it | |
| Context | background and prior decisions, linked | a restated source |

A gap is an unresolved decision a required section depends on. A locked spec holds no gap.
