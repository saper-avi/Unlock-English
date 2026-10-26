'use strict';
// These are controller smoke tests with minimal DOM doubles, NOT browser/visual tests.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function harness(reviewImpl) {
  const elements=new Map();const handlers={};
  const element=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){}},querySelector(selector){return selector==='button'?{focus(){}}:null;},focus(){},scrollIntoView(){},remove(){},select(){},appendChild(){}});return elements.get(id);};
  const storage=()=>({items:new Map(),getItem(k){return this.items.get(k)||null;},setItem(k,v){this.items.set(k,String(v));},removeItem(k){this.items.delete(k);}});
  const document={getElementById:element,addEventListener(name,fn){handlers[name]=fn;},body:{style:{},appendChild(){}},querySelector(){return null;},createElement(){return element('created');},hidden:false,activeElement:null};
  const ctx={document,console,Intl,Date,Math,JSON,Set,Map,Promise,AbortController,crypto:require('node:crypto').webcrypto,localStorage:storage(),sessionStorage:storage(),
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},addEventListener(){},scrollTo(){}};
  ctx.window=ctx;ctx.globalThis=ctx;
  vm.createContext(ctx);
  for(const file of ['content.js','core.js','feedback.js','ai-client.js','ux.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../web',file),'utf8'),ctx,{filename:file});
  const effects=[];const createUX=ctx.UnlockUX.create;ctx.UnlockUX.create=(...args)=>{const ux=createUX(...args);for(const name of ['answer','celebrate']){const fn=ux[name];ux[name]=(...args)=>{effects.push({name,value:name==='answer'?args[0]:args[1]});return fn(...args);};}return ux;};
  let calls=0;
  ctx.WritingAI={id:()=> 'ui-submission-0001',createClient:()=>({status:async()=>({ai_configured:true}),cancel(){},review:async req=>{calls++;return reviewImpl?reviewImpl(req,ctx):{feedback:ctx.WritingFeedback.demo().feedback};}})};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8'),ctx,{filename:'app.js'});
  const click=(action,value)=>handlers.click({target:{closest(){return {dataset:{action,value},disabled:false};}}});
  const type=(id,value)=>{element(id).value=value;handlers.input({target:{id,value,dataset:{}}});};
  const state=()=>JSON.parse(ctx.localStorage.getItem('unlock-english-v1'));
  const html=()=>element('app').innerHTML;
  return {ctx,click,type,state,html,element,effects,calls:()=>calls};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function writing(h){h.click('onboard-start');const p=h.ctx.LESSON_CONTENT.prompts.find(p=>p.level==='A2');h.click('open-prompt',p.id);return p;}
function token(h){h.click('ai-settings');h.element('ai-token').value='controller-token-for-tests-only-000000';h.click('ai-save-token');}
test('UI controller renders onboarding, writing topics, practice and progress without runtime errors',()=>{
  const h=harness();assert.match(h.html(),/Начать свой путь/);h.click('onboard-start');
  for(const page of ['writing','practice','progress','focus','home']){h.click('nav',page);assert.ok(h.html().includes('<main'));}
});
test('demo modal does not send a request, replace the draft, award XP or add a review',()=>{
  const h=harness();const p=writing(h);h.type('essay-text','My own draft is different.');h.click('leave-writer');
  const before=h.state();h.click('ai-demo');assert.match(h.element('modal-root').innerHTML,/ДЕМО/);assert.equal(h.calls(),0);assert.deepEqual(h.state(),before);assert.equal(h.state().drafts[p.id],'My own draft is different.');
});
test('AI review is sent only after consent; result is saved separately from mission and tokens',async()=>{
  const h=harness();const p=writing(h);token(h);h.type('essay-text',h.ctx.WritingFeedback.demo().text);h.click('ai-request');
  assert.equal(h.calls(),0);assert.match(h.element('modal-root').innerHTML,/Отправить текст/);
  h.click('ai-confirm');await flush();assert.equal(h.calls(),1);const s=h.state();assert.equal(s.feedback.reviews.length,1);assert.equal(s.xp,0);assert.equal(s.writingHistory.length,0);assert.equal(JSON.stringify(s).includes('controller-token'),false);assert.equal(s.drafts[p.id],h.ctx.WritingFeedback.demo().text);assert.match(h.element('ai-slot').innerHTML,/went/);
});
test('feedback received after editing is not attached to the new draft',async()=>{
  let resolve;const h=harness((req,ctx)=>new Promise(r=>{resolve=()=>r({feedback:ctx.WritingFeedback.demo().feedback});}));const p=writing(h);token(h);h.type('essay-text',h.ctx.WritingFeedback.demo().text);h.click('ai-request');h.click('ai-confirm');h.type('essay-text','I rewrote this text while waiting for feedback.');resolve();await flush();
  assert.equal(h.state().feedback.reviews.length,1);assert.equal(h.state().drafts[p.id],'I rewrote this text while waiting for feedback.');assert.equal(h.element('ai-slot').innerHTML.includes('ИИ-РАЗБОР'),false);
});
test('model text is escaped, not rendered as executable HTML',async()=>{
  const h=harness((req,ctx)=>{const f=ctx.WritingFeedback.demo().feedback;f.summary_ru='<img src=x onerror="alert(1)">';return {feedback:f};});writing(h);token(h);h.type('essay-text',h.ctx.WritingFeedback.demo().text);h.click('ai-request');h.click('ai-confirm');await flush();assert.match(h.element('ai-slot').innerHTML,/&lt;img/);assert.equal(h.element('ai-slot').innerHTML.includes('<img src=x'),false);
});
test('a failed AI review retains the draft and local writing can still be saved',async()=>{
  const h=harness(async()=>{throw new Error('Тестовый сбой сервера');});const p=writing(h);token(h);h.type('essay-text',p.sample);h.click('ai-request');h.click('ai-confirm');await flush();assert.match(h.element('ai-slot').innerHTML,/Тестовый сбой/);h.click('analyze-writing');h.click('save-writing');assert.equal(h.state().writingHistory.length,1);assert.equal(h.state().drafts[p.id],p.sample);assert.equal(h.state().feedback.reviews.length,0);
});
test('AI recommendations populate real practice and review history can be opened',async()=>{
  const h=harness();writing(h);token(h);h.type('essay-text',h.ctx.WritingFeedback.demo().text);h.click('ai-request');h.click('ai-confirm');await flush();h.click('leave-writer');h.click('nav','practice');assert.match(h.html(),/Из текста — в практику/);h.click('ai-practice');assert.ok(h.state().activeQuiz.ids.length>0);h.click('quit-quiz');h.click('nav','progress');assert.match(h.html(),/Разборы письма/);h.click('ai-history','ui-submission-0001');assert.match(h.element('modal-root').innerHTML,/went/);
});

