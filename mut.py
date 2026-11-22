import sys,subprocess
p,a,b=sys.argv[1:4]
s=open(p).read(); assert a in s,a
open(p,'w').write(s.replace(a,b,1))
r=subprocess.run("pnpm exec vitest run tests/contexts/distribution/infrastructure tests/contexts/distribution/ports 2>&1 | grep -E '^ +(×|Tests )|FAIL' | head -5",shell=True,capture_output=True,text=True)
print(r.stdout)
open(p,'w').write(s)
