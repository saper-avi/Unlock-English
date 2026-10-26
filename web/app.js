(function () {
  'use strict';
  const C = window.EnglishCore;
  const CONTENT = window.LESSON_CONTENT;
  const F = window.WritingFeedback;
  const AI = window.WritingAI;
  const aiClient = AI.createClient();
  const UX = window.UnlockUX.create(window);
  const root = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const STORE = 'unlock-english-v1';
  const paths = {
    sliders: '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    volume: '<path d="m11 4-5 4H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    book: '<path d="M12 5v16M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/>',
    pen: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
    chart: '<path d="M4 20h17M7 16v-5m5 5V4m5 12V8"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    unlock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 7.5-2m-3.5 10v2"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    circleCheck: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    spark: '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
    flame: '<path d="M12 3c1 5 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 2 4 2 4s2-3 1-8z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    leaf: '<path d="M20 3C7 2 2 8 5 15c4 8 16 3 15-12zM4 21 16 8"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>'
  };
  function icon(name, size = 22) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`; }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x])); }
  function button(label, action, cls = 'primary', attrs = '') { return `<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`; }
  function nativeCall(method, ...args) {
    try { if (window.NativeAndroid && typeof window.NativeAndroid[method] === 'function') return window.NativeAndroid[method](...args); }
    catch (e) { console.warn('Native operation unavailable:', method); }
    return undefined;
  }
  function nativeState() {
    const fallback = { native: false, accessibilityEnabled: false, selectedApps: [], availableApps: [], focusEnabled: false, missionCompletedToday: false, emergencyUntil: 0 };
    try { const raw = nativeCall('getState'); return raw ? { ...fallback, ...JSON.parse(raw) } : fallback; }
    catch (_) { return fallback; }
  }
  function load() {
    try { return C.restoreState(nativeCall('loadState') || localStorage.getItem(STORE)); }
    catch (_) { return C.defaultState(); }
  }
  if (!C || !CONTENT || !CONTENT.questions || !CONTENT.prompts) {
    root.innerHTML = '<div class="boot"><h1>Не удалось открыть уроки</h1><p>Закрой приложение и открой снова. Если ошибка повторится, установи актуальную сборку.</p></div>';
    return;
  }
  let state = load();
  state.feedback = F.restore(state.feedback);
  if(window.BookCore) state.bookStudy=window.BookCore.restore(state.bookStudy);
  let today = C.dayKey();
  if (state.activeQuiz && state.activeQuiz.day !== today) state.activeQuiz = null;
  let screen = 'home';
  let practiceLevel = state.level;
  let writingLevel = state.level;
  let activePromptId = null;
  let writerDaily = false;
  let writerDay = today;
  let writerReview = false;
  let nstate = nativeState();
  let toastTimer;
  let modalEpoch = 0, modalClosing = false, returnFocus = null;
  let chosenApps = new Set();
  let pendingImport = null;
  let saveTimer;
  let aiToken = '';
  try { aiToken = sessionStorage.getItem('ue-backend-token') || ''; } catch (_) {}
  let aiBusy = null;
  let aiError = '';
  let aiSubmission = null;
  let pendingReview = null;
  let aiGeneration = 0;
  const levelDescriptions = {
    A1: 'Основа: знакомые слова, простые фразы, короткий рассказ о себе.',
    A2: 'Повседневный английский: события, планы, сравнения и причины.',
    B1: 'Связная речь: опыт, работа, мнение и аргументы.',
    B2: 'Больше нюансов: сложная грамматика, общество, аргументация.'
  };
  const books = window.BookUI ? window.BookUI.create({getState:()=>state,save,render,toast,ux:UX,modal,closeModal,go,openWriting:id=>openWriter(id,false),startQuiz:startBookQuiz}) : null;
  function startBookQuiz(book,unit) {
    books?.leave();closeModal();
    const ids=CONTENT.questions.filter(q=>q.book===book&&q.unit===unit).map(q=>q.id);
    if(!ids.length){toast('В этом разделе пока нет адаптированного квиза.');return;}
    state.activeQuiz=C.makeSession('book', CONTENT.questions.find(q=>q.id===ids[0]).level, state, CONTENT, today);
    state.activeQuiz.ids=ids;state.activeQuiz.mode='book';save();go('quiz');
  }
  function save() {
    const json = JSON.stringify(state);
    const nativeAvailable = !!window.NativeAndroid;
    if (nativeAvailable) nativeCall('saveState', json);
    try { localStorage.setItem(STORE, json); }
    catch (_) { if (!nativeAvailable) toast('Не удалось сохранить прогресс в браузере.'); }
  }
  function day() { return C.ensureDay(state, CONTENT, today, F.recommendations(state.feedback, CONTENT.questions, state.level).slice(0,2).map(q=>q.id)); }
  function synchronizeCompletion() {
    const completedNow = C.completeDay(state, today);
    if (completedNow) save();
    const d = day();
    if (d.completed && d.quizDone && d.writingDone && !nstate.missionCompletedToday) {
      nativeCall('completeMission', today); nstate = nativeState();
    }
    return completedNow;
  }
  function toast(message) {
    clearTimeout(toastTimer);
    const el = document.getElementById('toast');
    el.textContent = message; el.classList.add('visible');
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3600);
  }
  function go(next) {
    if(screen==='books'&&next!=='books')books?.leave();
    if (screen === 'writer' && next !== 'writer') cancelAI();
    closeModal(); screen = next; render(); window.scrollTo(0, 0);
  }
  function uxButton() { return button(icon('sliders',19),'ux-settings','ux-settings-button','aria-label="Звук и эффекты" title="Звук и эффекты"'); }
  function topbar() { return `<header class="topbar"><div class="brand"><div class="brand-icon" aria-hidden="true">u.</div>unlock english</div><div class="topbar-actions">${uxButton()}<button class="level-pill" data-action="level-settings" aria-label="Выбрать уровень: ${state.level}"><i></i>${state.level}${icon('chevron', 12)}</button></div></header>`; }
  function nav() {
    return `<nav class="bottom-nav" aria-label="Главная навигация"><span class="nav-indicator" aria-hidden="true"></span>${[['home','home','Сегодня'],['practice','book','Квизы'],['books','book','Книги'],['writing','pen','Тексты'],['progress','chart','Прогресс'],['focus','lock','Фокус']].map(([id,ico,label]) => `<button class="nav-btn ${screen === id ? 'active' : ''}" data-action="nav" data-value="${id}" ${screen === id ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(ico)}</span>${label}</button>`).join('')}</nav>`;
  }
  function levelPicker(value, action) { return `<div class="segmented" role="group" aria-label="Уровень сложности">${C.LEVELS.map(l => button(l, action, `segment ${value === l ? 'active' : ''}`, `data-value="${l}" aria-pressed="${value === l}"`)).join('')}</div>`; }
  function render(kind = 'page') {
    if (!state.onboarded) { UX.mount(root, renderOnboarding(), kind); return; }
    day(); save();
    let html = '';
    if (screen === 'quiz') html = renderQuiz();
    else if (screen === 'writer') html = renderWriter();
    else {
      const renderers = { home: renderHome, practice: renderPractice, books:()=>books?books.render():'', writing: renderWriting, progress: renderProgress, focus: renderFocus };
      html = `<main class="page">${topbar()}${(renderers[screen] || renderHome)()}</main>${nav()}`;
    }
    UX.mount(root, html, kind);
  }
  function renderOnboarding() {
    return `<main class="onboarding"><header class="topbar"><div class="brand"><div class="brand-icon">u.</div>unlock english</div><div class="topbar-actions">${uxButton()}<span class="pill">0.4</span></div></header>
      <div class="onboard-art" aria-hidden="true"><div class="orbit"></div><div class="orbit two"></div><div class="orbit three"></div><div class="big-lock">${icon('unlock')}</div><div class="orbit-dot"></div></div>
      <div class="eyebrow">YOUR DAILY WAY FORWARD</div><h1 class="spaced">Сначала English.<br>Потом — всё остальное.</h1><p class="sub">Короткий квиз. Свои мысли на английском. Один понятный шаг каждый день.</p>
      <div class="onboard-level"><div class="eyebrow">С какого уровня начнём?</div>${levelPicker(state.level, 'onboard-level')}<p class="level-note">${levelDescriptions[state.level]}</p></div>
      ${button(`Начать свой путь ${icon('arrow',18)}`, 'onboard-start')}
      <div class="onboard-points"><span class="point">${icon('shield')}На твоём телефоне</span><span class="point">${icon('leaf')}Без рекламы</span><span class="point">${icon('book')}Без интернета</span></div>
      <p class="privacy-foot">Блокировка включается отдельно и только с твоего согласия.<br>Уровни здесь — ориентир для практики, не официальный тест.</p></main>`;
  }
  function renderHome() {
    const d = day(); const st = C.stats(state, today);
    const steps = Number(d.quizDone) + Number(d.writingDone);
    const date = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    const next = !d.quizDone ? 'start-daily' : !d.writingDone ? 'daily-writing' : 'nav';
    const nextText = !d.quizDone ? (state.activeQuiz && state.activeQuiz.mode === 'daily' && !state.activeQuiz.finished ? 'Продолжить миссию' : 'Начать миссию') : !d.writingDone ? 'Перейти к тексту' : 'Ещё немного практики';
    const due = C.dueMistakes(state, CONTENT.questions, today).length;
    let focusText = 'Выбери отвлекающие приложения и включи фокус.';
    if (nstate.focusEnabled && nstate.accessibilityEnabled && nstate.selectedApps.length) focusText = d.completed ? 'Миссия закрыта. Выбранные приложения доступны до завтра.' : 'Сначала миссия, затем выбранные приложения.';
    else if (nstate.focusEnabled && !nstate.accessibilityEnabled) focusText = 'Для ограничений нужно разрешение в настройках Android.';
    return `<div class="eyebrow">${esc(date)}</div><h1 class="hero-heading">A little practice.<br>Every day.</h1><p class="sub">Твой английский начинается с сегодняшнего дня.</p>
      <section class="hero-card" aria-label="Дневная миссия"><div class="hero-top"><div><div class="eyebrow">${d.completed ? 'MISSION COMPLETE' : 'DAILY MISSION'} · ${d.level}</div><h2>${d.completed ? 'Сегодня ты<br>это сделал.' : 'Разблокируй<br>свой день.'}</h2><p>${d.completed ? 'Квиз пройден, текст сохранён.<br>Завтра — ещё один шаг.' : 'Пять вопросов и небольшой текст.<br>Ошибки разберём по пути.'}</p></div><div class="mission-ring"><svg width="100%" height="100%" viewBox="0 0 70 70"><circle cx="35" cy="35" r="30" fill="none" stroke="#385044" stroke-width="4"/><circle cx="35" cy="35" r="30" fill="none" stroke="#c9f178" stroke-width="4" stroke-linecap="round" stroke-dasharray="${steps / 2 * 188.5} 188.5"/></svg><span>${steps}<small> / 2</small></span></div></div><div class="hero-bottom">${icon('clock',14)}<span>В своём темпе</span><span class="pill">до 100 XP</span></div>${button(`${nextText} ${icon(d.completed ? 'book' : 'arrow',18)}`, next, 'primary', next === 'nav' ? 'data-value="practice"' : '')}</section>
      <div class="stats-strip"><div class="stat"><strong>${st.streak}<small>дн.</small></strong><span>серия занятий</span></div><div class="stat"><strong>${st.xp}<small>XP</small></strong><span>твой опыт</span></div><div class="stat"><strong>${st.essays}</strong><span>своих текстов</span></div></div>
      <button class="task-card bk-spaced" data-action="nav" data-value="books"><span class="task-icon">${icon('book')}</span><span class="task-copy"><strong>Новая библиотека Insight</strong><span>332 страницы · matching · speaking · vocabulary</span></span>${icon('chevron',17)}</button><div class="section-head"><h2>План на сегодня</h2><small>Два небольших шага</small></div>
      <button class="task-card ${d.quizDone ? 'done' : ''}" data-action="${d.quizDone ? 'daily-summary' : 'start-daily'}"><span class="task-icon">${icon(d.quizDone ? 'check' : 'book')}</span><span class="task-copy"><strong>01 · Разогрей английский</strong><span>${d.quizDone ? 'Готово · ошибки разобраны' : `5 вопросов · ${d.level} · до 50 XP`}</span></span>${icon('chevron',17)}</button>
      <button class="task-card ${d.writingDone ? 'done' : ''}" data-action="daily-writing"><span class="task-icon">${icon(d.writingDone ? 'check' : 'pen')}</span><span class="task-copy"><strong>02 · Скажи своими словами</strong><span>${d.writingDone ? 'Текст сохранён · +30 XP' : 'Одна тема · твои мысли · +30 XP'}</span></span>${icon('chevron',17)}</button>
      ${due ? `<button class="task-card" data-action="start-review"><span class="task-icon">${icon('repeat')}</span><span class="task-copy"><strong>Вернуться к ошибкам</strong><span>Повторение по твоим ответам</span></span><span class="badge-count">${due}</span></button>` : ''}
      <div class="note-card">${icon(nstate.focusEnabled ? 'lock' : 'leaf',20)}<div><strong>${nstate.focusEnabled ? 'Фокус на английском' : 'Меньше отвлечений'}</strong><p>${focusText}</p><button class="text-btn" data-action="nav" data-value="focus">Настроить фокус</button></div></div>`;
  }
  function renderPractice() {
    const pool = CONTENT.questions.filter(q => q.level === practiceLevel);
    const due = C.dueMistakes(state, CONTENT.questions, today).length;
    return `<div class="screen-title"><div class="eyebrow">PRACTICE MAKES PROGRESS</div><h1 class="spaced">Разберёмся.<br>И закрепим.</h1><p class="sub">Выбирай сложность. Ошибки подскажут, к чему вернуться.</p></div>${levelPicker(practiceLevel,'practice-level')}<p class="tiny muted">${levelDescriptions[practiceLevel]}</p>
      <section class="feature-card"><div class="feature-title"><span class="task-icon">${icon('book')}</span><h2>Mix & practice</h2></div><p>Восемь вопросов: грамматика, слова и понимание текста. После ответа — объяснение на русском.</p><div class="row"><span class="pill">${pool.length} заданий в базе</span><span class="pill">Выбор + ввод ответа</span></div>${button(`Начать квиз ${icon('arrow',17)}`,'start-practice')}</section>
      <section class="feature-card"><div class="feature-title"><span class="task-icon">${icon('repeat')}</span><h2>Мои ошибки</h2></div><p>${due ? `${due} ${plural(due,'вопрос','вопроса','вопросов')} готовы к повторению. Вернёмся к темам, в которых ты ошибался.` : 'Здесь появятся задания, к которым стоит вернуться. После верного повторения интервал увеличивается.'}</p>${button(due ? 'Повторить трудное' : 'Пока нечего повторять','start-review','secondary',due ? '' : 'disabled')}</section>
      ${renderPersonalPractice()}<p class="privacy-foot">XP за один и тот же вопрос начисляются один раз в день.</p>`;
  }
  function renderWriting() {
    const prompts = CONTENT.prompts.filter(p => p.level === writingLevel);
    return `<div class="screen-title"><div class="eyebrow">FIND YOUR OWN WORDS</div><h1 class="spaced">Есть что сказать.</h1><p class="sub">Выбери тему и сформулируй мысль. Подсказки помогут начать.</p></div>${renderAIIntro()}${levelPicker(writingLevel,'writing-level')}${prompts.map(p => `<button class="prompt-card" data-action="open-prompt" data-value="${p.id}"><span class="pill">${p.level} · ${p.minWords}–${p.maxWords} слов</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><span class="prompt-foot"><span>${state.drafts[p.id] ? 'Продолжить черновик' : 'Открыть тему'}</span>${icon('arrow',18)}</span></button>`).join('')}<div class="note-card">${icon('info',19)}<div><strong>Учись и без подключения</strong><p>Квизы, черновики и локальная самопроверка доступны без ИИ. Подключённая ИИ-проверка отправляет текст только после твоего согласия.</p></div></div>`;
  }
  function renderProgress() {
    const st = C.stats(state, today);
    const days = Array.from({length:7},(_,i) => C.shiftDay(today, i-6));
    const mistakes = Object.values(state.mistakes).sort((a,b) => b.count-a.count).slice(0,5);
    return `<div class="screen-title"><div class="eyebrow">EVERY SMALL STEP COUNTS</div><h1 class="spaced">Твой путь<br>в цифрах.</h1><p class="sub">Сравнивай себя с собой. Здесь остаётся каждая практика.</p></div>
      <div class="metric-grid"><div class="metric"><span class="task-icon">${icon('flame',22)}</span><strong>${st.streak}<span> дней</span></strong><span>текущая серия</span></div><div class="metric"><span class="task-icon">${icon('spark',22)}</span><strong>${st.xp}<span> XP</span></strong><span>накопленный опыт</span></div><div class="metric"><span class="task-icon">${icon('check',22)}</span><strong>${st.accuracy == null ? '—' : st.accuracy+'%'}</strong><span>верно с первой попытки</span></div><div class="metric"><span class="task-icon">${icon('pen',22)}</span><strong>${st.words}</strong><span>слов в сохранённых текстах</span></div></div>
      <section class="feature-card"><h3>Последние семь дней</h3><div class="calendar-week">${days.map(k => { const d=state.days[k]; const date=new Date(k+'T12:00:00'); return `<div class="calendar-day ${d&&d.completed?'complete':''} ${k===today?'today':''}"><div class="calendar-dot">${d&&d.completed?icon('check',16):date.getDate()}</div><small>${new Intl.DateTimeFormat('ru',{weekday:'short'}).format(date)}</small></div>`; }).join('')}</div><p class="tiny spaced">День засчитан после квиза и письменного задания.</p></section>
      <div class="section-head"><h2>Мои тексты</h2><small>${st.essays} сохранено</small></div><section class="feature-card" style="margin-top:0">${state.writingHistory.length ? state.writingHistory.slice(0,5).map(w => `<button class="history-item" data-action="view-writing" data-value="${w.id}"><strong>${esc(w.title)}</strong><span>${esc(w.day)} · ${w.level} · ${w.words} слов</span></button>`).join('') : `<div class="empty"><span class="task-icon">${icon('pen')}</span><h3>Первая мысль — твоя</h3><p>Сохрани текст, и он появится здесь.</p></div>`}</section>
      ${mistakes.length ? `<div class="section-head"><h2>Темы для внимания</h2><button class="text-btn" data-action="start-review">Повторить</button></div><section class="feature-card" style="margin-top:0">${mistakes.map(m=>{const q=CONTENT.questions.find(q=>q.id===m.questionId);return q?`<div class="history-item"><strong>${esc(q.topic)} <span class="pill">${q.level}</span></strong><span>Ошибок: ${m.count} · повторение ${m.nextReview}</span></div>`:'';}).join('')}</section>` : ''}
      ${renderAIHistory()}<div class="bottom-actions">${button(`${icon('download',16)}Экспорт`,'export','secondary')}${button(`${icon('upload',16)}Импорт`,'import','secondary')}</div><p class="privacy-foot">Сохрани резервную копию перед удалением или переустановкой приложения. Тексты и прогресс хранятся локально.</p>`;
  }
  function renderFocus() {
    nstate = nativeState();
    const d=day();
    const active=nstate.focusEnabled&&nstate.accessibilityEnabled&&nstate.selectedApps.length>0;
    const paused=nstate.emergencyUntil>Date.now();
    const title=!active?'Твоё внимание —<br>твой выбор.':d.completed?'На сегодня<br>всё открыто.':paused?'Короткая<br>пауза.':'Сначала<br>дневная миссия.';
    const status=!nstate.native?'Для ограничений установи Android APK.':!nstate.accessibilityEnabled?'Разрешение ещё не выдано.':!nstate.selectedApps.length?'Выбери приложения для ограничений.':!nstate.focusEnabled?'Фокус выключен.':d.completed?'Миссия выполнена. Следующий день — новый старт.':paused?`Доступ открыт ещё примерно на ${Math.ceil((nstate.emergencyUntil-Date.now())/60000)} мин.`:'Выбранные приложения закрыты до выполнения квиза и текста.';
    return `<div class="screen-title"><div class="eyebrow">MAKE ROOM FOR ENGLISH</div><h1 class="spaced">Режим фокуса.</h1><p class="sub">Только выбранные приложения. Только пока не готов дневной минимум.</p></div><section class="status-card"><div><h2>${title}</h2><p>${status}</p></div><span class="status-icon">${icon(active&&!d.completed&&!paused?'lock':'unlock',27)}</span></section>
      ${!nstate.native?'<div class="native-preview">Это просмотр интерфейса в браузере. Блокировка других приложений работает только в установленной Android-версии.</div>':''}
      <section class="feature-card"><div class="settings-row"><div class="copy"><strong>Ежедневный фокус</strong><p>После полуночи по времени телефона нужна новая миссия.</p></div><button class="switch ${nstate.focusEnabled?'on':''}" role="switch" aria-checked="${nstate.focusEnabled}" aria-label="Ежедневный фокус" data-action="toggle-focus" ${!nstate.native?'disabled':''}></button></div>
      <div class="settings-row"><span class="task-icon">${icon('shield',20)}</span><div class="copy"><strong>Разрешение Android</strong><p>${nstate.accessibilityEnabled?'Сервис специальных возможностей включён.':'Разрешение выдаётся вручную в настройках.'}</p></div><button class="text-btn" data-action="accessibility" ${!nstate.native?'disabled':''}>${nstate.accessibilityEnabled?'Открыть':'Настроить'}</button></div>
      <div class="settings-row"><span class="task-icon">${icon('lock',20)}</span><div class="copy"><strong>Выбранные приложения</strong><p>${nstate.selectedApps.length?esc(nstate.selectedApps.map(a=>a.label).join(', ')):'Пока ничего не выбрано'}</p></div><button class="text-btn" data-action="choose-apps" ${!nstate.native?'disabled':''}>Выбрать</button></div></section>
      ${active&&!d.completed?`<div class="spaced">${button(`${icon(paused?'lock':'pause',16)} ${paused?'Закончить паузу':'Экстренная пауза · 10 минут'}`,paused?'end-pause':'pause','secondary')}</div>`:''}
      <div class="note-card">${icon('shield',20)}<div><strong>Ты сохраняешь контроль</strong><p>Телефон, системные настройки и главный экран остаются доступны. Банки и другие необходимые приложения просто не добавляй в список. Фокус можно выключить в любой момент.</p></div></div>
      <section class="feature-card"><h3>Что видит приложение</h3><p class="spaced">При включённом сервисе Android передаёт название открытого приложения. Оно нужно только для выбранных ограничений. Сервис не запрашивает текст экрана, пароли или переписки. Данные о чужих приложениях не отправляются для ИИ-проверки. Письмо отправляется отдельно, только с согласия.</p><button class="text-btn spaced" data-action="about">О приложении</button></section>`;
  }
  function renderQuiz() {
    const s=state.activeQuiz;
    if(!s){screen='practice';return `<main class="page">${topbar()}${renderPractice()}</main>${nav()}`;}
    if(s.finished)return renderResult(s);
    const q=C.sessionQuestion(s,CONTENT);
    if(!q){state.activeQuiz=null;screen='practice';return `<main class="page">${topbar()}${renderPractice()}</main>${nav()}`;}
    const idx=s.repairing?s.repairIndex:s.index;
    const total=s.repairing?s.repairIds.length:s.ids.length;
    const title=s.repairing?'Закрепляем ошибки':s.mode==='daily'?'Дневной квиз':s.mode==='review'?'Мои ошибки':'Свободная практика';
    const options=q.type==='choice'?`<div role="group" aria-label="Варианты ответа">${q.options.map((a,i)=>{let cls='option';if(s.selected===a)cls+=' selected';if(s.checked&&C.isCorrect(q,a))cls+=' correct';else if(s.checked&&s.selected===a&&!s.lastCorrect)cls+=' wrong';return `<button class="${cls}" data-action="select-answer" data-value="${esc(a)}" ${s.checked?'disabled':''} aria-pressed="${s.selected===a}"><span class="option-index">${'ABCD'[i]}</span><span>${esc(a)}</span></button>`;}).join('')}</div>`:`<label class="eyebrow" for="typed-answer">Твой ответ</label><input id="typed-answer" class="answer-input spaced" type="text" value="${esc(s.selected)}" placeholder="Type your answer…" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="none" ${s.checked?'disabled':''} maxlength="150">`;
    return `<main class="page quiz-page"><div class="back-row">${button(icon('back',19),'quit-quiz','back-btn','aria-label="Сохранить и выйти"')}<span class="eyebrow">${title}</span>${uxButton()}</div><div class="progress-bar" aria-label="Вопрос ${idx+1} из ${total}"><span style="width:${idx/total*100}%"></span></div><div class="quiz-label"><span class="pill">${q.level} · ${esc(q.skill)}</span><span class="tiny muted">${idx+1} / ${total}</span></div><p class="quiz-instruction">${esc(q.instruction)}</p><div class="sentence" lang="en">${esc(q.sentence).replace(/_{2,}/g,'<span class="blank">…</span>')}</div>${options}
      ${s.repairing&&!s.checked?`<div class="hint">Подсказка: ${esc(q.tip||q.explanation)}</div>`:''}
      ${s.checked?`<div class="feedback ${s.lastCorrect?'':'wrong'}" aria-live="polite"><div class="feedback-title">${icon(s.lastCorrect?'circleCheck':'info',20)}${s.lastCorrect?'Есть! Ты разобрался.':'Разберём этот момент.'}</div>${!s.lastCorrect?`<div class="answer-key">Верный ответ: <strong lang="en">${esc(q.answer)}</strong></div>`:''}<p>${esc(q.explanation)}</p></div>`:''}
      <div class="quiz-actions">${s.checked?button(`${s.repairing&&!s.lastCorrect?'Попробовать ещё раз':'Дальше'} ${icon('arrow',17)}`,'next-question'):button('Проверить ответ','check-answer','primary',s.selected.trim()?'':'disabled')}</div><p class="privacy-foot">${s.repairing?'Можно опираться на объяснение. Наша цель — разобраться.':'После ошибки будет объяснение и возможность закрепить правило.'}</p></main>`;
  }
  function renderResult(s) {
    return `<main class="page quiz-page"><div class="back-row">${button(icon('back',19),'quiz-done','back-btn','aria-label="Завершить"')}<span class="eyebrow">PRACTICE COMPLETE</span></div><div class="result-visual">${icon('check')}</div><h1 class="result-title">Ещё один шаг.</h1><p class="result-sub">${s.repairIds.length?'Ты вернулся к сложным вопросам и выбрал верные ответы. Именно так появляется уверенность.':'Все ответы верны с первой попытки. Хороший повод двигаться дальше.'}</p><div class="result-stats"><div><strong>${s.correct} / ${s.ids.length}</strong><span>с первой попытки</span></div><div><strong>${s.repairIds.length}</strong><span>ошибок разобрано</span></div></div>${s.mode==='daily'&&!day().writingDone?`${button(`Теперь — твой текст ${icon('pen',18)}`,'quiz-to-writing')}${button('Вернуться на главную','quiz-done','plain')}`:button(`Готово ${icon('check',18)}`,'quiz-done')}<p class="privacy-foot">Ошибки сохранены для следующих повторений.</p></main>`;
  }
  function renderWriter() {
    const p=CONTENT.prompts.find(p=>p.id===activePromptId);
    if(!p){screen='writing';return `<main class="page">${topbar()}${renderWriting()}</main>${nav()}`;}
    const text=state.drafts[p.id]||'';
    const a=C.analyzeWriting(text,p);
    const savedToday=writerDaily&&state.days[writerDay]&&state.days[writerDay].writingDone;
    return `<main class="page"><div class="back-row">${button(icon('back',19),'leave-writer','back-btn','aria-label="Сохранить черновик и выйти"')}<span class="eyebrow">${writerDaily?'DAILY WRITING':'WRITING PRACTICE'}</span>${uxButton()}<button class="exit" data-action="writing-help" aria-label="О проверке текста">${icon('info',20)}</button></div><span class="pill">${p.level} · ${p.minWords}–${p.maxWords} слов</span><h1 class="writer-heading" lang="en">${esc(p.title)}</h1><p class="sub">${esc(p.description)}</p>${p.book?`<p class="bk-source-notice">Адаптация по Insight ${p.book==='pre'?'Pre-Intermediate':'Intermediate'}, Unit ${p.unit}, PDF ${p.sourcePages.join('–')}. Исходное задание и образец находятся в разделе «Книги».</p>`:''}<ul class="writing-question-list">${p.questions.map(x=>`<li lang="en">${esc(x)}</li>`).join('')}</ul><div class="vocab-list">${p.vocabulary.map(v=>`<span class="vocab-chip">${esc(v.word)} — ${esc(v.meaning)}</span>`).join('')}</div>
      <div class="editor-card"><div class="editor-toolbar"><span>YOUR OWN WORDS</span><strong id="draft-state">Черновик сохранён</strong></div><label for="essay-text" class="hide">Твой текст на английском</label><textarea id="essay-text" class="editor" lang="en" placeholder="Start with one simple thought…" spellcheck="true" maxlength="5000">${esc(text)}</textarea></div><div class="writer-help"><span>Черновик сохраняется автоматически</span><span class="word-count" id="word-count">${a.words} / ${p.minWords} слов</span></div>
      <div id="ai-slot">${renderAIPanel(p,text)}</div>
      ${writerReview?renderWritingReview(a):button(`Локальная самопроверка ${icon('arrow',17)}`,'analyze-writing','primary',a.words?'':'disabled')}
      ${savedToday?'<p class="privacy-foot">Дневное задание уже засчитано. Можно сохранить новую версию.</p>':''}
      <div class="bottom-actions">${button(`${icon('book',16)}Пример`,'show-sample','secondary')}${button(`${icon('copy',16)}Для ChatGPT`,'copy-essay','secondary')}</div></main>`;
  }
  function renderWritingReview(a) {
    return `<section id="writing-review" class="feature-card"><div class="feature-title"><span class="task-icon">${icon('pen')}</span><h2>Первый взгляд</h2></div><p>Проверка объёма и структуры без отправки в интернет.</p>${a.checks.map(c=>`<div class="check-row ${c.ok?'good':'bad'}">${icon(c.ok?'circleCheck':'info',18)}<div><strong>${esc(c.label)}</strong><p>${esc(c.detail)}</p></div></div>`).join('')}
      ${a.suggestions.length?`<h3 class="review-title">Проверь эти места</h3>${a.suggestions.map(s=>`<div class="suggestion"><strong>${esc(s.title)}</strong><p>${esc(s.detail)}</p></div>`).join('')}`:'<div class="suggestion"><strong>Встроенные правила не нашли замечаний</strong><p>Это не означает, что текст полностью верный. Прочитай его ещё раз и проверь, понятно ли выражена мысль.</p></div>'}
      <div class="review-limit">Эта проверка не понимает смысл эссе и не заменяет преподавателя или AI-разбор. Для подробной обратной связи используй ИИ-проверку выше или кнопку «Для ChatGPT».</div>${button(`Сохранить текст ${icon('check',17)}`,'save-writing','primary',a.canSave?'':'disabled')}${!a.canSave?'<p class="privacy-foot">Добавь нужный объём и хотя бы три предложения на английском.</p>':''}${button('Вернуться к редактированию','edit-writing','plain')}</section>`;
  }

  function renderAIIntro() {
    return `<section class="ai-intro"><div class="eyebrow">FEEDBACK THAT MOVES YOU FORWARD</div><h2>Пойми ошибку.<br>Напиши увереннее.</h2><p>Исправления, короткие объяснения и практика по твоим трудным темам.</p><div class="bottom-actions">${button('Посмотреть демо','ai-demo','secondary')}${button('Подключение ИИ','ai-settings','secondary')}</div><small>Демо работает без сети. ИИ требует личного сервера.</small></section>`;
  }
  function renderPersonalPractice() {
    const topics=F.restore(state.feedback).priorityTopics;
    if(!topics.length)return '';
    const pool=F.recommendations(state.feedback,CONTENT.questions,practiceLevel);
    return `<section class="feature-card"><div class="eyebrow">FROM YOUR OWN WRITING</div><h2 class="review-title">Из текста — в практику</h2><div class="ai-tags">${topics.slice(0,5).map(t=>`<span class="pill">${esc(F.TOPICS[t])}</span>`).join('')}</div><p>${pool.length?`${pool.length} заданий уровня ${practiceLevel} из нашего банка подходят к темам последних разборов.`:'На этом уровне пока нет совпадающих заданий в банке. Темы сохранены, но новые упражнения не выдумываются.'}</p>${button('Потренировать ошибки','ai-practice','secondary',pool.length?'':'disabled')}<p class="tiny">До двух подходящих вопросов попадут в следующую ещё не созданную дневную миссию.</p></section>`;
  }
  function renderAIHistory() {
    const reviews=state.feedback.reviews;
    if(!reviews.length)return '';
    return `<div class="section-head"><h2>Разборы письма</h2><small>${reviews.length} сохранено</small></div><section class="feature-card">${reviews.slice(0,8).map(r=>`<button class="history-item" data-action="ai-history" data-value="${esc(r.id)}"><strong>${esc(CONTENT.prompts.find(p=>p.id===r.promptId)?.title||'Текст')}</strong><span>${esc(new Intl.DateTimeFormat('ru',{day:'numeric',month:'short'}).format(new Date(r.createdAt)))} · ${esc(r.level)} · ${r.feedback.status==='completed'?r.feedback.errors.length+' замечаний':'Не оценено'}</span></button>`).join('')}</section>`;
  }
  function renderFeedback(f,text,isDemo) {
    const labels={grammar:'Грамматика',vocabulary:'Словарь',coherence:'Связность',task_response:'Ответ на тему'};
    return `<div class="ai-result"><div class="ai-result-head"><span class="pill">${isDemo?'ДЕМО · ГОТОВЫЙ ОБРАЗЕЦ':'ИИ-РАЗБОР'}</span><span class="tiny">${f.status==='completed'?'Обратная связь':'Без оценки'}</span></div><p class="ai-summary">${esc(f.summary_ru)}</p>
      ${f.scores?`<div class="ai-scores">${Object.entries(labels).map(([k,label])=>`<div><strong>${f.scores[k]===null?'—':f.scores[k]}${f.scores[k]===null?'':'<small>/10</small>'}</strong><span>${label}</span></div>`).join('')}</div><p class="tiny muted">Учебная оценка модели, не результат IELTS или CEFR.</p>`:''}
      ${f.errors.length?`<h3 class="review-title">Что исправить</h3>${f.errors.map(e=>`<article class="ai-correction"><div class="eyebrow">${esc(F.TOPICS[e.category])}</div><div class="ai-change" lang="en"><del>${esc(e.original_fragment)}</del><span aria-label="заменить на">→</span><ins>${esc(e.replacement||'[убрать]')}</ins></div><p>${esc(e.explanation_ru)}</p>${e.example_en?`<div class="ai-example" lang="en">${esc(e.example_en)}</div>`:''}</article>`).join('')}`:f.status==='completed'?'<div class="note-card"><div><strong>Ошибки не отмечены</strong><p>Модель не нашла конкретных ошибок. Это не гарантия идеального текста.</p></div></div>':''}
      ${f.suggestions.length?`<h3 class="review-title">Не ошибки, а варианты</h3>${f.suggestions.map(s=>`<div class="suggestion"><strong lang="en">${esc(s.original_fragment)} → ${esc(s.suggestion)}</strong><p>${esc(s.explanation_ru)}</p></div>`).join('')}`:''}
      ${f.corrected_text?`<details class="ai-comparison"><summary>Сравнить исходный и исправленный текст</summary><div class="eyebrow">ТВОЙ ВАРИАНТ</div><div class="review-essay-text" lang="en">${esc(text)}</div><div class="eyebrow spaced">С ИСПРАВЛЕНИЯМИ</div><div class="review-essay-text" lang="en">${esc(f.corrected_text)}</div></details>`:''}
      ${f.priority_topics.length?`<div class="ai-tags">${f.priority_topics.map(t=>`<span class="pill">${esc(F.TOPICS[t])}</span>`).join('')}</div>`:''}
      ${f.warnings_ru.map(w=>`<p class="review-limit">${esc(w)}</p>`).join('')}
      <p class="privacy-foot">${isDemo?'Этот пример не сохраняется в твой прогресс.':'Модель может ошибаться. Исходный текст не заменяется, XP и разблокировка не зависят от оценки.'}</p></div>`;
  }
  function renderAIPanel(p,text) {
    const record=F.findReview(state.feedback,p.id,text);
    const busy=Boolean(aiBusy);
    return `<section class="ai-writing-card" aria-label="ИИ-проверка"><div class="ai-result-head"><div class="feature-title"><span class="task-icon">${icon('spark')}</span><h2>Проверка с ИИ</h2></div><button class="text-btn" data-action="ai-settings">Подключение</button></div>
      ${record?renderFeedback(record.feedback,text,false):'<p>Конкретные исправления и объяснения на русском. Без переписывания твоих мыслей чужими словами.</p>'}
      ${busy?`<div class="ai-loading" role="status"><span class="ai-spinner"></span><div><strong>Разбираем текст…</strong><p>Черновик сохранён. Можно отменить ожидание.</p></div></div>${button('Отменить ожидание','ai-cancel','secondary')}`:record?button('Исправить самостоятельно','ai-edit','secondary'):button(`Проверить текст ${icon('spark',17)}`,'ai-request','primary',C.wordList(text).length>=5?'':'disabled')}
      ${aiError?`<div class="ai-error" role="alert">${esc(aiError)}</div>`:''}
      <div class="ai-foot"><button class="text-btn" data-action="ai-demo">Как выглядит разбор</button><span>Отправка только с согласия</span></div></section>`;
  }
  function refreshAIPanel() {
    const el=document.getElementById('ai-slot');const p=CONTENT.prompts.find(p=>p.id===activePromptId);
    if(screen==='writer'&&el&&p)el.innerHTML=renderAIPanel(p,state.drafts[p.id]||'');
  }
  function cancelAI() {aiGeneration++;aiClient.cancel();aiBusy=null;pendingReview=null;}
  async function openAISettings() {
    if(window.UNLOCK_OFFLINE_PREVIEW){modal('Автономный просмотр',`<p>Это один HTML-файл для знакомства с интерфейсом. Здесь доступны квизы, черновики и готовый пример разбора. Сетевые запросы отключены.</p><div class="disclosure">Для настоящей ИИ-проверки используй полный архив проекта: запусти <code>npm start</code> на компьютере и настрой сервер по README. Этот файл не заменяет Android APK.</div>${button('Понятно','close-modal')}`);return;}
    modal('Подключение ИИ',`<p>Для этой версии запусти <code>npm start</code> в папке проекта на компьютере. Токен появится в его терминале.</p><div class="disclosure"><strong>Это токен твоего локального сервера, не ключ OpenAI.</strong> Ключ вида <code>sk-…</code> хранится только в файле <code>.env</code> на сервере. Не вставляй его сюда и не присылай в чат.<br><br>Токен сохраняется на время текущей сессии браузера и не попадает в экспорт учебного прогресса.</div><p id="ai-server-state" role="status">Проверяем подключение…</p><label class="ai-field-label" for="ai-token">Токен личного сервера</label><input type="password" id="ai-token" class="app-search" value="${esc(aiToken)}" autocomplete="off" spellcheck="false" placeholder="Скопируй Local access token из терминала">${button('Сохранить подключение','ai-save-token')}${button('Забыть токен','ai-forget-token','plain')}`);
    try {const status=await aiClient.status();const el=document.getElementById('ai-server-state');if(el)el.textContent=status.ai_configured?'Сервер доступен. ИИ включён; запросы оплачиваются через API.':'Сервер доступен. ИИ пока выключен: настрой .env. Локальная практика и демо работают.';}
    catch(_){const el=document.getElementById('ai-server-state');if(el)el.textContent='Сервер не найден. Открой приложение через npm start. Старый APK 0.1 не содержит этой интеграции.';}
  }
  function requestAIConsent() {
    if(aiBusy)return;
    if(!aiToken){openAISettings();return;}
    const p=CONTENT.prompts.find(p=>p.id===activePromptId);const text=state.drafts[p.id]||'';
    if(C.wordList(text).length<5){toast('Напиши хотя бы пять английских слов.');return;}
    if(!aiSubmission||aiSubmission.promptId!==p.id||aiSubmission.text!==text)aiSubmission={id:AI.id(),promptId:p.id,text};
    pendingReview={...aiSubmission,level:p.level};
    save();
    modal('Отправить текст на проверку?',`<p>На твой локальный сервер и далее в OpenAI будут переданы:</p><div class="disclosure"><strong>${esc(p.title)}</strong><br>Уровень ${esc(p.level)}, ${C.wordList(text).length} слов, текст и вопросы к теме.<br><br>История обучения, список приложений и другие черновики не отправляются. Не включай пароли и личные данные. Обработка у провайдера подчиняется его правилам хранения данных.</div><p>Запрос использует API и может стоить денег. Даже отмена ожидания не гарантирует отмену уже начавшейся обработки. Миссию можно выполнить без ИИ.</p>${button('Согласен, проверить текст','ai-confirm')}${button('Остаться без отправки','close-modal','secondary')}`);
  }
  async function performAIReview() {
    const request=pendingReview;if(!request||aiBusy)return;
    pendingReview=null;closeModal();aiBusy=request;aiError='';const generation=++aiGeneration;refreshAIPanel();
    try {
      const result=await aiClient.review({text:request.text,promptId:request.promptId,submissionId:request.id,token:aiToken});
      if(generation!==aiGeneration)return;
      F.validateFeedback(result.feedback,request.text);
      state.feedback=F.storeReview(state.feedback,{id:request.id,promptId:request.promptId,level:request.level,text:request.text,createdAt:Date.now(),feedback:result.feedback});
      save();toast((state.drafts[request.promptId]||'')===request.text?'Разбор сохранён. Теперь попробуй исправить текст.':'Разбор предыдущего варианта сохранён в прогрессе. Текущий черновик не изменён.');
    } catch(e) {if(generation===aiGeneration)aiError=e.message||'Не удалось проверить текст. Черновик сохранён.';}
    finally {if(generation===aiGeneration){aiBusy=null;refreshAIPanel();}}
  }
  function startPersonalPractice() {
    const pool=F.recommendations(state.feedback,CONTENT.questions,practiceLevel);
    if(!pool.length){toast('Для этих тем на выбранном уровне пока нет заданий.');return;}
    if(state.activeQuiz&&!state.activeQuiz.finished){toast('Сначала закончи текущий квиз.');go('quiz');return;}
    state.activeQuiz=C.makeSession('practice',practiceLevel,state,CONTENT,today);
    state.activeQuiz.ids=pool.map(q=>q.id);save();go('quiz');
  }
  function startQuiz(mode) {
    if(state.activeQuiz&&!state.activeQuiz.finished){
      if(state.activeQuiz.mode===mode&&state.activeQuiz.day===today){go('quiz');return;}
      modal('Квиз ещё не закончен',`<p>Текущую попытку можно продолжить. Если начать новую, ответы останутся в базе ошибок, но эта попытка не засчитается как законченный квиз.</p>${button('Продолжить квиз','resume-quiz')}${button('Начать новый','replace-quiz','secondary',`data-value="${mode}"`)}`);return;
    }
    launchQuiz(mode);
  }
  function launchQuiz(mode) {
    state.activeQuiz=C.makeSession(mode,practiceLevel,state,CONTENT,today);
    if(!state.activeQuiz.ids.length){state.activeQuiz=null;toast('Все запланированные повторения уже пройдены.');closeModal();return;}
    save();go('quiz');
  }
  function openWriter(id,isDaily) { cancelAI();aiError='';activePromptId=id;writerDaily=isDaily;writerDay=today;writerReview=false;go('writer'); }
  function modal(title,body,kind='default') {
    if (!modalRoot.innerHTML) returnFocus=document.activeElement;
    UX.stopSound();
    ++modalEpoch;modalClosing=false;
    modalRoot.innerHTML=`<div class="modal-backdrop ${kind==='celebration'?'celebration-backdrop':''}" data-backdrop="true"><section class="modal ${kind==='celebration'?'celebration-modal':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-head"><h2>${esc(title)}</h2><button class="close" data-action="close-modal" aria-label="Закрыть">${icon('close',16)}</button></header>${body}</section></div>`;
    document.body.style.overflow='hidden';root.inert=true;
    UX.openModal(modalRoot);
    const first=modalRoot.querySelector('button');if(first)first.focus();
  }
  function closeModal() {
    if(!modalRoot.innerHTML || modalClosing)return;
    const epoch=++modalEpoch;modalClosing=true;UX.stopSound();
    UX.closeModal(modalRoot,()=>{
      if(epoch!==modalEpoch)return;
      modalRoot.innerHTML='';document.body.style.overflow='';root.inert=false;modalClosing=false;
      if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
      else {const heading=root.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
      returnFocus=null;
    });
  }
  function openUXSettings() {
    const p=UX.getSettings();
    modal('Звук и эффекты',`<p>Немного движения. Немного музыки. Настрой ритм под себя.</p>
      <div class="settings-row"><div class="copy"><strong>Звуки ответов и побед</strong><p>Мягкие сигналы без фоновой музыки.</p></div><button class="switch ${p.sound?'on':''}" role="switch" aria-checked="${p.sound}" aria-label="Звуки ответов и побед" data-action="ux-sound"></button></div>
      <div class="ux-volume-row"><label for="ux-volume">Громкость <output id="ux-volume-value">${Math.round(p.volume*100)}%</output></label><input id="ux-volume" type="range" min="0" max="100" step="1" value="${Math.round(p.volume*100)}" ${p.sound?'':'disabled'}></div>
      <div class="settings-row"><div class="copy"><strong>Плавные анимации</strong><p>${UX.systemReduced()?'На устройстве включено уменьшение движения — оно имеет приоритет.':'Переходы, отклик кнопок и конфетти.'}</p></div><button class="switch ${p.motion?'on':''}" role="switch" aria-checked="${p.motion}" aria-label="Плавные анимации" data-action="ux-motion"></button></div>
      <div class="ux-sound-samples" role="group" aria-label="Послушать звуки"><button class="secondary" data-action="ux-sample" data-value="correct" ${p.sound&&p.volume?'':'disabled'}>${icon('check',16)}Верно</button><button class="secondary" data-action="ux-sample" data-value="incorrect" ${p.sound&&p.volume?'':'disabled'}>${icon('repeat',16)}Ошибка</button><button class="secondary" data-action="ux-sample" data-value="complete" ${p.sound&&p.volume?'':'disabled'}>${icon('spark',16)}Победа</button></div>
      <div class="ux-demo-card"><div class="eyebrow">A LITTLE CELEBRATION</div><strong>Как выглядит твоя победа?</strong><p>Предпросмотр праздника. Не завершает миссию и не начисляет XP.</p>${button('Посмотреть анимацию','ux-demo','secondary')}</div>
      ${button('Сохранено · продолжить','close-modal','primary')}<p class="privacy-foot">Настройки сохраняются на этом устройстве. Звуки создаются локально — без интернета.</p>`);
  }
  function syncUXControls() {
    const p=UX.getSettings();
    for(const [action,value] of [['ux-sound',p.sound],['ux-motion',p.motion]]) {
      const b=modalRoot.querySelector(`[data-action="${action}"]`);
      if(b?.classList?.toggle){b.classList.toggle('on',value);b.setAttribute('aria-checked',String(value));}
    }
    const volume=document.getElementById('ux-volume');if(volume)volume.disabled=!p.sound;
    const out=document.getElementById('ux-volume-value');if(out)out.textContent=Math.round(p.volume*100)+'%';
    if(modalRoot.querySelectorAll) for(const b of modalRoot.querySelectorAll('[data-action="ux-sample"]')) b.disabled=!p.sound||!p.volume;
  }
  function celebrateMission(demo=false) {
    const st=C.stats(state,today);
    const phrases=['Ты сдержал слово себе.','Сегодня ты стал чуть увереннее.','Не идеально. Зато сделано.','Ещё один день в пользу себя.'];
    const title=phrases[C.hash(today)%phrases.length];
    const access=nstate.native && nstate.focusEnabled && nstate.accessibilityEnabled && nstate.selectedApps.length
      ? 'Выбранные приложения открыты до завтра.' : 'Дневной план закрыт. Можно выдохнуть.';
    modal(demo?'Предпросмотр победы':'Твой сегодняшний успех',`<div class="celebration ${demo?'is-demo':''}">
      <div class="celebration-stage" aria-hidden="true"><span class="celebration-orbit orbit-a"></span><span class="celebration-orbit orbit-b"></span><div class="celebration-emblem"><svg viewBox="0 0 64 64" fill="none"><path d="m18 33 10 10 20-23" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div><span class="celebration-spark spark-a">${icon('spark',22)}</span><span class="celebration-spark spark-b">${icon('spark',14)}</span></div>
      <div class="celebration-copy"><div class="eyebrow">${demo?'PREVIEW · БЕЗ НАЧИСЛЕНИЙ':'DAILY MISSION COMPLETE'}</div><h2>Ты это сделал.</h2><p class="celebration-praise">${esc(title)}</p><p class="celebration-description">Квиз пройден. Мысли записаны.<br>Твой английский не остался на завтра.</p></div>
      <div class="celebration-stats"><div>${icon('spark',17)}<strong>${demo?'—':'+20'}<small> XP</small></strong><span>бонус за миссию</span></div><div>${icon('flame',17)}<strong>${demo?'—':st.streak}<small> ${plural(st.streak,'день','дня','дней')}</small></strong><span>серия занятий</span></div></div>
      <div class="celebration-actions">${button(demo?'Вернуться к настройкам':'Отлично. Продолжаем.',demo?'ux-settings':'celebration-done')}
      <p class="celebration-foot">${demo?'Это демо: прогресс и награды не изменяются.':esc(access)}</p></div></div>`,'celebration');
    UX.celebrate(modalRoot,'complete');
  }
  function focusDisclosure() {
    modal('Как работает фокус',`<p>Чтобы показывать ограничение поверх выбранных приложений, Unlock English использует <strong>сервис специальных возможностей Android</strong>.</p><div class="disclosure">При включённом сервисе Android сообщает, <strong>какое приложение открыто</strong>. Мы сравниваем его с твоим списком и при необходимости показываем экран дневной миссии.<br><br>Сервис не запрашивает содержимое экрана и не собирает текст переписок. Данные не отправляются в интернет. Разрешение можно отозвать в системных настройках.</div><p>Откроются настройки Android. Найди Unlock English и включи его вручную. Учебная часть работает и без этого разрешения.</p>${button('Понятно, открыть настройки','accept-disclosure')}${button('Пока заниматься без фокуса','close-modal','plain')}`);
  }
  function appChooser() {
    nstate=nativeState();chosenApps=new Set(nstate.selectedApps.map(a=>a.packageName));
    modal('Что может подождать?',`<p>Выбери развлечения, которые откроются после дневной миссии. Не добавляй приложения, нужные для срочных дел.</p><input class="app-search" id="app-search" type="search" placeholder="Найти приложение" aria-label="Найти приложение"><div class="app-list" id="app-list">${appChoices('')}</div>${button('Сохранить выбор','save-apps')}<p class="privacy-foot">Системные приложения и телефон исключены из списка.</p>`);
  }
  function appChoices(query) {
    const items=nstate.availableApps.filter(a=>a.label.toLowerCase().includes(query.toLowerCase()));
    return items.length?items.map(a=>`<label class="app-choice"><span class="app-letter">${esc(a.label.charAt(0).toUpperCase())}</span><span class="app-label">${esc(a.label)}</span><input type="checkbox" data-app-package="${esc(a.packageName)}" ${chosenApps.has(a.packageName)?'checked':''}></label>`).join(''):'<div class="empty">Подходящих приложений не найдено.</div>';
  }
  function plural(n,one,few,many) {return n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;}
  function writingPromptForGPT(p,text) {return `Ты мой преподаватель английского. Я практикую уровень ${p.level}. Тема: ${p.title}\n\nМой текст:\n${text}\n\nПожалуйста: 1) объясни на русском конкретные ошибки с короткими цитатами; 2) отдели грамматику от стилистических рекомендаций; 3) оцени, ответил ли я на тему и насколько логично построил текст; 4) предложи 3 небольших упражнения по моим ошибкам; 5) сначала дай подсказки для самостоятельного исправления. Не выставляй официальный балл IELTS и не переписывай всё эссе вместо меня.`;}
  function copyToClipboard(text) {
    const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:0;top:0;opacity:.01';document.body.appendChild(ta);ta.focus();ta.select();let copied=false;try{copied=document.execCommand('copy');}catch(_){}ta.remove();return copied;
  }
  function exportProgress() {
    const json=JSON.stringify(state,null,2);
    if(window.NativeAndroid&&typeof window.NativeAndroid.exportProgress==='function'){nativeCall('exportProgress',json);return;}
    const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`unlock-english-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function validateImport(raw) {
    const x=JSON.parse(raw);
    if(!x||x.version!==1||!C.LEVELS.includes(x.level)||!x.days||!Array.isArray(x.writingHistory)||!Array.isArray(x.sessions))throw new Error('Wrong format');
    const contentIds=new Set(CONTENT.questions.map(q=>q.id));const promptIds=new Set(CONTENT.prompts.map(p=>p.id));
    for(const[k,d]of Object.entries(x.days)){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!d||!C.LEVELS.includes(d.level)||!Array.isArray(d.questionIds)||!d.questionIds.every(id=>contentIds.has(id))||!promptIds.has(d.promptId))throw new Error('Invalid daily mission');
    }
    for(const w of x.writingHistory)if(!w||typeof w.text!=='string'||w.text.length>5000||!promptIds.has(w.promptId))throw new Error('Invalid writing');
    const parsed=C.restoreState(x);parsed.activeQuiz=null;parsed.focusDisclosureAccepted=false;parsed.feedback=F.restore(x.feedback);
    return parsed;
  }
  window.onNativeImport=function(raw){
    try{if(raw.length>2000000)throw new Error('Too large');pendingImport=validateImport(raw);modal('Восстановить прогресс?',`<p>Файл содержит ${pendingImport.writingHistory.length} текстов и ${pendingImport.xp} XP. Он заменит текущий учебный прогресс на этом телефоне. Настройки блокировки приложений не импортируются.</p>${button('Заменить прогресс','confirm-import')}${button('Отмена','cancel-import','secondary')}`);}catch(_){toast('Этот файл не похож на резервную копию Unlock English.');}
  };
  function importProgress(){if(window.NativeAndroid&&typeof window.NativeAndroid.importProgress==='function'){nativeCall('importProgress');return;}const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{if(i.files[0]){if(i.files[0].size>2000000){toast('Файл должен быть меньше 2 МБ.');return;}window.onNativeImport(await i.files[0].text());}};i.click();}
  function onAction(action,value){
    if(action.startsWith('bk-')&&books){books.handle(action,value);return;}
    switch(action){
      case'ux-settings':openUXSettings();break;
      case'ux-sound':{const on=!UX.getSettings().sound;UX.update({sound:on});syncUXControls();if(on){UX.activate();UX.play('correct');}break;}
      case'ux-motion':UX.update({motion:!UX.getSettings().motion});syncUXControls();break;
      case'ux-sample':UX.play(value);break;
      case'ux-demo':celebrateMission(true);break;
      case'celebration-done':closeModal();if(screen==='quiz'){state.activeQuiz=null;save();go('home');}break;

      case'ai-settings':openAISettings();break;
      case'ai-save-token':{
        const token=document.getElementById('ai-token').value.trim();
        if(token.startsWith('sk-')){toast('API-ключ OpenAI сюда вставлять нельзя. Нужен токен локального сервера.');return;}
        if(token.length<32){toast('Токен сервера должен содержать не меньше 32 символов.');return;}
        aiToken=token;try{sessionStorage.setItem('ue-backend-token',token);}catch(_){}closeModal();toast('Токен сохранён на эту сессию.');refreshAIPanel();break;
      }
      case'ai-forget-token':aiToken='';try{sessionStorage.removeItem('ue-backend-token');}catch(_){}closeModal();toast('Подключение сброшено.');break;
      case'ai-demo':{const d=F.demo();modal('Пример разбора · ДЕМО',`<p>Заранее подготовленный образец. Твой текст не отправляется и не изменяется.</p>${renderFeedback(d.feedback,d.text,true)}${button('Вернуться','close-modal','secondary')}`);break;}
      case'ai-request':requestAIConsent();break;
      case'ai-confirm':performAIReview();break;
      case'ai-cancel':cancelAI();aiError='Ожидание отменено. Запрос, уже принятый сервером, может всё ещё выполняться.';refreshAIPanel();break;
      case'ai-edit':document.getElementById('essay-text')?.focus();document.getElementById('essay-text')?.scrollIntoView({behavior:UX.motion()?'smooth':'auto',block:'center'});break;
      case'ai-history':{
        const r=state.feedback.reviews.find(r=>r.id===value);if(!r)return;
        modal('Сохранённый ИИ-разбор',`<p>${esc(CONTENT.prompts.find(p=>p.id===r.promptId)?.title||'Текст')} · ${esc(r.level)}</p>${renderFeedback(r.feedback,r.text,false)}${button('Закрыть','close-modal','secondary')}`);break;
      }
      case'ai-practice':startPersonalPractice();break;

      case'nav':go(value);break;
      case'onboard-level':state.level=value;render('update');break;
      case'onboard-start':state.onboarded=true;practiceLevel=writingLevel=state.level;day();save();go('home');break;
      case'practice-level':practiceLevel=value;render();break;
      case'writing-level':writingLevel=value;render();break;
      case'level-settings':modal('Твой уровень',`<p>Выбери комфортный старт. Уровни — ориентир для практики, не результат экзамена. Дневная миссия, которую ты уже начал, сохранит прежний уровень.</p>${levelPicker(state.level,'change-level')}<p class="tiny">${levelDescriptions[state.level]}</p>`);break;
      case'change-level':{
        if(!C.LEVELS.includes(value))return;
        const d=day();const inProgress=!!state.activeQuiz||d.quizDone||d.writingDone||d.rewardedQuestions.length||!!state.drafts[d.promptId];
        state.level=value;practiceLevel=writingLevel=value;if(!inProgress)delete state.days[today];save();closeModal();render();toast(inProgress?'Новый уровень применится к завтрашней миссии.':'Уровень обновлён.');break;
      }
      case'start-daily':if(day().quizDone){toast('Дневной квиз уже пройден.');return;}startQuiz('daily');break;
      case'start-practice':startQuiz('practice');break;
      case'start-review':startQuiz('review');break;
      case'resume-quiz':go('quiz');break;
      case'replace-quiz':state.activeQuiz=null;launchQuiz(value);break;
      case'quit-quiz':save();go('home');toast('Попытка сохранена. Можно продолжить.');break;
      case'select-answer':if(state.activeQuiz&&!state.activeQuiz.checked){
        state.activeQuiz.selected=value;save();
        if(root.querySelectorAll){for(const b of root.querySelectorAll('.option')){const selected=b.dataset.value===value;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}const check=root.querySelector('[data-action="check-answer"]');if(check)check.disabled=!value.trim();}
        else render('update');
      }break;
      case'check-answer':{
        const s=state.activeQuiz;if(!s||!s.selected.trim())return;
        const result=C.checkSession(state,CONTENT,s.selected);if(!result)return;
        save();render('feedback');UX.answer(result.correct);
        const next=root.querySelector('[data-action="next-question"]');if(next)next.focus({preventScroll:true});break;
      }
      case'next-question':{
        const status=C.advanceSession(state);if(status==='invalid')return;
        const completed=synchronizeCompletion();save();render('question');window.scrollTo(0,0);
        if(completed)celebrateMission();else if(status==='finished')UX.celebrate(root,'finish');
        const input=document.getElementById('typed-answer');if(input&&!state.activeQuiz?.finished)input.focus({preventScroll:true});break;
      }
      case'quiz-done':state.activeQuiz=null;save();go('home');break;
      case'quiz-to-writing':state.activeQuiz=null;save();openWriter(day().promptId,true);break;
      case'daily-summary':modal('Квиз на сегодня готов',`<p>${day().quizStats?`${day().quizStats.correct} из ${day().quizStats.total} ответов верны с первой попытки. `:''}Все ошибки разобраны. Можно перейти к тексту или выбрать дополнительную практику.</p>${button('Написать текст','daily-writing')}${button('Свободная практика','nav','secondary','data-value="practice"')}`);break;
      case'daily-writing':openWriter(day().promptId,true);break;
      case'open-prompt':openWriter(value,value===day().promptId);break;
      case'leave-writer':save();go(writerDaily?'home':'writing');break;
      case'analyze-writing':writerReview=true;save();render('review');setTimeout(()=>{const review=document.getElementById('writing-review');if(review)review.scrollIntoView({behavior:UX.motion()?'smooth':'auto',block:'start'});},40);break;
      case'edit-writing':writerReview=false;render();document.getElementById('essay-text').focus();break;
      case'save-writing':{
        const p=CONTENT.prompts.find(p=>p.id===activePromptId);const result=C.saveWriting(state,p,state.drafts[p.id]||'',writerDay,writerDaily);
        if(!result.saved){toast('Сначала дополни текст по подсказкам.');return;}
        const completed=synchronizeCompletion();save();writerReview=false;go(writerDaily?'home':'progress');
        if(completed)celebrateMission();else toast('Текст сохранён. Хороший шаг.');break;
      }
      case'show-sample':{
        const p=CONTENT.prompts.find(p=>p.id===activePromptId);if(p.book){modal('Образец и структура в учебнике',`<p>Оригинальный образец и Writing Guide находятся в разделе E. Черновик сохранён; его можно продолжить после просмотра.</p>${button('Открыть исходные страницы','writer-book-source')}${button('Вернуться к тексту','close-modal','secondary')}`);break;}modal('Как можно начать',`<p>Пример помогает увидеть структуру. Для практики напиши свои мысли и детали.</p><div class="divider"></div><p class="review-essay-text" lang="en">${esc(p.sample)}</p>${button('Вернуться к своему тексту','close-modal')}`);break;
      }
      case'writer-book-source':{const p=CONTENT.prompts.find(p=>p.id===activePromptId);if(p?.book&&books){save();closeModal();go('books');books.openPage(p.book,p.unit,p.sourcePages[0]);}break;}
      case'copy-essay':{
        const p=CONTENT.prompts.find(p=>p.id===activePromptId);const text=state.drafts[p.id]||'';const prompt=writingPromptForGPT(p,text);
        if(!text.trim()){toast('Сначала напиши несколько предложений.');return;}
        modal('Подробный разбор в ChatGPT',`<p>Скопируй этот запрос и вставь в свой чат с ChatGPT. Приложение само ничего не отправляет.</p><textarea class="textarea-copy" id="copy-prompt" readonly>${esc(prompt)}</textarea>${button(`${icon('copy',17)}Скопировать запрос`,'copy-prompt')}`);break;
      }
      case'copy-prompt':toast(copyToClipboard(document.getElementById('copy-prompt').value)?'Запрос скопирован. Вставь его в ChatGPT.':'Выдели текст и скопируй его вручную.');break;
      case'view-writing':{
        const w=state.writingHistory.find(w=>w.id===value);if(!w)return;
        modal(w.title,`<p>${esc(w.day)} · ${w.level} · ${w.words} слов</p><div class="divider"></div><div class="review-essay-text" lang="en">${esc(w.text)}</div>${button('Закрыть','close-modal','secondary')}`);break;
      }
      case'writing-help':modal('Два вида проверки',`<p><strong>Локальная самопроверка</strong> проверяет объём, структуру и несколько частых ошибок без сети.</p><div class="disclosure"><strong>ИИ-проверка</strong> работает через личный сервер. После согласия передаёт текст и тему в OpenAI, возвращает исправления и объяснения. Оценка учебная, не IELTS. Модель может ошибаться.<br><br>Без соединения или ключа можно сохранить текст и завершить миссию по локальным правилам. Готовый демо-пример не оценивает твой текст.</div>${button('Понятно','close-modal')}`);break;
      case'toggle-focus':{
        nstate=nativeState();if(!nstate.native)return;
        if(nstate.focusEnabled){nativeCall('setFocusEnabled',false);render();toast('Фокус выключен.');}
        else if(!nstate.accessibilityEnabled){focusDisclosure();}
        else if(!nstate.selectedApps.length){appChooser();toast('Сначала выбери приложения.');}
        else{nativeCall('setFocusEnabled',true);render();toast('Ежедневный фокус включён.');}
        break;
      }
      case'accessibility':focusDisclosure();break;
      case'accept-disclosure':state.focusDisclosureAccepted=true;save();closeModal();nativeCall('openAccessibilitySettings');break;
      case'choose-apps':if(nstate.native)appChooser();break;
      case'save-apps':nativeCall('setSelectedApps',JSON.stringify([...chosenApps]));closeModal();render();toast('Выбор сохранён.');break;
      case'pause':modal('Пауза на 10 минут',`<p>Выбранные приложения временно станут доступны. Дневная миссия останется незавершённой. Через 10 минут фокус возобновится автоматически.</p>${button('Открыть доступ на 10 минут','confirm-pause')}${button('Продолжить обучение','close-modal','secondary')}`);break;
      case'confirm-pause':nativeCall('emergencyPause');closeModal();render();break;
      case'end-pause':nativeCall('clearEmergencyPause');render();break;
      case'about':modal('Unlock English · 0.4',`<p>Продолжение исходного приложения: ${CONTENT.questions.length} вопросов, ${CONTENT.prompts.length} темы письма, ИИ-разбор, практика по ошибкам, плавные переходы и звуковой отклик.</p><div class="disclosure">Черновики и учебный прогресс хранятся локально. При ИИ-проверке выбранный текст и тема уходят на твой сервер и в OpenAI. API-ключ хранится только на сервере. Демо не делает запросов.<br><br>Версия 0.4: библиотека двух загруженных учебников, карточки, matching и speaking. Оригинальные CD / DVD не включены. Автопроверка есть у адаптированных тренировок, не у всех заданий на страницах.</div>${button('Понятно','close-modal')}`);break;
      case'export':exportProgress();break;
      case'import':importProgress();break;
      case'confirm-import':if(pendingImport){state=pendingImport;if(window.BookCore)state.bookStudy=window.BookCore.restore(state.bookStudy);pendingImport=null;practiceLevel=writingLevel=state.level;save();nstate=nativeState();synchronizeCompletion();go('progress');toast('Учебный прогресс восстановлен.');}break;
      case'cancel-import':pendingImport=null;closeModal();break;
      case'close-modal':closeModal();break;
    }
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-action]');
    if(target&&!target.disabled){if(modalClosing&&target.closest?.('.modal'))return;UX.activate();UX.press(target,e);onAction(target.dataset.action,target.dataset.value);return;}
    if(e.target.dataset.backdrop)closeModal();
  });
  document.addEventListener('input',e=>{
    if(books?.input(e.target))return;
    if(e.target.id==='ux-volume'){UX.update({volume:Number(e.target.value)/100});syncUXControls();return;}
    if(e.target.id==='typed-answer'&&state.activeQuiz&&!state.activeQuiz.checked){state.activeQuiz.selected=e.target.value;save();const b=document.querySelector('[data-action="check-answer"]');if(b)b.disabled=!e.target.value.trim();}
    if(e.target.id==='essay-text'){
      const text=e.target.value;state.drafts[activePromptId]=text;clearTimeout(saveTimer);saveTimer=setTimeout(save,200);aiError='';refreshAIPanel();
      const p=CONTENT.prompts.find(p=>p.id===activePromptId);document.getElementById('word-count').textContent=`${C.wordList(text).length} / ${p.minWords} слов`;
      const check=document.querySelector('[data-action="analyze-writing"]');if(check)check.disabled=!text.trim();
      if(writerReview){writerReview=false;const r=document.getElementById('writing-review');if(r){const el=document.createElement('div');el.innerHTML=button(`Посмотреть разбор ${icon('arrow',17)}`,'analyze-writing','primary',text.trim()?'':'disabled');r.replaceWith(el.firstElementChild);}}
    }
    if(e.target.id==='app-search')document.getElementById('app-list').innerHTML=appChoices(e.target.value);
  });
  document.addEventListener('change',e=>{if(books?.input(e.target))return;if(e.target.dataset.appPackage){if(e.target.checked)chosenApps.add(e.target.dataset.appPackage);else chosenApps.delete(e.target.dataset.appPackage);}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(modalRoot.innerHTML)closeModal();else if(screen==='quiz')onAction('quit-quiz');}
    if(e.key==='Enter'&&e.target.id==='bk-recall-answer'){e.preventDefault();UX.activate();books?.handle('bk-check-recall');}
    if(e.key==='Enter'&&e.target.id==='typed-answer'){e.preventDefault();UX.activate();onAction('check-answer');}
    if(e.key==='Tab'&&modalRoot.innerHTML){const focusable=[...modalRoot.querySelectorAll('button:not([disabled]),input,textarea,[tabindex="0"]')];const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  function tick(){
    const key=C.dayKey();
    if(key!==today){save();today=key;state.activeQuiz=null;writerReview=false;if(state.onboarded){day();go('home');toast('Новый день — новая небольшая миссия. Черновики сохранены.');}}
    nstate=nativeState();
    if(state.onboarded)synchronizeCompletion();
  }
  window.addEventListener('native-state-changed',()=>{nstate=nativeState();if(state.onboarded&&(screen==='focus'||screen==='home')&&!modalRoot.innerHTML)render();});
  document.addEventListener('visibilitychange',()=>{save();if(document.hidden)UX.quiet();if(!document.hidden){tick();if(state.onboarded&&(screen==='home'||screen==='focus'))render();}});
  window.addEventListener('pagehide',()=>{save();cancelAI();UX.quiet();books?.leave();});
  window.onNativeBack=function(){if(screen==='books'&&!modalRoot.innerHTML&&books)return books.back();if(modalRoot.innerHTML){closeModal();return true;}if(screen==='quiz'){onAction('quit-quiz');return true;}if(screen==='writer'){onAction('leave-writer');return true;}if(screen!=='home'){go('home');return true;}return false;};
  setInterval(tick,30000);
  if(state.onboarded){day();synchronizeCompletion();}
  render();
})();
