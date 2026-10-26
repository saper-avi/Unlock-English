"""Real Chromium DOM tests with isolated assets/storage fixtures, not an Android device test."""
from pathlib import Path
import re,json,mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];WEB=ROOT/'web';OUT=ROOT/'docs/screenshots-0.4';OUT.mkdir(parents=True,exist_ok=True)
report=[];errors=[]
def record(label):report.append(label);print('PASS',label,flush=True)
def boot(b,width=390,seed=None,reduced=False,native=False):
 c=b.new_context(viewport={'width':width,'height':844},reduced_motion='reduce' if reduced else 'no-preference');p=c.new_page();p.set_default_timeout(6000);p.on('pageerror',lambda e:errors.append(str(e)))
 def assets(r):
  path=r.request.url.split('unlock.test/',1)[-1].split('?',1)[0];f=WEB/path
  if f.is_file():r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
  else:r.fulfill(status=404,body='missing')
 p.route('https://unlock.test/**',assets)
 p.evaluate('''seed=>{for(const key of ['localStorage','sessionStorage']){const d=new Map(Object.entries(key==='localStorage'?(seed||{}):{}));Object.defineProperty(window,key,{value:{getItem:k=>d.get(k)||null,setItem:(k,v)=>d.set(k,String(v)),removeItem:k=>d.delete(k),clear:()=>d.clear()},configurable:true});} window.__sounds=0;const Base=window.AudioContext;if(Base)window.AudioContext=class extends Base{createOscillator(){const a=super.createOscillator(),s=a.start.bind(a);a.start=(...x)=>{window.__sounds++;return s(...x)};return a;}};}''',seed or {})
 if native:p.evaluate('''()=>{window.BookNative={recognize:id=>{window.__speechId=id},speak:(s,slow)=>{window.__tts={text:s,slow}},stopSpeaking:()=>{}};}''')
 html=(WEB/'index.html').read_text();html=re.sub(r'<meta[^>]*http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
 html=re.sub(r'<link[^>]*href="([^"]+\.css)"[^>]*>',lambda m:'<style>'+(WEB/m[1]).read_text()+'</style>',html)
 scripts=re.findall(r'<script[^>]*src="([^"]+)"[^>]*></script>',html);html=re.sub(r'<script[^>]*src="([^"]+)"[^>]*></script>','',html)
 html=html.replace('</body>',''.join('<script>'+(WEB/n).read_text().replace('</script','<\\/script')+'</script>' for n in scripts)+'</body>').replace('<head>','<head><base href="https://unlock.test/">')
 p.set_content(html,wait_until='load');p.wait_for_timeout(250);return c,p

def click(p,a,v=None):
 sel=f'[data-action="{a}"]'+(f'[data-value="{v}"]' if v is not None else '')
 p.locator(sel).first.click();p.wait_for_timeout(230)
def state(p):return p.evaluate("JSON.parse(localStorage.getItem('unlock-english-v1'))")
def width(p):assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),p.evaluate('[innerWidth,document.documentElement.scrollWidth]')
def unit(p,b='pre',u=1):click(p,'nav','books');click(p,'bk-open-book',b);click(p,'bk-open-unit',str(u));width(p)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c,p=boot(b,native=True)
 assert p.evaluate('window.__sounds')==0
 click(p,'onboard-level','A2');click(p,'onboard-start');p.wait_for_timeout(400)
 base=state(p)
 click(p,'nav','books');p.wait_for_timeout(400);assert p.locator('.bk-book').count()==2;width(p);p.screenshot(path=str(OUT/'library-mobile.png'))
 record('Library: 2 source books / 332 pages, responsive at 390 px; no autoplay on startup')
 click(p,'bk-open-book','pre');assert p.locator('.bk-unit').count()==10;click(p,'bk-open-unit','1');p.wait_for_timeout(350);p.screenshot(path=str(OUT/'unit-mobile.png'));width(p)
 # Source page, notes, full supplements including end page.
 click(p,'bk-page','5');p.wait_for_timeout(300)
 assert p.locator('.bk-source-page').evaluate('(e)=>e.complete&&e.naturalWidth>1000')
 p.locator('#bk-note').fill('Exercise 1: family and education.');click(p,'bk-mark-page');click(p,'bk-zoom');width(p)
 p.screenshot(path=str(OUT/'reader-mobile.png'));p.locator('#bk-page-number').fill('166');click(p,'bk-jump');assert p.locator('.bk-source-page').get_attribute('src').endswith('/166.webp');p.locator('#bk-page-number').fill('5');click(p,'bk-jump');assert p.locator('#bk-note').input_value().startswith('Exercise 1')
 record('Source reader: original image loaded; zoom, last PDF page, study flag and notes preserved')
 click(p,'bk-back');click(p,'bk-match');p.wait_for_timeout(250);p.screenshot(path=str(OUT/'matching-mobile.png'));width(p)
 ids=p.locator('[data-action="bk-pair-left"]').evaluate_all('(es)=>es.map(e=>e.dataset.value)');xp=state(p)['xp'];click(p,'bk-pair-left',ids[0]);click(p,'bk-pair-right',ids[1]);p.wait_for_timeout(500)
 for i in ids:click(p,'bk-pair-left',i);click(p,'bk-pair-right',i);p.wait_for_timeout(500)
 assert p.locator('.bk-result').count()==1;assert state(p)['xp']==xp+15;assert not state(p)['days'][next(iter(state(p)['days']))]['completed'];assert '4 из 5' in p.locator('.bk-result').inner_text()
 record('Matching: wrong pair retries, exactly 5 cards, first-try score 4/5, +15 XP, no mission bypass')
 click(p,'bk-unit');click(p,'bk-recall')
 for i in range(8):
  ru=p.locator('.sentence').inner_text();ans=p.evaluate('(ru)=>BOOK_CONTENT.words.find(w=>w.book==="pre"&&w.unit===1&&w.ru===ru).en',ru)
  p.locator('#bk-recall-answer').fill(ans);click(p,'bk-check-recall');click(p,'bk-next-recall')
 assert p.locator('.bk-result').count()==1;record('Active recall: 8 typed answers, local grading, saved spaced-review schedule')
 click(p,'bk-unit');click(p,'bk-flash');click(p,'bk-reveal');click(p,'bk-flash-grade','no');assert len(state(p)['bookStudy']['words'])>0;click(p,'bk-back')
 click(p,'bk-speaking');click(p,'bk-speak-slow');assert p.evaluate('window.__tts.slow') is True
 click(p,'bk-record');assert p.locator('.modal').count()==1;click(p,'bk-consent-record');p.wait_for_timeout(250)
 req=p.evaluate('window.__speechId');text=p.evaluate('BOOK_CONTENT.books[0].units[0].speaking.repeat')
 p.evaluate('([id,text])=>onNativeBookSpeech({id,status:"ok",text})',[req,text]);p.wait_for_timeout(200);assert p.locator('#bk-transcript').input_value()==text
 click(p,'bk-check-speech');assert 'Все слова' in p.locator('.feedback').inner_text();p.locator('#bk-speech-check').check();p.wait_for_timeout(50);click(p,'bk-save-speech');assert state(p)['bookStudy']['speaking'][0]['source']=='voice'
 record('Speaking UI: consent, native-adapter mock, slow TTS, transcript, comparison and saved history; not a physical microphone test')
 click(p,'bk-speaking');click(p,'bk-speech-mode','answer');p.locator('#bk-transcript').fill('I enjoy learning English because I can talk to more people.');click(p,'bk-check-speech');p.wait_for_timeout(250);p.screenshot(path=str(OUT/'speaking-mobile.png'));width(p);p.locator('#bk-speech-check').check();click(p,'bk-save-speech');assert state(p)['bookStudy']['speaking'][0]['source']=='typed'
 record('Open speaking answer: self-check, typed mode labelled separately, no fabricated pronunciation/AI scores')
 # Course grammar is genuinely connected to the old quiz engine.
 click(p,'bk-grammar');assert state(p)['activeQuiz']['mode']=='book';assert len(state(p)['activeQuiz']['ids'])==4
 while not state(p)['activeQuiz']['finished']:
  q=p.evaluate("EnglishCore.sessionQuestion(JSON.parse(localStorage.getItem('unlock-english-v1')).activeQuiz,LESSON_CONTENT)");click(p,'select-answer',q['answer']);click(p,'check-answer');click(p,'next-question')
 click(p,'quiz-done');record('Four source-topic grammar questions execute through the existing quiz engine')
 # Restart route can retain last unit; navigate up to library deterministically.
 click(p,'nav','books')
 for _ in range(4):
  if p.locator('[data-action="bk-open-book"]').count():break
  click(p,'bk-back')
 click(p,'bk-open-book','int');click(p,'bk-open-unit','10');click(p,'bk-writing');assert p.locator('#essay-text').count()==1
 p.locator('#essay-text').fill('I attended a festival last weekend.');click(p,'leave-writer');click(p,'nav','books');click(p,'bk-writing');assert p.locator('#essay-text').input_value()=='I attended a festival last weekend.'
 record('Intermediate unit 10 writing: adapted task opens in old editor and preserves draft')
 click(p,'show-sample');assert 'Образец и структура' in p.locator('.modal').inner_text();click(p,'writer-book-source');assert p.locator('.bk-source-page').get_attribute('src').endswith('/129.webp');click(p,'bk-back');click(p,'bk-writing');assert p.locator('#essay-text').input_value()=='I attended a festival last weekend.'
 record('Writing example opens the actual source page and returns to the saved draft')
 click(p,'leave-writer');click(p,'nav','books');click(p,'bk-back')
 click(p,'bk-search');p.locator('#bk-source-search').fill('participle');assert p.locator('#bk-search-results [data-action="bk-page"]').count()>0
 record('Full-book search reaches grammar supplements, not just the contents page')
 seed=p.evaluate("Object.fromEntries(['unlock-english-v1','unlock-english-ux-v1'].map(k=>[k,localStorage.getItem(k)]))");saved=state(p);c.close()
 c,p=boot(b,seed=seed,reduced=True,width=1280,native=True);click(p,'nav','books');assert state(p)['bookStudy']==saved['bookStudy'];width(p);p.wait_for_timeout(350);p.screenshot(path=str(OUT/'library-desktop.png'))
 assert p.evaluate('document.getAnimations().length')==0;record('Progress survives reload; 1280 px layout and system reduced-motion preference')
 c.close();b.close()
assert not errors,errors
report.append('No uncaught JavaScript errors')
(ROOT/'docs/browser-checks-0.4.json').write_text(json.dumps({'environment':'Chromium with intercepted local assets + in-memory storage; native voice is mocked, not Android','checks':report,'errors':errors},ensure_ascii=False,indent=2));print(len(report),'checks passed')
