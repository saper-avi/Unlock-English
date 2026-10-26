#!/usr/bin/env python3
"""Small deterministic DEX emitter for the two documented voice bridge classes.
No network or Android SDK. This is NOT a general Java compiler.
Readable equivalent Java is in native/. Bytecode verified separately by tests.
Format: https://source.android.com/docs/core/runtime/dex-format
Opcodes: https://source.android.com/docs/core/runtime/dalvik-bytecode
"""
from pathlib import Path
import struct,hashlib,zlib,json
U16=lambda x:struct.pack('<H',x&0xffff)
U32=lambda x:struct.pack('<I',x&0xffffffff)
def uleb(v):
 out=bytearray()
 while True:
  b=v&127;v>>=7;out.append(b|(128 if v else 0))
  if not v:return bytes(out)
def mutf(s):
 out=bytearray();units=struct.unpack('<'+'H'*(len(s.encode('utf-16le'))//2),s.encode('utf-16le'))
 for c in units:
  if c and c<128:out.append(c)
  elif c<2048:out.extend([0xc0|(c>>6),0x80|(c&63)])
  else:out.extend([0xe0|(c>>12),0x80|((c>>6)&63),0x80|(c&63)])
 return uleb(len(units))+out+b'\0'
class Dex:
 def __init__(self):self.strings=set();self.types=set();self.protos=set();self.fields=set();self.methods=set();self.classes=[]
 def s(self,s):self.strings.add(s);return s
 def t(self,t):self.types.add(t);self.s(t);return t
 def m(self,c,n,r,*ps):
  self.t(c);self.s(n);self.t(r)
  for p in ps:self.t(p)
  proto=(r,tuple(ps));self.protos.add(proto);self.s(''.join(x[0] if x[0] not in '[L' else 'L' for x in [r,*ps]));key=(c,n,proto);self.methods.add(key);return key
 def f(self,c,n,t):self.t(c);self.t(t);self.s(n);k=(c,n,t);self.fields.add(k);return k
 def cls(self,c,super,interfaces=()):
  self.t(c);self.t(super)
  for x in interfaces:self.t(x)
  cl={'name':c,'super':super,'interfaces':tuple(interfaces),'methods':[],'fields':[]};self.classes.append(cl);return cl
 def method(self,cl,name,ret,params,flags,regs,ins,js=False):
  k=self.m(cl['name'],name,ret,*params);c=Code(self);cl['methods'].append({'key':k,'flags':flags,'regs':regs,'ins':ins,'code':c,'js':js});return c
 def build(self):
  ann=self.t('Landroid/webkit/JavascriptInterface;')
  strings=sorted(self.strings,key=lambda s:s.encode('utf-16be'));si={s:i for i,s in enumerate(strings)}
  types=sorted(self.types,key=lambda t:si[t]);ti={s:i for i,s in enumerate(types)}
  protos=sorted(self.protos,key=lambda p:(ti[p[0]],tuple(ti[x] for x in p[1])));pi={p:i for i,p in enumerate(protos)}
  fields=sorted(self.fields,key=lambda f:(ti[f[0]],si[f[1]],ti[f[2]]));fi={f:i for i,f in enumerate(fields)}
  methods=sorted(self.methods,key=lambda m:(ti[m[0]],si[m[1]],pi[m[2]]));mi={m:i for i,m in enumerate(methods)}
  classes=sorted(self.classes,key=lambda c:ti[c['name']]);data=bytearray(b'\0'*112);sections=[(0,1,0)]
  def alloc(n,size,typ):
   if not n:return 0
   off=len(data);data.extend(b'\0'*(n*size));sections.append((typ,n,off));return off
  so=alloc(len(strings),4,1);to=alloc(len(types),4,2);po=alloc(len(protos),12,3);fo=alloc(len(fields),8,4);mo=alloc(len(methods),8,5);co=alloc(len(classes),32,6)
  def align():data.extend(b'\0'*(-len(data)%4))
  align();data_start=len(data)
  sections.append((0x2002,len(strings),len(data)))
  for i,s in enumerate(strings):struct.pack_into('<I',data,so+i*4,len(data));data.extend(mutf(s))
  for i,t in enumerate(types):struct.pack_into('<I',data,to+i*4,si[t])
  lists={p[1] for p in protos if p[1]}|{c['interfaces'] for c in classes if c['interfaces']};lo={():0}
  if lists:
   align();sections.append((0x1001,len(lists),len(data)))
   for ls in sorted(lists):
    align();lo[ls]=len(data);data.extend(U32(len(ls))+b''.join(U16(ti[t]) for t in ls))
  for i,p in enumerate(protos):
   short=''.join(x[0] if x[0] not in '[L' else 'L' for x in [p[0],*p[1]])
   struct.pack_into('<III',data,po+i*12,si[short],ti[p[0]],lo[p[1]])
  for i,(c,n,t) in enumerate(fields):struct.pack_into('<HHI',data,fo+i*8,ti[c],ti[t],si[n])
  for i,(c,n,p) in enumerate(methods):struct.pack_into('<HHI',data,mo+i*8,ti[c],pi[p],si[n])
  ao=len(data);sections.append((0x2004,1,ao));data.extend(b'\x01'+uleb(ti[ann])+b'\0')
  align();aset=len(data);sections.append((0x1003,1,aset));data.extend(U32(1)+U32(ao))
  annclasses=[c for c in classes if any(m['js'] for m in c['methods'])];ados={}
  if annclasses:
   align();sections.append((0x2006,len(annclasses),len(data)))
   for c in annclasses:
    align();ados[c['name']]=len(data);js=sorted([mi[m['key']] for m in c['methods'] if m['js']]);data.extend(struct.pack('<4I',0,0,len(js),0));data.extend(b''.join(U32(i)+U32(aset) for i in js))
  allmeth=[m for c in classes for m in c['methods']];allmeth.sort(key=lambda m:mi[m['key']]);align();sections.append((0x2001,len(allmeth),len(data)))
  inventory=[]
  for m in allmeth:
   align();m['off']=len(data);code=m['code'];units,labels=code.compile(si,ti,fi,mi)
   tries=code.catches;data.extend(struct.pack('<HHHHII',m['regs'],m['ins'],max([len(args[2]) for op,args in code.instructions if op=='invoke']+[0]),len(tries),0,len(units)));data.extend(b''.join(U16(x) for x in units))
   if tries:
    if len(units)%2:data.extend(b'\0\0')
    assert len(tries)==1
    start,end,kind,handler=tries[0];data.extend(struct.pack('<IHH',labels[start],labels[end]-labels[start],1));data.extend(b'\x01\x01'+uleb(ti[kind])+uleb(labels[handler]))
   inventory.append({'method':m['key'][0]+'->'+m['key'][1],'registers':m['regs'],'inputs':m['ins'],'code_units':len(units),'offset':m['off'],'js_exposed':m['js'],'labels':labels})
  sections.append((0x2000,len(classes),len(data)))
  for ci,c in enumerate(classes):
   cdo=len(data);fs=sorted(c['fields'],key=lambda f:fi[f]);direct=sorted([m for m in c['methods'] if m['flags']&0x1000a],key=lambda m:mi[m['key']]);virtual=sorted([m for m in c['methods'] if not m['flags']&0x1000a],key=lambda m:mi[m['key']])
   data.extend(uleb(0)+uleb(len(fs))+uleb(len(direct))+uleb(len(virtual)))
   prev=0
   for f in fs:data.extend(uleb(fi[f]-prev)+uleb(2));prev=fi[f]
   for group in [direct,virtual]:
    prev=0
    for m in group:data.extend(uleb(mi[m['key']]-prev)+uleb(m['flags'])+uleb(m['off']));prev=mi[m['key']]
   struct.pack_into('<8I',data,co+ci*32,ti[c['name']],1,ti[c['super']],lo[c['interfaces']],0xffffffff,ados.get(c['name'],0),cdo,0)
  align();mapoff=len(data);sections.append((0x1000,1,mapoff));sections.sort(key=lambda s:s[2]);data.extend(U32(len(sections)))
  for typ,count,off in sections:data.extend(struct.pack('<HHII',typ,0,count,off))
  data[:8]=b'dex\n035\0';struct.pack_into('<20I',data,32,len(data),112,0x12345678,0,0,mapoff,len(strings),so,len(types),to,len(protos),po,len(fields),fo,len(methods),mo,len(classes),co,len(data)-data_start,data_start)
  data[12:32]=hashlib.sha1(data[32:]).digest();struct.pack_into('<I',data,8,zlib.adler32(data[12:])&0xffffffff)
  return bytes(data),inventory
class Code:
 def __init__(self,d):self.d=d;self.instructions=[];self.catches=[]
 def emit(self,op,*a):self.instructions.append((op,a));return self
 def label(self,s):return self.emit('label',s)
 def const(self,r,v):return self.emit('const',r,v)
 def string(self,r,s):self.d.s(s);return self.emit('string',r,s)
 def new(self,r,t):self.d.t(t);return self.emit('new',r,t)
 def cast(self,r,t):self.d.t(t);return self.emit('cast',r,t)
 def instance(self,a,b,t):self.d.t(t);return self.emit('instance',a,b,t)
 def invoke(self,kind,m,regs):return self.emit('invoke',kind,m,regs)
 def field(self,op,a,b,f):return self.emit('field',op,a,b,f)
 def static(self,a,f):return self.emit('static',a,f)
 def result(self,a,obj=False):return self.emit('result',a,obj)
 def ret(self,a=None,obj=False):return self.emit('return',a,obj)
 def move(self,a,b,obj=False):return self.emit('move',a,b,obj)
 def ifz(self,cond,a,label):return self.emit('ifz',cond,a,label)
 def if2(self,cond,a,b,label):return self.emit('if2',cond,a,b,label)
 def goto(self,label):return self.emit('goto',label)
 def add(self,a,b,k):return self.emit('add',a,b,k)
 def catch(self,start,end,kind,handler):self.d.t(kind);self.catches.append((start,end,kind,handler))
 def compile(self,si,ti,fi,mi):
  widths={'label':0,'const':3,'string':2,'new':2,'cast':2,'instance':2,'invoke':3,'field':2,'static':2,'result':1,'return':1,'move':1,'ifz':2,'if2':2,'goto':2,'add':2,'exception':1}
  labels={};pos=0
  for op,a in self.instructions:
   if op=='label':labels[a[0]]=pos
   pos+=widths[op]
  out=[]
  for op,a in self.instructions:
   at=len(out)
   if op=='label':continue
   if op=='const':r,v=a;out += [0x14|(r<<8),v&65535,(v>>16)&65535]
   elif op=='string':r,s=a;out += [0x1a|(r<<8),si[s]]
   elif op in ['new','cast']:r,t=a;out += [(0x22 if op=='new' else 0x1f)|(r<<8),ti[t]]
   elif op=='instance':r,v,t=a;out += [0x20|(r<<8)|(v<<12),ti[t]]
   elif op=='invoke':
    kind,key,rs=a;assert len(rs)<=5 and all(0<=x<16 for x in rs);regs=list(rs)+[0]*5
    out += [{'virtual':0x6e,'super':0x6f,'direct':0x70,'static':0x71,'interface':0x72}[kind]|(len(rs)<<12)|(regs[4]<<8),mi[key],regs[0]|regs[1]<<4|regs[2]<<8|regs[3]<<12]
   elif op=='field':code,r,obj,f=a;out += [code|(r<<8)|(obj<<12),fi[f]]
   elif op=='static':r,f=a;out += [0x62|(r<<8),fi[f]]
   elif op=='result':r,obj=a;out += [(0x0c if obj else 0x0a)|(r<<8)]
   elif op=='return':r,obj=a;out += [0x0e if r is None else (0x11 if obj else 0x0f)|(r<<8)]
   elif op=='move':r,v,obj=a;out += [(0x07 if obj else 0x01)|(r<<8)|(v<<12)]
   elif op=='ifz':cond,r,label=a;out += [{'eq':0x38,'ne':0x39,'lt':0x3a,'ge':0x3b,'gt':0x3c,'le':0x3d}[cond]|(r<<8),(labels[label]-at)&65535]
   elif op=='if2':cond,r,v,label=a;out += [{'eq':0x32,'ne':0x33,'lt':0x34,'ge':0x35,'gt':0x36,'le':0x37}[cond]|(r<<8)|(v<<12),(labels[label]-at)&65535]
   elif op=='goto':out += [0x29,(labels[a[0]]-at)&65535]
   elif op=='add':r,v,k=a;out += [0xd8|(r<<8),v|((k&255)<<8)]
   elif op=='exception':out += [0x0d|(a[0]<<8)]
   else:raise ValueError(op)
  return out,labels

def bridge():
 d=Dex();A='Lapp/unlockenglish/CourseActivity;';BASE='Lapp/unlockenglish/MainActivity;';J='Lapp/unlockenglish/VoiceJob;';OBJ='Ljava/lang/Object;';STR='Ljava/lang/String;';BUN='Landroid/os/Bundle;';INTENT='Landroid/content/Intent;';WEB='Landroid/webkit/WebView;';VIEW='Landroid/view/View;';GROUP='Landroid/view/ViewGroup;';TTS='Landroid/speech/tts/TextToSpeech;';INIT='Landroid/speech/tts/TextToSpeech$OnInitListener;';R='Ljava/lang/Runnable;'
 act=d.cls(A,BASE,[INIT]);job=d.cls(J,OBJ,[R]);fw=d.f(A,'courseWeb',WEB);ft=d.f(A,'speaker',TTS);fr=d.f(A,'ttsReady','Z');fq=d.f(A,'requestId',STR);act['fields']=[fw,ft,fr,fq]
 ja=d.f(J,'activity',A);jt=d.f(J,'text',STR);jm=d.f(J,'mode','I');job['fields']=[ja,jt,jm]
 # Constructors
 c=d.method(act,'<init>','V',[],0x10001,1,1);c.invoke('direct',d.m(BASE,'<init>','V'),[0]).ret()
 c=d.method(job,'<init>','V',[A,STR,'I'],0x10001,4,4);c.invoke('direct',d.m(OBJ,'<init>','V'),[0]).field(0x5b,1,0,ja).field(0x5b,2,0,jt).field(0x59,3,0,jm).ret()
 # Locate the WebView built by the original Activity (no assumptions about a resource id).
 find=d.m(A,'findWeb',WEB,VIEW);c=d.method(act,'findWeb',WEB,[VIEW],9,6,1)
 c.instance(0,5,WEB).ifz('eq',0,'group').cast(5,WEB).ret(5,True).label('group').instance(0,5,GROUP).ifz('eq',0,'none').cast(5,GROUP).const(1,0).invoke('virtual',d.m(GROUP,'getChildCount','I'),[5]).result(2).label('loop').if2('ge',1,2,'none').invoke('virtual',d.m(GROUP,'getChildAt',VIEW,'I'),[5,1]).result(3,True).invoke('static',find,[3]).result(4,True).ifz('ne',4,'found').add(1,1,1).goto('loop').label('found').ret(4,True).label('none').const(0,0).ret(0,True)
 # Lifecycle and bridge installation before the WebView finishes loading local scripts.
 c=d.method(act,'onCreate','V',[BUN],1,6,2)
 c.invoke('super',d.m(BASE,'onCreate','V',BUN),[4,5]).invoke('virtual',d.m('Landroid/app/Activity;','getWindow','Landroid/view/Window;'),[4]).result(0,True).invoke('virtual',d.m('Landroid/view/Window;','getDecorView',VIEW),[0]).result(0,True).invoke('static',find,[0]).result(0,True).field(0x5b,0,4,fw).ifz('eq',0,'tts').string(1,'BookNative').invoke('virtual',d.m(WEB,'addJavascriptInterface','V',OBJ,STR),[0,4,1]).string(1,'file:///android_asset/index.html').invoke('virtual',d.m(WEB,'loadUrl','V',STR),[0,1]).label('tts').new(0,TTS).invoke('direct',d.m(TTS,'<init>','V','Landroid/content/Context;',INIT),[0,4,4]).field(0x5b,0,4,ft).ret()
 # Public JS entry points: marshal all Activity / TTS work to the UI thread.
 constructor=d.m(J,'<init>','V',A,STR,'I');runui=d.m('Landroid/app/Activity;','runOnUiThread','V',R)
 c=d.method(act,'recognize','V',[STR],1,5,2,True);c.new(0,J).const(1,0).invoke('direct',constructor,[0,3,4,1]).invoke('virtual',runui,[3,0]).ret()
 c=d.method(act,'speak','V',[STR,'Z'],1,6,3,True);c.const(1,1).ifz('eq',5,'make').const(1,2).label('make').new(0,J).invoke('direct',constructor,[0,3,4,1]).invoke('virtual',runui,[3,0]).ret()
 c=d.method(act,'stopSpeaking','V',[],1,4,1,True);c.new(0,J).string(1,'').const(2,3).invoke('direct',constructor,[0,3,1,2]).invoke('virtual',runui,[3,0]).ret()
 recognize=d.m(A,'doRecognize','V',STR);speak=d.m(A,'doSpeak','V',STR,'Z');stop=d.m(A,'doStop','V')
 c=d.method(job,'run','V',[],1,5,1)
 c.field(0x54,0,4,ja).field(0x54,1,4,jt).field(0x52,2,4,jm).ifz('eq',2,'rec').const(3,3).if2('eq',2,3,'stop').const(3,2).if2('eq',2,3,'slow').const(3,0).invoke('virtual',speak,[0,1,3]).ret().label('slow').const(3,1).invoke('virtual',speak,[0,1,3]).ret().label('rec').invoke('virtual',recognize,[0,1]).ret().label('stop').invoke('virtual',stop,[0]).ret()
 emit=d.m(A,'emit','V',STR,STR)
 c=d.method(act,'doRecognize','V',[STR],1,6,2)
 c.ifz('eq',5,'done').field(0x5b,5,4,fq).label('try').new(0,INTENT).string(1,'android.speech.action.RECOGNIZE_SPEECH').invoke('direct',d.m(INTENT,'<init>','V',STR),[0,1])
 for key,val in [('android.speech.extra.LANGUAGE_MODEL','free_form'),('android.speech.extra.LANGUAGE','en-GB'),('android.speech.extra.PROMPT','Speak in English')]:
  c.string(1,key).string(2,val).invoke('virtual',d.m(INTENT,'putExtra',INTENT,STR,STR),[0,1,2])
 c.string(1,'android.speech.extra.MAX_RESULTS').const(2,1).invoke('virtual',d.m(INTENT,'putExtra',INTENT,STR,'I'),[0,1,2]).const(1,7041).invoke('virtual',d.m('Landroid/app/Activity;','startActivityForResult','V',INTENT,'I'),[4,0,1]).label('endtry').goto('done').label('failed').emit('exception',0).string(0,'unavailable').string(1,'').invoke('virtual',emit,[4,0,1]).label('done').ret();c.catch('try','endtry','Ljava/lang/RuntimeException;','failed')
 # Result belongs only to request 7041; preserve original file picker / export handlers.
 c=d.method(act,'onActivityResult','V',['I','I',INTENT],4,8,4)
 c.const(0,7041).if2('ne',5,0,'other').const(0,-1).if2('ne',6,0,'cancel').ifz('eq',7,'cancel').string(0,'android.speech.extra.RESULTS').invoke('virtual',d.m(INTENT,'getStringArrayListExtra','Ljava/util/ArrayList;',STR),[7,0]).result(0,True).ifz('eq',0,'empty').invoke('virtual',d.m('Ljava/util/ArrayList;','size','I'),[0]).result(1).ifz('eq',1,'empty').const(1,0).invoke('virtual',d.m('Ljava/util/ArrayList;','get',OBJ,'I'),[0,1]).result(1,True).cast(1,STR).ifz('eq',1,'empty').string(0,'ok').invoke('virtual',emit,[4,0,1]).ret().label('empty').string(0,'no_speech').string(1,'').invoke('virtual',emit,[4,0,1]).ret().label('cancel').string(0,'cancelled').string(1,'').invoke('virtual',emit,[4,0,1]).ret().label('other').invoke('super',d.m(BASE,'onActivityResult','V','I','I',INTENT),[4,5,6,7]).ret()
 # JSON quotes guard all returned speech against JavaScript/string injection.
 SB='Ljava/lang/StringBuilder;';quote=d.m('Lorg/json/JSONObject;','quote',STR,STR);append=d.m(SB,'append',SB,STR)
 c=d.method(act,'emit','V',[STR,STR],1,8,3)
 c.field(0x54,4,5,fw).ifz('eq',4,'done').new(0,SB).invoke('direct',d.m(SB,'<init>','V'),[0]).string(1,'window.onNativeBookSpeech&&window.onNativeBookSpeech({id:').invoke('virtual',append,[0,1]).field(0x54,2,5,fq).invoke('static',quote,[2]).result(2,True).invoke('virtual',append,[0,2]).string(1,',status:').invoke('virtual',append,[0,1]).invoke('static',quote,[6]).result(2,True).invoke('virtual',append,[0,2]).string(1,',text:').invoke('virtual',append,[0,1]).invoke('static',quote,[7]).result(2,True).invoke('virtual',append,[0,2]).string(1,'});').invoke('virtual',append,[0,1]).invoke('virtual',d.m(SB,'toString',STR),[0]).result(1,True).const(2,0).invoke('virtual',d.m(WEB,'evaluateJavascript','V',STR,'Landroid/webkit/ValueCallback;'),[4,1,2]).label('done').ret()
 c=d.method(act,'onInit','V',['I'],1,5,2)
 c.ifz('ne',4,'done').field(0x54,0,3,ft).ifz('eq',0,'done').static(1,d.f('Ljava/util/Locale;','UK','Ljava/util/Locale;')).invoke('virtual',d.m(TTS,'setLanguage','I','Ljava/util/Locale;'),[0,1]).result(1).ifz('lt',1,'done').const(1,1).field(0x5c,1,3,fr).label('done').ret()
 c=d.method(act,'doSpeak','V',[STR,'Z'],1,8,3)
 c.ifz('eq',6,'done').field(0x55,0,5,fr).ifz('eq',0,'unavailable').field(0x54,0,5,ft).ifz('eq',0,'unavailable').const(1,0).const(2,600).invoke('virtual',d.m(STR,'length','I'),[6]).result(3).if2('le',3,2,'bounded').invoke('virtual',d.m(STR,'substring',STR,'I','I'),[6,1,2]).result(6,True).label('bounded').const(1,struct.unpack('<I',struct.pack('<f',.95))[0]).ifz('eq',7,'rate').const(1,struct.unpack('<I',struct.pack('<f',.72))[0]).label('rate').invoke('virtual',d.m(TTS,'setSpeechRate','I','F'),[0,1]).const(1,0).const(2,0).string(3,'unlock-english-word').invoke('virtual',d.m(TTS,'speak','I','Ljava/lang/CharSequence;','I',BUN,STR),[0,6,1,2,3]).goto('done').label('unavailable').field(0x54,0,5,fw).ifz('eq',0,'done').string(1,"window.dispatchEvent(new CustomEvent('book-speech-notice',{detail:'English voice is not ready. Check the Android text-to-speech settings.'}));").const(2,0).invoke('virtual',d.m(WEB,'evaluateJavascript','V',STR,'Landroid/webkit/ValueCallback;'),[0,1,2]).label('done').ret()
 c=d.method(act,'doStop','V',[],1,2,1);c.field(0x54,0,1,ft).ifz('eq',0,'done').invoke('virtual',d.m(TTS,'stop','I'),[0]).label('done').ret()
 c=d.method(act,'onPause','V',[],4,1,1);c.invoke('virtual',stop,[0]).invoke('super',d.m(BASE,'onPause','V'),[0]).ret()
 c=d.method(act,'onDestroy','V',[],4,2,1);c.field(0x54,0,1,ft).ifz('eq',0,'done').invoke('virtual',d.m(TTS,'shutdown','V'),[0]).label('done').invoke('super',d.m(BASE,'onDestroy','V'),[1]).ret()
 return d.build()
if __name__=='__main__':
 root=Path(__file__).resolve().parents[1];data,report=bridge();(root/'native').mkdir(exist_ok=True);(root/'native/classes2.dex').write_bytes(data);(root/'native/dex-inventory.json').write_text(json.dumps(report,indent=2));print('Voice bridge:',len(data),'bytes,',len(report),'methods')
