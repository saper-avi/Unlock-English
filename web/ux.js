/* Local motion + procedural sound. No network, libraries or access to learning state. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnlockUX = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORE = 'unlock-english-ux-v1';
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  // [frequency Hz, onset seconds, duration seconds, gain, waveform]. Original cues.
  const CUES = {
    correct: [[659.25,0,.17,.17,'sine'],[880,.10,.30,.14,'sine'],[1318.51,.11,.19,.035,'sine']],
    incorrect: [[293.66,0,.16,.13,'sine'],[246.94,.12,.23,.10,'sine']],
    finish: [[523.25,0,.22,.13,'sine'],[659.25,.12,.23,.13,'sine'],[783.99,.24,.37,.14,'sine']],
    complete: [[523.25,0,.30,.13,'sine'],[659.25,.13,.30,.13,'sine'],[783.99,.26,.34,.12,'sine'],[1046.50,.44,.62,.13,'sine'],[261.63,.44,.68,.045,'triangle'],[659.25,.44,.68,.055,'sine'],[783.99,.44,.68,.055,'sine'],[1318.51,.70,.43,.045,'sine']]
  };
  function settings(raw) {
    try { if (typeof raw === 'string') raw = JSON.parse(raw); } catch (_) { raw = null; }
    const s = raw && typeof raw === 'object' ? raw : {};
    return { sound: typeof s.sound === 'boolean' ? s.sound : true,
      motion: typeof s.motion === 'boolean' ? s.motion : true,
      volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.min(1,Math.max(0,s.volume)) : .62 };
  }
  function createAudio(env, getSettings) {
    let context = null, master = null, activated = false, ticket = 0;
    const voices = new Set();
    function stop() {
      ticket++;
      for (const voice of [...voices]) {
        try { voice.osc.stop(); } catch (_) {}
        try { voice.osc.disconnect(); voice.gain.disconnect(); } catch (_) {}
        voices.delete(voice);
      }
    }
    function ensure() {
      if (context && context.state !== 'closed') return context;
      const Audio = env.AudioContext || env.webkitAudioContext;
      if (!Audio) return null;
      try { context = new Audio(); master = context.createGain(); master.gain.value = getSettings().volume; if(context.createDynamicsCompressor){const limiter=context.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=5;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter);limiter.connect(context.destination);}else master.connect(context.destination); }
      catch (_) { context = null; master = null; }
      return context;
    }
    function activate() {
      activated = true;
      const s = getSettings();
      if (!s.sound || !s.volume) return;
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') { try { Promise.resolve(ctx.resume()).catch(()=>{}); } catch (_) {} }
    }
    function volume() {
      const s = getSettings();
      if (!s.sound || !s.volume) stop();
      if (context && master) {
        try { master.gain.setTargetAtTime(s.sound ? s.volume : 0,context.currentTime,.015); } catch (_) {}
      }
    }
    function play(name) {
      const s = getSettings();
      if (!activated || !s.sound || !s.volume || !CUES[name] || env.document?.hidden) return false;
      const ctx = ensure();
      if (!ctx) return false;
      stop(); // One semantic cue at a time; rapid taps never stack melodies.
      const id = ticket, requested = Date.now();
      function schedule() {
        if (id !== ticket || Date.now()-requested>500 || ctx.state!=='running' || !getSettings().sound || !getSettings().volume || env.document?.hidden) return false;
        master.gain.value = getSettings().volume;
        const start = ctx.currentTime + .012;
        try {
          for (const [frequency,offset,duration,gain,type] of CUES[name]) {
            const osc = ctx.createOscillator(), envelope = ctx.createGain();
            osc.type = type; osc.frequency.setValueAtTime(frequency,start+offset);
            envelope.gain.setValueAtTime(0,start+offset);
            envelope.gain.linearRampToValueAtTime(gain*1.8,start+offset+.012);
            envelope.gain.exponentialRampToValueAtTime(.0001,start+offset+duration);
            envelope.gain.setValueAtTime(0,start+offset+duration+.01);
            osc.connect(envelope); envelope.connect(master);
            const voice = {osc,gain:envelope}; voices.add(voice);
            osc.onended = ()=>{ voices.delete(voice); try {osc.disconnect();envelope.disconnect();} catch (_) {} };
            osc.start(start+offset); osc.stop(start+offset+duration+.025);
          }
          return true;
        } catch (_) { stop(); return false; }
      }
      if (ctx.state === 'running') return schedule();
      try { Promise.resolve(ctx.resume()).then(schedule).catch(()=>{}); } catch (_) {return false;}
      return true;
    }
    return {activate,play,stop,volume};
  }
  function create(env) {
    env = env || (typeof window!=='undefined' ? window : {});
    const doc = env.document;
    let stored = null;
    try { stored = env.localStorage?.getItem(STORE); } catch (_) {}
    let prefs = settings(stored);
    const media = env.matchMedia ? env.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const audio = createAudio(env,()=>prefs);
    const running = new Set();
    let ghost = null;
    const all = (node,selector)=>node?.querySelectorAll ? [...node.querySelectorAll(selector)] : [];
    const one = (node,selector)=>node?.querySelector ? node.querySelector(selector) : null;
    const motion = ()=>prefs.motion && !media?.matches;
    function stopMotion() {
      for (const a of [...running]) { try {a.cancel();} catch (_) {} }
      running.clear();
      if (ghost) {ghost.remove();ghost=null;}
      for (const node of all(doc,'.ux-confetti')) node.remove();
    }
    function apply() {
      if (doc?.documentElement) doc.documentElement.dataset.motion = motion() ? 'full' : 'reduced';
      if (!motion()) stopMotion();
    }
    if (media?.addEventListener) media.addEventListener('change',apply);
    else if (media?.addListener) media.addListener(apply);
    function update(patch) {
      prefs = settings({...prefs,...patch});
      try { env.localStorage?.setItem(STORE,JSON.stringify(prefs)); } catch (_) {}
      apply(); audio.volume();
      return {...prefs};
    }
    function animate(node,frames,options={}) {
      if (!motion() || !node?.animate) return null;
      try {
        const a = node.animate(frames,{duration:360,easing:EASE,fill:'backwards',...options});
        running.add(a);
        Promise.resolve(a.finished).then(()=>running.delete(a),()=>running.delete(a));
        return a;
      } catch (_) {return null;}
    }
    function after(a,fn) {if (a?.finished) Promise.resolve(a.finished).then(fn,fn);else fn();}
    function enter(node,delay=0,distance=12) {
      return animate(node,[{opacity:0,transform:`translateY(${distance}px)`},{opacity:1,transform:'translateY(0)'}],{duration:420,delay});
    }
    function snapshot(root) {
      if (!motion()) return;
      if (ghost) {ghost.remove();ghost=null;}
      const page = one(root,'.page, .onboarding');
      if (!page?.cloneNode || !doc?.body?.appendChild) return;
      const rect = page.getBoundingClientRect();
      // Do not clone giant editor/history pages: those get an entry transition only.
      if (rect.top < -100 || rect.height > (env.innerHeight||900)*2) return;
      const copy = page.cloneNode(true);
      copy.removeAttribute('id');
      for (const node of all(copy,'[id]')) node.removeAttribute('id');
      copy.classList.add('ux-page-ghost');copy.setAttribute('aria-hidden','true');copy.inert=true;
      Object.assign(copy.style,{position:'fixed',top:rect.top+'px',left:rect.left+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',zIndex:'5',pointerEvents:'none'});
      doc.body.appendChild(copy);ghost=copy;
      const a=animate(copy,[{opacity:.8,transform:'translateY(0)'},{opacity:0,transform:'translateY(-7px)'}],{duration:150,easing:'ease-out'});
      after(a,()=>{copy.remove();if(ghost===copy)ghost=null;});
    }
    function mount(root,html,kind='page') {
      const oldNav=one(root,'.nav-btn.active');
      const oldIndex=oldNav ? all(root,'.nav-btn').indexOf(oldNav) : -1;
      const previousProgress=one(root,'.progress-bar span')?.style?.width || '0%';
      if (kind==='page' || kind==='question') snapshot(root);
      root.innerHTML=html;
      const page=one(root,'.page, .onboarding');
      if (kind==='page' || kind==='question') {
        const children=page?.children ? [...page.children].filter(el=>!el.matches('header,.back-row,.progress-bar')) : [];
        children.slice(0,16).forEach((el,i)=>enter(el,Math.min(i*22,160),kind==='question'?9:14));
      } else if (kind==='feedback') enter(one(root,'.feedback'),0,9);
      else if (kind==='review') enter(one(root,'#writing-review'),0,12);
      const bar=one(root,'.progress-bar span');
      if (bar && bar.style.width!==previousProgress) animate(bar,[{width:previousProgress},{width:bar.style.width}],{duration:420});
      const nav=one(root,'.bottom-nav'), selected=one(nav,'.nav-btn.active');
      if (nav && selected) {
        const index=all(nav,'.nav-btn').indexOf(selected), indicator=one(nav,'.nav-indicator');
        if (indicator) {
          indicator.style.transform=`translateX(${index*100}%)`;
          if (oldIndex>=0 && oldIndex!==index) animate(indicator,[{transform:`translateX(${oldIndex*100}%)`},{transform:`translateX(${index*100}%)`}],{duration:420});
        }
      }
      if (kind==='page') {
        const ring=one(root,'.mission-ring circle:last-child');
        if (ring) animate(ring,[{strokeDashoffset:188.5},{strokeDashoffset:0}],{duration:700,delay:140});
      }
    }
    function answer(correct) {
      audio.play(correct?'correct':'incorrect');
      const node=one(doc,correct?'.option.correct .option-index':'.option.wrong, .answer-input');
      if (correct) animate(node,[{transform:'scale(.85)'},{transform:'scale(1.15)',offset:.5},{transform:'scale(1)'}],{duration:330});
      else animate(node,[{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(-2px)'},{transform:'translateX(0)'}],{duration:290,easing:'ease-out'});
    }
    function press(target,event) {
      if (!motion() || !target?.getBoundingClientRect || target.disabled || !target.matches('button')) return;
      if (target.classList.contains('switch') || target.classList.contains('nav-btn')) return;
      const r=target.getBoundingClientRect();
      const dot=doc.createElement('span');dot.className='ux-ripple';dot.setAttribute('aria-hidden','true');
      const x=event?.detail ? event.clientX-r.left : r.width/2;
      const y=event?.detail ? event.clientY-r.top : r.height/2;
      const size=Math.max(r.width,r.height)*2;
      Object.assign(dot.style,{width:size+'px',height:size+'px',left:(x-size/2)+'px',top:(y-size/2)+'px'});
      target.appendChild(dot);
      after(animate(dot,[{opacity:.16,transform:'scale(0)'},{opacity:0,transform:'scale(1)'}],{duration:470,easing:'ease-out'}),()=>dot.remove());
    }
    function openModal(root) {
      const backdrop=one(root,'.modal-backdrop'),panel=one(root,'.modal');
      animate(backdrop,[{opacity:0},{opacity:1}],{duration:200,easing:'ease-out'});
      enter(panel,0,28);
    }
    function closeModal(root,done) {
      const panel=one(root,'.modal');
      if (!panel || !motion()) {done();return;}
      animate(panel,[{transform:'translateY(0)'},{transform:'translateY(16px)'}],{duration:170,easing:'ease-in'});
      after(animate(one(root,'.modal-backdrop'),[{opacity:1},{opacity:0}],{duration:170,easing:'ease-in'}),done);
    }
    function celebrate(root,kind='complete') {
      audio.play(kind);
      const visual=one(root,'.celebration-emblem, .result-visual');
      animate(visual,[{transform:'scale(.65) rotate(-12deg)',opacity:0},{transform:'scale(1.07) rotate(2deg)',opacity:1,offset:.65},{transform:'scale(1) rotate(0)',opacity:1}],{duration:650});
      all(root,'.celebration-copy > *, .celebration-stats, .celebration-actions').forEach((el,i)=>enter(el,100+i*65,9));
      if (!motion()) return;
      const stage=one(root,'.celebration-stage') || visual;
      if (!stage || !doc?.createElement) return;
      const amount=kind==='complete'?30:14;
      for (let i=0;i<amount;i++) {
        const piece=doc.createElement('i');piece.className='ux-confetti';piece.setAttribute('aria-hidden','true');
        piece.style.setProperty('--confetti-color',['#b7dd70','#276d50','#d6b35c','#90b8a4'][i%4]);
        piece.style.borderRadius=i%3===0?'50%':'2px';stage.appendChild(piece);
        const angle=(i/amount)*Math.PI*2,reach=58+(i*37%82),x=Math.cos(angle)*reach,y=Math.sin(angle)*reach-32;
        const a=animate(piece,[{opacity:0,transform:'translate(0,0) scale(.3) rotate(0)'},{opacity:1,transform:`translate(${x}px,${y}px) scale(1) rotate(${i*29}deg)`,offset:.32},{opacity:0,transform:`translate(${x*1.22}px,${y+100}px) scale(.65) rotate(${i*47+160}deg)`}],{duration:1100+(i%4)*120,delay:70+(i%5)*22,easing:'cubic-bezier(.18,.66,.32,1)'});
        after(a,()=>piece.remove());
      }
    }
    function quiet() {audio.stop();stopMotion();}
    apply();
    return {getSettings:()=>({...prefs}),motion,systemReduced:()=>!!media?.matches,update,activate:audio.activate,play:audio.play,quiet,animate,enter,mount,answer,press,openModal,closeModal,celebrate,stopSound:audio.stop};
  }
  return {STORE,CUES,settings,createAudio,create};
});
