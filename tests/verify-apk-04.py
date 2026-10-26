"""Independent static checks, not ART execution or Android installation."""
from pathlib import Path
import sys,struct,zipfile,hashlib,zlib,json,importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pack',ROOT/'native/build_android.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
APK=ROOT/'dist/Unlock-English-0.4.0.apk';z=zipfile.ZipFile(APK)
report=[]
def passed(s):report.append(s);print('PASS',s)
class DexRead:
 def __init__(self,d,annotation_check=False):
  self.d=d;self.u=lambda p:struct.unpack_from('<I',d,p)[0]
  assert d[:8] in (b'dex\n035\0',b'dex\n038\0');assert len(d)==self.u(32);assert d[12:32]==hashlib.sha1(d[32:]).digest();assert self.u(8)==zlib.adler32(d[12:])&0xffffffff
  self.strings=[]
  for i in range(self.u(56)):
   _,p=self.leb(self.u(self.u(60)+4*i));self.strings.append(d[p:d.index(0,p)].decode('utf8','replace'))
  self.types=[self.strings[self.u(self.u(68)+4*i)] for i in range(self.u(64))]
  self.protos=[]
  for i in range(self.u(72)):
   short,ret,po=struct.unpack_from('<III',d,self.u(76)+i*12);ps=[] if not po else [self.types[struct.unpack_from('<H',d,po+4+2*j)[0]] for j in range(self.u(po))];self.protos.append((self.types[ret],ps))
  self.fields=[]
  for i in range(self.u(80)):
   c,t,n=struct.unpack_from('<HHI',d,self.u(84)+8*i);self.fields.append((self.types[c],self.strings[n],self.types[t]))
  self.methods=[]
  for i in range(self.u(88)):
   c,p,n=struct.unpack_from('<HHI',d,self.u(92)+i*8);self.methods.append((self.types[c],self.strings[n],self.protos[p]))
  self.classes={};self.codes={};self.annotations=[]
  for i in range(self.u(96)):
   row=struct.unpack_from('<8I',d,self.u(100)+32*i);self.classes[self.types[row[0]]]=row
   if row[5] and annotation_check:
    off=row[5];nc,nf,nm,np=struct.unpack_from('<4I',d,off)
    for k in range(nm):
     mid,sets=struct.unpack_from('<II',d,off+16+nf*8+k*8);assert self.u(sets)==1;an=self.u(sets+4);assert d[an]==1;typ,ap=self.leb(an+1);size,ap=self.leb(ap);assert size==0;self.annotations.append((self.methods[mid][1],self.types[typ]))
   if not row[6]:continue
   p=row[6];counts=[]
   for _ in range(4):v,p=self.leb(p);counts.append(v)
   for _ in range(counts[0]+counts[1]):_,p=self.leb(p);_,p=self.leb(p)
   for count in counts[2:]:
    mid=0
    for j in range(count):
     delta,p=self.leb(p);mid+=delta;flags,p=self.leb(p);code,p=self.leb(p)
     if code:self.codes[mid]=(flags,code)
 def leb(self,p):
  v=shift=0
  while True:
   x=self.d[p];p+=1;v|=(x&127)<<shift;shift+=7
   if x<128:return v,p

