# Return to onboard

Handing off a GUIDED step launches another skill, which may not return control on its own. So on every handoff, tell the user one line: re-run onboard to come back and continue (the deterministic path is this skill's slash command). The re-run re-scans; the session ledger drops the handed-off step, so the user resumes where they left off rather than repeating it.
