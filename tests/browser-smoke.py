"""Isolated Chromium rendering of the self-contained HTML (no navigation/network).
Requires Python Playwright + Chromium. Uses memory-backed storage fixtures because
this environment denies navigation to file/localhost. This is not an Android test.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'tests/fixtures/Unlock-English-0.3-preview.html').read_text()
OUT=ROOT/'docs/screenshots-0.3'
OUT.mkdir(exist_ok=True,parents=True)
report=[]
errors=[]

def record(label):
    report.append(label)
    print('PASS:',label,flush=True)

def boot(browser,seed=None,reduced=False,width=390,height=844):
    context=browser.new_context(viewport={'width':width,'height':height},timezone_id='Asia/Qostanay',reduced_motion='reduce' if reduced else 'no-preference')
    page=context.new_page()
    page.set_default_timeout(8000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate('''seed => {
      for (const key of ['localStorage','sessionStorage']) {
        const data=new Map(Object.entries(key==='localStorage'?(seed||{}):{}));
        Object.defineProperty(window,key,{value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear()},configurable:true});
      }
      window.__audioStarts=0;window.__audioStops=0;
      const Base=window.AudioContext;
      if(Base) window.AudioContext=class extends Base {
        createOscillator(){const o=super.createOscillator();const start=o.start.bind(o),stop=o.stop.bind(o);
          o.start=(...args)=>{window.__audioStarts++;return start(...args);};
          o.stop=(...args)=>{window.__audioStops++;return stop(...args);};return o;}
      };
    }''',seed or {})
    page.set_content(HTML,wait_until='load')
    page.wait_for_timeout(200)
    return context,page

def click(page,action):page.locator(f'[data-action="{action}"]').first.click()
def state(page):return page.evaluate("JSON.parse(localStorage.getItem('unlock-english-v1'))")
def question(page):return page.evaluate("EnglishCore.sessionQuestion(JSON.parse(localStorage.getItem('unlock-english-v1')).activeQuiz,LESSON_CONTENT)")
def answer(page,wrong=False):
    q=question(page)
    value=next((x for x in q.get('options',[]) if x!=q['answer']),'incorrect') if wrong else q['answer']
    if q['type']=='choice':
        for b in page.locator('[data-action="select-answer"]').all():
            if b.get_attribute('data-value')==value:b.click();break
    else:page.locator('#typed-answer').fill(value)
    click(page,'check-answer')
    page.wait_for_timeout(60)

def assert_width(page):assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    ctx,page=boot(browser)
    assert page.evaluate('window.__audioStarts')==0
    # Pick an A1 lesson, then compare demo state byte-for-byte.
    page.locator('[data-action="onboard-level"][data-value="A1"]').click()
    click(page,'onboard-start')
    page.wait_for_timeout(450)
    assert_width(page)
    page.screenshot(path=str(OUT/'home-mobile.png'))
    before=state(page)
    click(page,'ux-settings');click(page,'ux-demo')
    page.wait_for_timeout(100)
    assert state(page)==before
    assert page.locator('.celebration-modal').count()==1
    assert page.locator('.ux-confetti').count()==30
    assert page.evaluate('window.__audioStarts')==8
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT/'celebration-demo-mobile.png'))
    record('Demo celebration: 30 transient particles, 8 scheduled tones, no changes to mission/XP')
    click(page,'close-modal');page.wait_for_timeout(210)
    assert page.locator('.modal').count()==0
    assert not page.locator('#app').evaluate('(el)=>el.inert')
    record('Modal exit finishes and restores access to the page')
    click(page,'start-daily')
    n=page.evaluate('window.__audioStarts')
    answer(page,wrong=True)
    assert page.locator('.feedback.wrong').count()==1
    assert page.evaluate('window.__audioStarts')==n+2
    page.wait_for_timeout(280)
    page.screenshot(path=str(OUT/'wrong-answer-mobile.png'))
    record('Wrong answer: explanation visible, exactly 2 scheduled tones')
    click(page,'next-question')
    n=page.evaluate('window.__audioStarts')
    answer(page)
    assert page.locator('.feedback:not(.wrong)').count()==1
    assert page.evaluate('window.__audioStarts')==n+3
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT/'correct-answer-mobile.png'))
    record('Correct answer: distinct success styling, exactly 3 scheduled tones')
    click(page,'next-question')
    rounds=0
    while not state(page)['activeQuiz']['finished']:
        rounds+=1
        assert rounds<20
        answer(page);click(page,'next-question')
    assert page.locator('.result-visual').count()==1
    assert page.locator('.celebration-modal').count()==0
    record('Quiz with an error and repair completes without falsely completing the daily mission')
    click(page,'quiz-to-writing')
    sample=page.evaluate("LESSON_CONTENT.prompts.find(p=>p.id===EnglishCore.ensureDay(JSON.parse(localStorage.getItem('unlock-english-v1')),LESSON_CONTENT).promptId).sample")
    page.locator('#essay-text').fill(sample)
    click(page,'analyze-writing')
    click(page,'save-writing')
    page.wait_for_timeout(170)
    completed=state(page)
    today=page.evaluate('EnglishCore.dayKey()')
    assert completed['days'][today]['completed'] is True
    assert completed['xp']==100
    assert page.locator('.celebration-modal').count()==1
    assert '+20' in page.locator('.celebration-stats').inner_text()
    page.wait_for_timeout(450)
    page.screenshot(path=str(OUT/'mission-complete-mobile.png'))
    record('Full daily mission completes: writing + quiz + repair, real +20 XP bonus, victory dialog')
    click(page,'celebration-done');page.wait_for_timeout(250)
    assert page.locator('.celebration-modal').count()==0
    click(page,'ux-settings');click(page,'ux-sound');click(page,'ux-motion')
    assert page.locator('[data-action="ux-sound"]').get_attribute('aria-checked')=='false'
    assert page.locator('[data-action="ux-motion"]').get_attribute('aria-checked')=='false'
    assert page.locator('#ux-volume').is_disabled()
    n=page.evaluate('window.__audioStarts')
    click(page,'ux-demo');page.wait_for_timeout(100)
    assert page.evaluate('window.__audioStarts')==n
    assert page.locator('.ux-confetti').count()==0
    assert page.evaluate('document.getAnimations().length')==0
    record('Quiet/reduced mode: no new tones, particles or active animations')
    seed=page.evaluate("Object.fromEntries(['unlock-english-v1','unlock-english-ux-v1'].map(k=>[k,localStorage.getItem(k)]))")
    ctx.close()
    ctx,page=boot(browser,seed=seed)
    assert state(page)['xp']==100
    assert page.locator('.celebration-modal').count()==0
    assert page.evaluate('window.__audioStarts')==0
    assert page.locator('html').get_attribute('data-motion')=='reduced'
    record('Restored state retains XP/settings and does not replay mission celebration or sound')
    ctx.close()
    ctx,page=boot(browser,reduced=True,width=320,height=640)
    click(page,'ux-settings');click(page,'ux-demo');page.wait_for_timeout(150)
    assert page.locator('.ux-confetti').count()==0
    assert page.evaluate('document.getAnimations().length')==0
    assert_width(page)
    page.screenshot(path=str(OUT/'reduced-motion-320.png'))
    page.keyboard.press('Escape');page.wait_for_timeout(30)
    assert page.locator('.modal').count()==0
    record('OS reduced-motion respected; 320px layout does not overflow; Escape closes dialog')
    ctx.close()
    ctx,page=boot(browser,width=1440,height=1000)
    click(page,'onboard-start');page.wait_for_timeout(450)
    page.screenshot(path=str(OUT/'home-desktop.png'))
    for action in ['practice','writing','progress','focus','home']:
        page.locator(f'[data-action="nav"][data-value="{action}"]').click()
        page.wait_for_timeout(190)
        assert_width(page)
        assert page.locator('.ux-page-ghost').count()==0
    click(page,'ux-settings');page.wait_for_timeout(430)
    page.screenshot(path=str(OUT/'settings-desktop.png'))
    record('Desktop: all five tabs render; exit snapshots are cleaned up; no horizontal overflow')
    ctx.close();browser.close()
assert not errors,errors
record('No uncaught browser JavaScript errors across all scenarios')
(ROOT/'docs/browser-smoke-0.3.json').write_text(json.dumps({'environment':'Isolated Chromium, in-memory storage, no file/localhost navigation, no API requests, not Android','passed':report,'page_errors':errors},ensure_ascii=False,indent=2))
print(f'{len(report)} browser checks passed',flush=True)
