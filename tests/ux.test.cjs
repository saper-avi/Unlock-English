'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const U=require('../web/ux.js');
function fixture({state='running',sound=true,volume=.38}={}) {
  let prefs={sound,volume,motion:true};const contexts=[];
  const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(v){this.value=v;}});
  class Audio {
    constructor(){this.state=state;this.currentTime=1;this.destination={};this.nodes=[];contexts.push(this);}
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createOscillator(){const node={frequency:param(),connect(){},disconnect(){},start(t){this.started=t;},stop(t){this.stopped=t??true;}};this.nodes.push(node);return node;}
    resume(){this.state='running';return Promise.resolve();}
  }
  const env={AudioContext:Audio,document:{hidden:false}};
  const audio=U.createAudio(env,()=>prefs);
  return {env,audio,contexts,prefs};
}
test('preferences normalize missing, corrupt and out-of-range values',()=>{
  assert.deepEqual(U.settings('{broken'),{sound:true,motion:true,volume:.62});
  assert.equal(U.settings({volume:Infinity}).volume,.62);assert.equal(U.settings({volume:9}).volume,1);assert.equal(U.settings({volume:-4}).volume,0);
  assert.deepEqual(U.settings({sound:false,motion:false,volume:.15}),{sound:false,motion:false,volume:.15});
});
test('no audio context or cue before a user interaction',()=>{const f=fixture();assert.equal(f.audio.play('correct'),false);assert.equal(f.contexts.length,0);});
test('distinct correct and error cues schedule bounded oscillator envelopes',()=>{
  const f=fixture();f.audio.activate();assert.equal(f.audio.play('correct'),true);assert.equal(f.contexts[0].nodes.length,3);
  assert.equal(f.audio.play('incorrect'),true);assert.equal(f.contexts[0].nodes.length,5);
  assert.ok(f.contexts[0].nodes.slice(0,3).every(n=>n.stopped===true));
  for(const cue of Object.values(U.CUES))for(const [hz,onset,duration,gain]of cue){assert.ok(hz>0&&hz<2000);assert.ok(onset>=0&&onset+duration<1.5);assert.ok(gain>0&&gain<=.2);}
});
test('one shared audio context is reused across all cues',()=>{const f=fixture();f.audio.activate();for(const name of Object.keys(U.CUES))f.audio.play(name);f.audio.activate();assert.equal(f.contexts.length,1);});
test('mute stops an active fanfare and prevents subsequent playback',()=>{const f=fixture();f.audio.activate();f.audio.play('complete');f.prefs.sound=false;f.audio.volume();assert.ok(f.contexts[0].nodes.every(n=>n.stopped===true));assert.equal(f.audio.play('correct'),false);assert.equal(f.contexts[0].nodes.length,8);});
test('volume zero, hidden document and unknown cue are silent',()=>{const f=fixture();f.audio.activate();f.prefs.volume=0;assert.equal(f.audio.play('complete'),false);f.prefs.volume=.3;f.env.document.hidden=true;assert.equal(f.audio.play('complete'),false);f.env.document.hidden=false;assert.equal(f.audio.play('anything'),false);});
test('missing or throwing Web Audio does not break learning',()=>{const a=U.createAudio({},()=>({sound:true,volume:1}));assert.doesNotThrow(()=>a.activate());assert.equal(a.play('correct'),false);const b=U.createAudio({AudioContext:class{constructor(){throw Error('unsupported');}}},()=>({sound:true,volume:1}));b.activate();assert.equal(b.play('incorrect'),false);});
test('suspended audio is resumed and scheduled after activation',async()=>{const f=fixture({state:'suspended'});f.audio.activate();await Promise.resolve();assert.equal(f.audio.play('correct'),true);assert.equal(f.contexts[0].nodes.length,3);});
test('a pending resume cannot play after sound is disabled',async()=>{
  const f=fixture({state:'suspended'});f.audio.activate();f.contexts[0].state='suspended';let resume;
  f.contexts[0].resume=()=>new Promise(resolve=>resume=()=>{f.contexts[0].state='running';resolve();});
  f.audio.play('complete');f.prefs.sound=false;f.audio.volume();resume();await Promise.resolve();assert.equal(f.contexts[0].nodes.length,0);
});
test('settings persist independently from learning progress',()=>{
  const values=new Map([['unlock-english-v1','unchanged-progress']]);const env={localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}};
  const ux=U.create(env);ux.update({sound:false,motion:false,volume:.21});
  assert.equal(values.get('unlock-english-v1'),'unchanged-progress');assert.deepEqual(U.create(env).getSettings(),{sound:false,motion:false,volume:.21});
});
test('storage denial does not prevent settings or render',()=>{
  const ux=U.create({get localStorage(){throw Error('blocked');}});ux.update({sound:false});const root={innerHTML:''};ux.mount(root,'<p>Lesson</p>');assert.equal(root.innerHTML,'<p>Lesson</p>');
});
test('OS reduced motion overrides animation preference and reacts to changes',()=>{
  let onChange;const media={matches:true,addEventListener(_,fn){onChange=fn;}};const doc={documentElement:{dataset:{}}};const ux=U.create({document:doc,matchMedia:()=>media});let calls=0;const node={animate(){calls++;}};
  assert.equal(ux.motion(),false);assert.equal(doc.documentElement.dataset.motion,'reduced');ux.animate(node,[]);assert.equal(calls,0);
  media.matches=false;onChange();assert.equal(ux.motion(),true);ux.update({motion:false});assert.equal(ux.motion(),false);
});
test('cancelling motion does not leave an unhandled rejection',async()=>{
  const ux=U.create({});let reject;const animation={finished:new Promise((_,r)=>reject=r),cancel(){reject(new Error('cancelled'));}};
  ux.animate({animate:()=>animation},[]);ux.update({motion:false});await Promise.resolve();
});
test('fallback rendering works without Web Animations',()=>{const ux=U.create({});const root={innerHTML:'before'};assert.doesNotThrow(()=>ux.mount(root,'after'));assert.equal(root.innerHTML,'after');assert.equal(ux.animate({},[]),null);});
