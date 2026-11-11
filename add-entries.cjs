const fs=require('fs');
const [,,file,marker,...entries]=process.argv;
let t=fs.readFileSync(file,'utf8');
const idx=t.indexOf(marker); if(idx<0) throw new Error('marker');
// find the includes array that ends right before marker
const end=t.lastIndexOf(']',idx);
const start=t.lastIndexOf('"includes": [',end);
const block=t.slice(start,end);
const items=[...block.matchAll(/"([^"]+)"/g)].map(m=>m[1]);
const head=items.shift(); // src/**
const set=new Set(items.map(s=>s.replace(/^!/,'')));
for(const e of entries) set.add(e);
const sorted=[...set].sort().map(s=>'!'+s);
const ind=block.match(/\n(\s*)"/)[1];
const nb='"includes": [\n'+[head,...sorted].map(s=>ind+'"'+s+'"').join(',\n')+'\n'+ind.slice(2);
t=t.slice(0,start)+nb+t.slice(end);
fs.writeFileSync(file,t);
