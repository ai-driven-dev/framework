"""Prototype: two tool readers -> one usage-record contract. Asserts on synthetic fixtures."""
import json, glob, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FX = os.path.join(HERE, "fixtures")

def rec(tool, key, session, agent, at, model, inp, out, cr, cw, cw1h, reasoning, cwd, branch, version):
    return dict(tool=tool, key=key, session_id=session, agent=agent, at=at, model=model,
                input=inp, output=out, cache_read=cr, cache_write=cw, cache_write_1h=cw1h,
                reasoning=reasoning, cwd=cwd, git_branch=branch, tool_version=version)

def claude(files):
    best = {}
    for f in files:
        for raw in open(f):
            r = json.loads(raw); m = r.get("message") or {}; u = m.get("usage")
            if r.get("type") != "assistant" or not isinstance(u, dict) or m.get("model") == "<synthetic>":
                continue
            key = f"{m['id']}:{r['requestId']}" if r.get("requestId") else f"{m['id']}:{r['sessionId']}:{r['timestamp']}"
            total = sum(u.get(k) or 0 for k in ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
            if key not in best or total > best[key][0]:
                best[key] = (total, r)
    out = []
    for key, (_, r) in best.items():
        m = r["message"]; u = m["usage"]; its = u.get("iterations") or []
        msgs = [i for i in its if i.get("type") == "message"] or [u]
        cw = sum(i.get("cache_creation_input_tokens") or 0 for i in msgs)
        splits = [i.get("cache_creation") for i in msgs]
        cw1h = sum(s.get("ephemeral_1h_input_tokens", 0) for s in splits) if all(isinstance(s, dict) for s in splits) else None
        agent = "subagent" if r.get("isSidechain") or r.get("agentId") else "main"
        base = (r["sessionId"], None, r["timestamp"])
        out.append(rec("claude-code", key, r["sessionId"], agent, r["timestamp"], m["model"],
                       u.get("input_tokens"), u.get("output_tokens"), u.get("cache_read_input_tokens"),
                       cw, cw1h, None, r.get("cwd"), r.get("gitBranch"), r.get("version")))
        for n, a in enumerate(i for i in its if i.get("type") == "advisor_message"):
            out.append(rec("claude-code", f"{key}#advisor{n}", r["sessionId"], "advisor", r["timestamp"], a.get("model"),
                           a.get("input_tokens"), a.get("output_tokens"), a.get("cache_read_input_tokens"),
                           a.get("cache_creation_input_tokens"), None, None, r.get("cwd"), r.get("gitBranch"), r.get("version")))
    return out

def codex(path):
    out = []; session = version = cwd = branch = model = None; last_total = None
    for raw in open(path):
        r = json.loads(raw); p = r.get("payload") or {}
        if r["type"] == "session_meta":
            session, version, cwd = p["id"], p.get("cli_version"), p.get("cwd")
            branch = (p.get("git") or {}).get("branch")
        elif r["type"] == "turn_context":
            model, cwd = p.get("model"), p.get("cwd", cwd)
        elif p.get("type") == "token_count" and p.get("info"):
            total = p["info"]["total_token_usage"]["total_tokens"]
            if total == last_total:      # verbatim re-emission, not a new call
                continue
            last_total = total; l = p["info"]["last_token_usage"]
            out.append(rec("codex", f"{session}:{total}", session, "main", r["timestamp"], model,
                           l["input_tokens"] - l["cached_input_tokens"], l["output_tokens"], l["cached_input_tokens"],
                           l.get("cache_write_input_tokens"), None, l.get("reasoning_output_tokens"), cwd, branch, version))
    return out

c = claude(sorted(glob.glob(FX + "/claude-*.jsonl")) + glob.glob(FX + "/subagents/*.jsonl"))
x = codex(FX + "/codex-rollout.jsonl")
by = {r["key"]: r for r in c + x}
expect = {
    "msg_A:req_A": dict(agent="main", input=3, output=250, cache_read=1000, cache_write=200, cache_write_1h=200),
    "msg_B:req_B": dict(agent="main", input=4, output=300, cache_read=5000, cache_write=2283, cache_write_1h=2283),
    "msg_B:req_B#advisor0": dict(agent="advisor", model="claude-fable-5-1", input=90000, output=700, cache_write_1h=None),
    "msg_C:req_C": dict(agent="subagent", model="claude-sonnet-5-5", input=5, cache_write=60, cache_write_1h=0),
    "cx-1:1050": dict(input=200, cache_read=800, output=50, reasoning=20, cache_write_1h=None),
    "cx-1:2630": dict(input=500, cache_read=1000, output=80, reasoning=20, model="gpt-5.5-codex"),
}
fail = 0
keys = [r["key"] for r in c + x]
if len(keys) != len(set(keys)):
    print("DUPLICATE KEYS"); fail += 1
if set(by) != set(expect):
    print("KEYS", sorted(set(by) ^ set(expect))); fail += 1
for k, e in expect.items():
    for f, v in e.items():
        if by.get(k, {}).get(f, "MISSING") != v:
            print(f"FAIL {k}.{f} = {by.get(k, {}).get(f, 'MISSING')} expected {v}"); fail += 1
print(f"{len(c)} claude + {len(x)} codex records, {fail} failures")
sys.exit(1 if fail else 0)
