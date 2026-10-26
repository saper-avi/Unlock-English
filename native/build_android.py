#!/usr/bin/env python3
"""Repackage the user-provided APK with 0.4 assets and the voice bridge.
No downloaded build dependencies; original method instructions preserved.
Produces JAR/v1 + APK/v2 signatures. This is not a Java-source rebuild.
"""
from pathlib import Path
import struct, zipfile, io, hashlib, datetime, json, os, secrets, subprocess, shutil, zlib
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.serialization import pkcs12

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
OUT=ROOT/'android-build'
OUT.mkdir(exist_ok=True)
SIGN=Path(os.environ.get('UNLOCK_SIGN_DIR',str(HERE/'.signing'))); SIGN.mkdir(exist_ok=True); os.chmod(SIGN,0o700)
PACKAGE='app.unlockenglish.mobile'
VERSION='0.4.0'
U32=lambda n:struct.pack('<I',n)
U64=lambda n:struct.pack('<Q',n)
LP=lambda b:U32(len(b))+b

def chunks(b,start=8):
    p=start
    while p<len(b):
        t,h,n=struct.unpack_from('<HHI',b,p)
        if n<h or n<8 or p+n>len(b): raise ValueError('Invalid resource chunk')
        yield t,h,bytes(b[p:p+n])
        p+=n
    assert p==len(b)

def pool_read(b):
    _,h,size=struct.unpack_from('<HHI',b)
    count,styles,flags,start,styles_start=struct.unpack_from('<IIIII',b,8)
    assert styles==0,'Styled string pools need a different builder'
    result=[]
    for i in range(count):
        p=start+struct.unpack_from('<I',b,h+4*i)[0]
        if flags&0x100:
            def l8(p):
                v=b[p]
                return ((v&127)<<8|b[p+1],p+2) if v&128 else (v,p+1)
            _,p=l8(p);n,p=l8(p)
            result.append(b[p:p+n].decode('utf8'))
        else:
            n=struct.unpack_from('<H',b,p)[0];p+=2
            if n&0x8000: n=((n&0x7fff)<<16)|struct.unpack_from('<H',b,p)[0];p+=2
            result.append(b[p:p+n*2].decode('utf-16le'))
    return result

def pool_write(strings):
    body=bytearray();offsets=[]
    for s in strings:
        offsets.append(len(body));enc=s.encode('utf-16le');n=len(enc)//2
        assert n<32768
        body+=struct.pack('<H',n)+enc+b'\0\0'
    body+=b'\0'*((-len(body))%4)
    start=28+4*len(strings)
    return struct.pack('<HHIIIIII',1,28,start+len(body),len(strings),0,0,start,0)+b''.join(U32(x) for x in offsets)+body

