import re,sys
pat=re.compile(r"<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n",re.S)
def resolve(p,choices):
    """choices: list per hunk: 'o','t','b' (both) or a str replacement"""
    s=open(p).read(); it=iter(choices)
    def f(m):
        c=next(it)
        if c=="o": return m.group(1)
        if c=="t": return m.group(2)
        if c=="b": return m.group(1)+m.group(2)
        return c
    s=pat.sub(f,s); open(p,"w").write(s)
