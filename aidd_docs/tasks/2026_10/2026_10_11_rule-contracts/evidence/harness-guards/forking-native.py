#!/opt/homebrew/opt/python@3.14/bin/python3.14
import os,time,json
pid=os.fork()
if pid:
 open(os.environ["TMPDIR"]+"/pids.json","w").write(json.dumps([os.getpid(),pid]))
time.sleep(120)