test('UX demo never changes learning progress or awards XP',()=>{
  const h=harness();h.click('onboard-start');const before=h.state();h.click('ux-settings');h.click('ux-demo');
  assert.match(h.element('modal-root').innerHTML,/Предпросмотр победы/);assert.match(h.element('modal-root').innerHTML,/БЕЗ НАЧИСЛЕНИЙ/);assert.deepEqual(h.state(),before);
});
test('answer feedback is emitted once per check, never on duplicate checks',()=>{
  const h=harness();
  h.click('onboard-start');h.click('start-daily');const q=h.ctx.EnglishCore.sessionQuestion(h.state().activeQuiz,h.ctx.LESSON_CONTENT);
  h.click('select-answer',q.answer);h.click('check-answer');const before=h.state();h.click('check-answer');assert.deepEqual(h.state(),before);assert.equal(h.state().activeQuiz.answers.length,1);assert.deepEqual(h.effects,[{name:'answer',value:true}]);
  h.click('next-question');h.click('select-answer','intentionally incorrect');h.click('check-answer');assert.deepEqual(h.effects.filter(e=>e.name==='answer').map(e=>e.value),[true,false]);
});
test('mission celebrates once when writing follows the quiz; revisiting does not repeat it',()=>{
  const h=harness();h.click('onboard-start');h.click('start-daily');
  let count=0;
  while(!h.state().activeQuiz.finished){assert.ok(count++<20);const q=h.ctx.EnglishCore.sessionQuestion(h.state().activeQuiz,h.ctx.LESSON_CONTENT);h.click('select-answer',q.answer);h.click('check-answer');h.click('next-question');}
  assert.equal(h.element('modal-root').innerHTML.includes('celebration-modal'),false);
  h.click('quiz-to-writing');const state=h.state(),d=state.days[h.ctx.EnglishCore.dayKey()];const p=h.ctx.LESSON_CONTENT.prompts.find(p=>p.id===d.promptId);
  h.type('essay-text',p.sample);h.click('analyze-writing');h.click('save-writing');
  assert.equal(h.state().days[h.ctx.EnglishCore.dayKey()].completed,true);assert.match(h.element('modal-root').innerHTML,/DAILY MISSION COMPLETE/);
  const xp=h.state().xp;h.click('close-modal');h.click('daily-writing');h.click('analyze-writing');h.click('save-writing');
  assert.equal(h.state().xp,xp);assert.equal(h.element('modal-root').innerHTML.includes('DAILY MISSION COMPLETE'),false);
});
test('mission celebrates when writing is completed before the quiz',()=>{
  const h=harness();h.click('onboard-start');h.click('daily-writing');const d=h.state().days[h.ctx.EnglishCore.dayKey()];const p=h.ctx.LESSON_CONTENT.prompts.find(p=>p.id===d.promptId);
  h.type('essay-text',p.sample);h.click('analyze-writing');h.click('save-writing');assert.equal(h.element('modal-root').innerHTML.includes('DAILY MISSION COMPLETE'),false);
  h.click('start-daily');let count=0;while(!h.state().activeQuiz.finished){assert.ok(count++<20);const q=h.ctx.EnglishCore.sessionQuestion(h.state().activeQuiz,h.ctx.LESSON_CONTENT);h.click('select-answer',q.answer);h.click('check-answer');h.click('next-question');}
  assert.match(h.element('modal-root').innerHTML,/DAILY MISSION COMPLETE/);assert.equal(h.state().days[h.ctx.EnglishCore.dayKey()].completed,true);
});
test('sound and motion settings do not overwrite learning state',()=>{const h=harness();h.click('onboard-start');const before=h.state();h.click('ux-settings');h.click('ux-sound');h.click('ux-motion');h.type('ux-volume','12');const pref=JSON.parse(h.ctx.localStorage.getItem('unlock-english-ux-v1'));assert.equal(pref.sound,false);assert.equal(pref.motion,false);assert.equal(pref.volume,.12);assert.deepEqual(h.state(),before);});
