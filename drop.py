import sys
# drop.py debt "<exact entry>"   |  drop.py biome <lineno-range-start-substring> "<path>" <nth occurrence 1-based>
mode=sys.argv[1]
if mode=='debt':
    f='cli/tests/architecture/kinds-debt.json' if False else 'tests/architecture/kinds-debt.json'
    lines=open(f).read().split('\n')
    target=sys.argv[2]
    n=[i for i,l in enumerate(lines) if l.strip().rstrip(',')=='"'+target+'"']
    assert len(n)==1,(target,n)
    del lines[n[0]]
    open(f,'w').write('\n'.join(lines))
else:
    f='biome.json'
    lines=open(f).read().split('\n')
    path=sys.argv[2]; nth=int(sys.argv[3])
    n=[i for i,l in enumerate(lines) if l.strip().rstrip(',')=='"!'+path+'"']
    print(path,'occurrences at',[x+1 for x in n])
    del lines[n[nth-1]]
    open(f,'w').write('\n'.join(lines))
