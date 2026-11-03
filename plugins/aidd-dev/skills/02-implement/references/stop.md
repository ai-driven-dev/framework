# Stops

| Stop | When | Do |
| --- | --- | --- |
| blocked | only a human can unblock (payment, human login, 2FA, unreadable secret), or a check lacks a tool, service or secret | set `status: blocked`, commit the statuses as the [commit strategy](commits.md) allows, escalate |
| replan needed | the criteria cannot hold in the plan's scope, or one is ambiguous | commit the statuses as the [commit strategy](commits.md) allows, say `replan needed: <reason>`; take no other task or phase first |