def patch_manifest(data):
    allchunks=list(chunks(data));old=pool_read(allchunks[0][2])
    replacements={'.MainActivity':'app.unlockenglish.CourseActivity',
                  '.FocusAccessibilityService':'app.unlockenglish.FocusAccessibilityService',
                  'app.unlockenglish':PACKAGE,'0.1.0':VERSION}
    strings=[replacements.get(x,x) for x in old]
    def idx(text):
        if text not in strings:strings.append(text)
        return strings.index(text)
    app_label=idx('Unlock English 0.4');service_label=idx('Unlock English 0.4 · Фокус')
    alias_tag=idx('activity-alias');target_attr=idx('targetActivity')
    original_class=idx('app.unlockenglish.MainActivity');target_class=idx('app.unlockenglish.CourseActivity')
    uri=idx('http://schemas.android.com/apk/res/android')
    for text in ['intent','action','queries','name','exported','android.intent.action.TTS_SERVICE','android.speech.action.RECOGNIZE_SPEECH']:idx(text)
    reschunk=next(b for t,h,b in allchunks if t==0x180)
    ids=list(struct.unpack('<'+'I'*((len(reschunk)-8)//4),reschunk[8:]));ids.extend([0]*(len(strings)-len(ids)))
    ids[target_attr]=16843266  # android.R.attr.targetActivity = 0x01010202
    def start(tag,attrs=()):
        attrs=sorted(attrs,key=lambda a:ids[idx(a[0])])
        body=struct.pack('<IIIIHHHHHH',1,0xffffffff,0xffffffff,idx(tag),20,20,len(attrs),0,0,0)
        for name,typ,value in attrs:
            body+=struct.pack('<IIIHBBI',uri,idx(name),value if typ==3 else 0xffffffff,8,0,typ,value)
        return struct.pack('<HHI',0x102,16,8+len(body))+body
    def end(tag):return struct.pack('<HHIIIII',0x103,16,24,1,0xffffffff,0xffffffff,idx(tag))
    alias=start('activity-alias',[('name',3,original_class),('targetActivity',3,target_class),('exported',0x12,0)])+end('activity-alias')
    queries=b''
    for action in ['android.intent.action.TTS_SERVICE','android.speech.action.RECOGNIZE_SPEECH']:
        queries+=start('intent')+start('action',[('name',3,idx(action))])+end('action')+end('intent')
    body=bytearray();added_alias=False
    for t,h,b in allchunks:
        if t==1:body+=pool_write(strings);continue
        if t==0x180:body+=struct.pack('<HHI',0x180,8,8+len(ids)*4)+b''.join(U32(x) for x in ids);continue
        b=bytearray(b)
        if t==0x102:
            nameidx=struct.unpack_from('<I',b,20)[0];name=old[nameidx]
            ast,asz,count=struct.unpack_from('<HHH',b,24)
            for j in range(count):
                p=16+ast+j*asz;attr=old[struct.unpack_from('<I',b,p+4)[0]]
                if name=='manifest' and attr=='versionCode':struct.pack_into('<I',b,p+16,4)
                if name in ('application','service') and attr=='label':
                    v=app_label if name=='application' else service_label
                    struct.pack_into('<I',b,p+8,v);b[p+15]=3;struct.pack_into('<I',b,p+16,v)
        if t==0x103:
            name=old[struct.unpack_from('<I',b,20)[0]]
            if name=='queries':body+=queries
            if name=='activity' and not added_alias:body+=b;body+=alias;added_alias=True;continue
        body+=b
    assert added_alias
    return struct.pack('<HHI',3,8,8+len(body))+body

def extend_base_dex(data):
    """Only remove MainActivity's final CLASS flag; no method/instruction modification."""
    d=bytearray(data)
    u=lambda pos:struct.unpack_from('<I',d,pos)[0]
    def read_uleb(pos):
        value=shift=0
        while True:
            n=d[pos];pos+=1;value|=(n&127)<<shift;shift+=7
            if n<128:return value,pos
    strings=[]
    for i in range(u(56)):
        pos=u(u(60)+4*i);_,pos=read_uleb(pos)
        strings.append(bytes(d[pos:d.index(0,pos)]).decode('utf8','replace'))
    types=[strings[u(u(68)+4*i)] for i in range(u(64))]
    found=0
    for i in range(u(96)):
        off=u(100)+32*i
        if types[u(off)]=='Lapp/unlockenglish/MainActivity;':
            flags=u(off+4);assert flags==0x11
            struct.pack_into('<I',d,off+4,flags&~0x10);found+=1
    assert found==1
    d[12:32]=hashlib.sha1(d[32:]).digest();struct.pack_into('<I',d,8,zlib.adler32(d[12:])&0xffffffff)
    return bytes(d)

def patch_resources(data):
    data=bytearray(data)
    h=struct.unpack_from('<H',data,2)[0]
    p=h
    while p<len(data):
        t,header,n=struct.unpack_from('<HHI',data,p)
        if t==0x200:
            old=data[p+12:p+268].decode('utf-16le').split('\0',1)[0]
            assert old=='app.unlockenglish',old
            enc=PACKAGE.encode('utf-16le')
            data[p+12:p+268]=enc+b'\0'*(256-len(enc))
        p+=n
    assert p==len(data)
    return bytes(data)

def zip_aligned(entries):
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,'w') as out:
        for name,content in entries:
            info=zipfile.ZipInfo(name,(2026,10,25,12,0,0))
            info.create_system=0
            info.compress_type=zipfile.ZIP_STORED if name=='resources.arsc' else zipfile.ZIP_DEFLATED
            # Android 11+ requires resources.arsc to be uncompressed and 4-byte aligned.
            if info.compress_type==zipfile.ZIP_STORED:
                pos=stream.tell()+30+len(name.encode('utf8'))
                if pos%4:
                    pad=(-(pos+4))%4
                    info.extra=struct.pack('<HH',0xd935,pad)+b'\0'*pad
            out.writestr(info,content,compresslevel=9)
    return stream.getvalue()

def digest_sections(sections):
    digests=[]
    for sec in sections:
        for off in range(0,len(sec),1024*1024):
            chunk=sec[off:off+1024*1024]
            digests.append(hashlib.sha256(b'\xa5'+U32(len(chunk))+chunk).digest())
    return hashlib.sha256(b'\x5a'+U32(len(digests))+b''.join(digests)).digest()

def sign_v2(unsigned,key,cert):
    eocd=unsigned.rfind(b'PK\x05\x06')
    assert eocd>=0 and eocd+22==len(unsigned)
    cdsize,cdoff=struct.unpack_from('<II',unsigned,eocd+12)
    assert cdoff+cdsize==eocd
    content_digest=digest_sections([unsigned[:cdoff],unsigned[cdoff:eocd],unsigned[eocd:]])
    alg=0x0103  # RSA PKCS#1 v1.5 / SHA-256, supported by Android v2 verification.
    cert_der=cert.public_bytes(serialization.Encoding.DER)
    public=key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)
    digests=LP(LP(U32(alg)+LP(content_digest)))
    signed_data=digests+LP(LP(cert_der))+LP(b'')
    signature=key.sign(signed_data,padding.PKCS1v15(),hashes.SHA256())
    signer=LP(signed_data)+LP(LP(U32(alg)+LP(signature)))+LP(public)
    value=LP(LP(signer))
    pair=U64(4+len(value))+U32(0x7109871a)+value
    size=len(pair)+24
    block=U64(size)+pair+U64(size)+b'APK Sig Block 42'
    end=bytearray(unsigned[eocd:]);struct.pack_into('<I',end,16,cdoff+len(block))
    return unsigned[:cdoff]+block+unsigned[cdoff:eocd]+end

def build():
    original=ROOT/'original/Unlock-English-0.1.0.apk'
    source=zipfile.ZipFile(original)
    assets={p.relative_to(ROOT/'web').as_posix():p.read_bytes() for p in sorted((ROOT/'web').rglob('*')) if p.is_file() and p.name!='manifest.json'}
    # APK uses offline local content and the existing native bridge; it does not
    # silently send writing or install a server. The real backend stays separate.
    app=assets['app.js'].decode('utf8')
    marker='  async function openAISettings() {\n'
    assert marker in app
    native_branch="""    if(window.UNLOCK_ANDROID_BUILD){modal('ИИ-сервер пока не подключён',`<p>В этой Android-сборке доступны локальная самопроверка и готовый демо-разбор. Это не автоматическая ИИ-проверка твоего текста.</p><div class=\"disclosure\">Для настоящего анализа нужен отдельный защищённый сервер. В этот APK он не встроен и не подключён. API-ключ не запрашивается. Можно скопировать текст через кнопку «Для ChatGPT».</div><p>Квизы, миссии, звуки и режим фокуса не требуют ИИ.</p>${button('Понятно','close-modal')}`);return;}\n"""
    app=app.replace(marker,marker+native_branch,1)
    # Do not claim this APK is only an HTML preview or that a build is still pending.
    app=app.replace('Это веб-сборка для разработки. Приложенный APK 0.1 — прежняя версия, без этих обновлений. Новый Android APK ещё не собран.',
                    'Android APK 0.3.0. Нативная оболочка сохранена из исходного приложения. Анимации, звуки и миссии доступны без сети. ИИ-сервер в этой сборке не подключён. Новая версия установлена отдельно от 0.1; прогресс можно перенести через экспорт и импорт.')
    app=app.replace('Веб-версия 0.3','Версия 0.3')
    assets['app.js']=app.encode('utf8')
    assets['android-config.js']=b"'use strict'; window.UNLOCK_ANDROID_BUILD = { version: '0.4.0', packageName: 'app.unlockenglish.mobile' };\n"
    index=assets['index.html'].decode('utf8')
    index=index.replace('  <script defer src="content.js">','  <script defer src="android-config.js"></script>\n  <script defer src="content.js">')
    index=index.replace("connect-src 'self'","connect-src 'none'")
    assets['index.html']=index.encode('utf8')
    staging=OUT/'assets';staging.mkdir(exist_ok=True)
    for name,content in assets.items():
        target=staging/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content)
    entries=[('AndroidManifest.xml',patch_manifest(source.read('AndroidManifest.xml'))),
             ('resources.arsc',patch_resources(source.read('resources.arsc')))]
    for n in source.namelist():
        if n.startswith('res/') or n=='classes.dex': entries.append((n,extend_base_dex(source.read(n)) if n=='classes.dex' else source.read(n)))
    entries.append(('classes2.dex',(ROOT/'native/classes2.dex').read_bytes()))
    entries.extend(('assets/'+name,body) for name,body in assets.items())
    unsigned=OUT/'unsigned.apk';unsigned.write_bytes(zip_aligned(entries))
    keyfile=SIGN/'signer-private.pem';certfile=SIGN/'signer-cert.pem'
    if keyfile.exists():
        key=serialization.load_pem_private_key(keyfile.read_bytes(),None)
        cert=x509.load_pem_x509_certificate(certfile.read_bytes())
    else:
        key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Unlock English Personal Build'),
                           x509.NameAttribute(NameOID.ORGANIZATION_NAME,'Unlock English')])
        cert=(x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
              .public_key(key.public_key()).serial_number(x509.random_serial_number())
              .not_valid_before(datetime.datetime(2026,10,24,tzinfo=datetime.timezone.utc))
              .not_valid_after(datetime.datetime(2056,10,24,tzinfo=datetime.timezone.utc))
              .sign(key,hashes.SHA256()))
        keyfile.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()));os.chmod(keyfile,0o600)
        certfile.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    pwfile=SIGN/'password.txt'
    if not pwfile.exists():pwfile.write_text(secrets.token_urlsafe(24)+'\n');os.chmod(pwfile,0o600)
    password=pwfile.read_text().strip().encode()
    keystore=SIGN/'unlock-english.p12'
    keystore.write_bytes(pkcs12.serialize_key_and_certificates(b'unlock-english',key,cert,None,serialization.BestAvailableEncryption(password)));os.chmod(keystore,0o600)
    v1=OUT/'v1.apk'
    result=subprocess.run(['jarsigner','-keystore',str(keystore),'-storetype','PKCS12','-storepass:file',str(pwfile),
                           '-sigalg','SHA256withRSA','-digestalg','SHA-256','-signedjar',str(v1),str(unsigned),'unlock-english'],capture_output=True,text=True,check=True)
    (OUT/'jarsigner-sign.log').write_text(result.stdout+result.stderr)
    with zipfile.ZipFile(v1) as z:
        aligned=zip_aligned([(n,z.read(n)) for n in z.namelist()])
    final=sign_v2(aligned,key,cert)
    target=ROOT/'dist'/('Unlock-English-'+VERSION+'.apk');target.parent.mkdir(exist_ok=True);target.write_bytes(final)
    # Independent verification is run in a separate Java program after this build.
    facts={'version':VERSION,'version_code':4,'package':PACKAGE,'label':'Unlock English 0.4','min_sdk':26,'target_sdk':35,
           'source_apk_sha256':hashlib.sha256(original.read_bytes()).hexdigest(),
           'apk_sha256':hashlib.sha256(final).hexdigest(),'size_bytes':len(final),
           'certificate_sha256':cert.fingerprint(hashes.SHA256()).hex(),
           'native_dex_preserved':False,'original_instructions_preserved':True,'native_change':'MainActivity final class flag removed; CourseActivity/VoiceJob in added classes2.dex','build_type':'Recovered native shell + documented voice bridge + 0.4 web assets; not a Gradle source build',
           'ai_backend_connected':False,'installed_on_android_or_emulator':False,
           'assets_sha256':{n:hashlib.sha256(v).hexdigest() for n,v in assets.items()}}
    (OUT/'build-info.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in facts.items() if k!='assets_sha256'},ensure_ascii=False,indent=2))
    print('OUTPUT',target)
if __name__=='__main__':build()