d=DexRead(z.read('classes2.dex'),True);assert len(d.classes)==2;assert len(d.codes)==16
assert sorted(n for n,t in d.annotations)==['recognize','speak','stopSpeaking'];assert all(t=='Landroid/webkit/JavascriptInterface;' for n,t in d.annotations)
passed('New DEX: checksums, 2 classes, 16 method bodies, exactly 3 runtime-annotated JS methods')
# Decode every opcode and check operand bounds/branches/prototype argument words.
widths={0x14:3,0x1a:2,0x22:2,0x1f:2,0x20:2,0x6e:3,0x6f:3,0x70:3,0x71:3,0x72:3,0x54:2,0x52:2,0x55:2,0x59:2,0x5b:2,0x5c:2,0x62:2,0x0a:1,0x0c:1,0x0e:1,0x0f:1,0x11:1,0x07:1,0x01:1,0x38:2,0x39:2,0x3a:2,0x3b:2,0x3c:2,0x3d:2,0x32:2,0x33:2,0x34:2,0x35:2,0x36:2,0x37:2,0x29:2,0xd8:2,0x0d:1}
signed=lambda n:n-65536 if n>32767 else n
for mid,(flags,off) in d.codes.items():
 regs,ins,outs,tries,debug,count=struct.unpack_from('<HHHHII',d.d,off);owner,name,(ret,params)=d.methods[mid]
 assert ins==len(params)+(0 if flags&8 else 1);assert regs>=ins;units=struct.unpack_from('<'+'H'*count,d.d,off+16);pc=0;starts=set();branches=[]
 while pc<count:
  starts.add(pc);v=units[pc];op=v&255;assert op in widths,(name,hex(op));w=widths[op];assert pc+w<=count
  rr=[]
  if op in (0x14,0x1a,0x22,0x1f,0x62,0x0a,0x0c,0x0f,0x11,0x38,0x39,0x3a,0x3b,0x3c,0x3d,0x0d):rr=[v>>8]
  if op in (0x20,0x54,0x52,0x55,0x59,0x5b,0x5c,0x07,0x01,0x32,0x33,0x34,0x35,0x36,0x37):rr=[v>>8&15,v>>12]
  if op==0xd8:rr=[v>>8,units[pc+1]&255]
  if op in (0x6e,0x6f,0x70,0x71,0x72):
   n=v>>12;m=d.methods[units[pc+1]];rr=[units[pc+2]>>(4*j)&15 for j in range(4)]+[v>>8&15];rr=rr[:n];assert n<=outs;assert n==len(m[2][1])+(0 if op==0x71 else 1)
  if op==0x1a:assert units[pc+1]<len(d.strings)
  if op in (0x22,0x1f,0x20):assert units[pc+1]<len(d.types)
  if op in (0x54,0x52,0x55,0x59,0x5b,0x5c,0x62):assert units[pc+1]<len(d.fields)
  if op==0x29 or 0x32<=op<=0x3d:branches.append(pc+signed(units[pc+1]))
  assert all(0<=r<regs for r in rr),(name,rr,regs)
  pc+=w
 assert pc==count and all(t in starts for t in branches)
 if tries:
  tr=off+16+count*2+(2 if count%2 else 0);st,ln,ho=struct.unpack_from('<IHH',d.d,tr);assert st in starts and st+ln<=count
  hp=tr+8*tries;hn,hp2=d.leb(hp);assert hn==1;size,hp2=d.leb(hp+ho);assert size==1;typ,hp2=d.leb(hp2);target,hp2=d.leb(hp2);assert target in starts;assert units[target]&255==0x0d
passed('All 16 bridge methods: decoded opcodes, register bounds, invoke prototypes, branch targets and catch handler checked')
base=z.read('classes.dex');orig=(ROOT/'android-binary/classes.dex').read_bytes();br=DexRead(base);orr=DexRead(orig);assert br.classes['Lapp/unlockenglish/MainActivity;'][1]==1
allowed=set(range(8,32));off=orr.u(100)+list(orr.classes).index('Lapp/unlockenglish/MainActivity;')*32+4;allowed|=set(range(off,off+4));assert len(base)==len(orig);changes=[i for i,(a,b) in enumerate(zip(base,orig)) if a!=b];assert set(changes)<=allowed
passed('Original DEX preserved except MainActivity FINAL flag and checksum/signature; original instructions unchanged')
# Binary manifest: existing package + incremented version, target first, alias and TTS visibility.
chunks=list(pack.chunks(z.read('AndroidManifest.xml')));ss=pack.pool_read(chunks[0][2]);stack=[];nodes=[]
for t,h,b in chunks:
 if t==0x102:
  name=ss[struct.unpack_from('<I',b,20)[0]];ast,asz,n=struct.unpack_from('<HHH',b,24);attrs={}
  for j in range(n):
   _,a,raw,_,_,typ,v=struct.unpack_from('<IIIHBBI',b,16+ast+j*asz);attrs[ss[a]]=ss[v] if typ==3 else v
  nodes.append((tuple(stack),name,attrs));stack.append(name)
 elif t==0x103:assert stack.pop()==ss[struct.unpack_from('<I',b,20)[0]]
assert not stack
man=next(a for p,n,a in nodes if n=='manifest');assert man['package']=='app.unlockenglish.mobile' and man['versionCode']==4 and man['versionName']=='0.4.0'
act=next(a for p,n,a in nodes if n=='activity');alias=next(a for p,n,a in nodes if n=='activity-alias');assert act['name']==alias['targetActivity']=='app.unlockenglish.CourseActivity';assert alias['name']=='app.unlockenglish.MainActivity' and alias['exported']==0
assert any(n=='action' and a.get('name')=='android.intent.action.TTS_SERVICE' and 'queries' in p for p,n,a in nodes)
passed('Manifest: package unchanged, versionCode 4, new activity + backwards-compatible internal alias, TTS query')
images=[n for n in z.namelist() if n.endswith('.webp')];assert len(images)==332
for p in (ROOT/'web').rglob('*'):
 if p.is_file() and p.name!='manifest.json' and p.name not in ['index.html','app.js']:
  name='assets/'+p.relative_to(ROOT/'web').as_posix();assert z.read(name)==p.read_bytes(),name
passed('All 332 page images and current course JS/CSS packaged byte-for-byte; zero omitted page assets')
(ROOT/'docs/apk-static-checks-0.4.json').write_text(json.dumps({'checks':report,'device_tested':False,'warning':'Static checks do not prove ART verification or real device speech/focus behavior.'},ensure_ascii=False,indent=2))
