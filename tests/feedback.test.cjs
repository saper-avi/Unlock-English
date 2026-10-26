'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const F=require('../web/feedback.js');const C=require('../web/core.js');const {loadContent}=require('../backend/server.cjs');const {createClient}=require('../web/ai-client.js');
const content=loadContent();const clone=x=>JSON.parse(JSON.stringify(x));
test('fixed demonstration obeys the response contract and references real source fragments',()=>{const d=F.demo();assert.equal(F.validateFeedback(d.feedback,d.text),d.feedback);assert.equal(d.feedback.scores,null);});
test('stable sentence ids distinguish repeated fragments across sentences and Unicode',()=>{
  const text='  Yesterday I go home.\nToday I go to café! It’s nice.';
  const parts=F.sentences(text);assert.deepEqual(parts.map(p=>p.id),['s1','s2','s3']);
  for(const p of parts)assert.equal(text.slice(p.start,p.start+p.text.length),p.text);
  const d=F.demo().feedback;d.errors=d.errors.slice(0,1);d.errors[0].sentence_id='s2';
  assert.doesNotThrow(()=>F.validateFeedback(d,text));
  d.errors[0].sentence_id='s3';assert.throws(()=>F.validateFeedback(d,text),/fragment/);
});
test('nonexistent fragments, invalid category, duplicate errors and artificial no-op fixes are rejected',()=>{
  const {text,feedback}=F.demo();
  for(const change of [f=>f.errors[0].original_fragment='unseen word',f=>f.errors[0].category='made_up',f=>f.errors.push(clone(f.errors[0])),f=>f.errors[0].replacement=f.errors[0].original_fragment]){
    const f=clone(feedback);change(f);assert.throws(()=>F.validateFeedback(f,text));
  }
});
test('strict schema rejects extra fields, string scores and grades outside 0–10',()=>{
  const {text,feedback}=F.demo();
  for(const change of [f=>f.unlock_apps=true,f=>f.scores={grammar:12,vocabulary:5,coherence:5,task_response:5},f=>f.scores={grammar:'8',vocabulary:5,coherence:5,task_response:5},f=>delete f.status]){
    const f=clone(feedback);change(f);assert.throws(()=>F.validateFeedback(f,text));
  }
});
test('a correct text may return zero errors and a null score',()=>{
  const text='I enjoy reading books after class.';const f=clone(F.demo().feedback);f.errors=[];f.priority_topics=[];f.corrected_text=text;f.warnings_ru=[];assert.doesNotThrow(()=>F.validateFeedback(f,text));
});
test('cannot_assess has no invented scores, edits, suggestions or learning priorities',()=>{
  const f=clone(F.demo().feedback);f.status='cannot_assess';assert.throws(()=>F.validateFeedback(f,F.demo().text));
  Object.assign(f,{errors:[],suggestions:[],scores:null,corrected_text:null,priority_topics:[]});assert.doesNotThrow(()=>F.validateFeedback(f,F.demo().text));
});
test('reviews migrate safely, deduplicate identical versions, and never change mission or XP',()=>{
  const state=C.defaultState();state.xp=30;const before=JSON.stringify(state);
  const record={id:'review-0001',promptId:'a2-x',text:F.demo().text,level:'A2',createdAt:Date.now(),feedback:F.demo().feedback};
  const saved=F.storeReview(undefined,record);assert.equal(saved.reviews.length,1);assert.deepEqual(saved.priorityTopics,['past_simple']);
  assert.equal(F.storeReview(saved,{...record,id:'review-0002'}).reviews.length,1);assert.equal(JSON.stringify(state),before);
  assert.deepEqual(F.restore({version:1,reviews:[{invalid:true}]}),F.emptyState());
});
test('past-simple feedback selects real A2 bank questions, not generated content',()=>{
  const raw={version:1,reviews:[{id:'review-0001',promptId:'x',text:F.demo().text,level:'A2',createdAt:1,feedback:F.demo().feedback}]};
  const q=F.recommendations(raw,content.questions,'A2');assert.ok(q.length>0);assert.ok(q.every(q=>q.topic==='past-simple'&&q.level==='A2'));
  assert.equal(F.recommendations(raw,content.questions,'A1').length,0);
});
test('preferred questions affect only a new day, with at most two and no cross-level duplicates',()=>{
  const s=C.defaultState();s.level='A2';const pool=content.questions.filter(q=>q.level==='A2');
  const a=C.ensureDay(s,content,'2026-10-25',[pool[0].id,pool[0].id,pool[1].id,pool[2].id,'not-real']);
  assert.equal(a.questionIds[0],pool[0].id);assert.equal(a.questionIds[1],pool[1].id);assert.equal(new Set(a.questionIds).size,5);
  assert.deepEqual(C.ensureDay(s,content,'2026-10-25',[pool[3].id]),a);
});
test('saving unchanged writing is idempotent for history and XP; a revised version is retained',()=>{
  const s=C.defaultState();C.ensureDay(s,content,'2026-10-25');const p=content.prompts.find(p=>p.id===s.days['2026-10-25'].promptId);
  // A sample is optional for book topics; this test concerns saved submissions, not model essays.
  const text=p.book?('I practise English every day because I want to explain my ideas clearly. I read a short text and write a few sentences about my experience. Learning new words helps me understand people and discuss important subjects with my friends. ').repeat(Math.ceil(p.minWords/40)):p.sample;
  const a=C.saveWriting(s,p,text,'2026-10-25',true);const b=C.saveWriting(s,p,text,'2026-10-25',true);
  assert.equal(a.record.id,b.record.id);assert.equal(s.writingHistory.length,1);assert.equal(s.xp,30);
  C.saveWriting(s,p,text+' I enjoyed this exercise.','2026-10-25',true);assert.equal(s.writingHistory.length,2);assert.equal(s.xp,30);
});
test('client refuses an OpenAI key in place of a personal server token without a network call',async()=>{
  let calls=0;const client=createClient({fetchImpl:()=>{calls++;}});
  await assert.rejects(client.review({text:'This is a writing test.',promptId:'x',submissionId:'test-0001',token:'sk-not-a-real-key'}),/токен сервера/);assert.equal(calls,0);
});
test('client validates submission identity and server-origin source',async()=>{
  const client=createClient({fetchImpl:async()=>({ok:true,json:async()=>({schema_version:'1.0',source:'openai',submission_id:'someone-else'})})});
  await assert.rejects(client.review({text:'This is a writing test.',promptId:'x',submissionId:'test-0001',token:'a'.repeat(32)}),/не соответствует/);
});
test('client cancellation releases pending state and does not erase user data',async()=>{
  const client=createClient({fetchImpl:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort'))))});
  const pending=client.review({text:'This is a writing test.',promptId:'x',submissionId:'test-0001',token:'a'.repeat(32)});client.cancel();await assert.rejects(pending,/отменено/);
});
test('content bank is byte-identical to the recovered original',()=>{assert.deepEqual(fs.readFileSync(path.join(__dirname,'../web/content.js')),fs.readFileSync(path.join(__dirname,'../original/web/content.js')));});
