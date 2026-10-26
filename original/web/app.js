(function () {
  'use strict';
  const C = window.EnglishCore;
  const CONTENT = window.LESSON_CONTENT;
  const root = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const STORE = 'unlock-english-v1';
  const paths = {
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
  let chosenApps = new Set();
  let pendingImport = null;
  let saveTimer;
  const levelDescriptions = {
    A1: 'Основа: знакомые слова, простые фразы, короткий рассказ о себе.',
    A2: 'Повседневный английский: события, планы, сравнения и причины.',
    B1: 'Связная речь: опыт, работа, мнение и аргументы.',
    B2: 'Больше нюансов: сложная грамматика, общество, аргументация.'
  };
  function save() {
    const json = JSON.stringify(state);
    const nativeAvailable = !!window.NativeAndroid;
    if (nativeAvailable) nativeCall('saveState', json);
    try { localStorage.setItem(STORE, json); }
    catch (_) { if (!nativeAvailable) toast('Не удалось сохранить прогресс в браузере.'); }
  }
  function day() { return C.ensureDay(state, CONTENT, today); }
  function synchronizeCompletion() {
    if (C.completeDay(state, today)) { save(); toast('Дневная миссия выполнена. +20 XP'); }
    const d = day();
    if (d.completed && d.quizDone && d.writingDone && !nstate.missionCompletedToday) {
      nativeCall('completeMission', today); nstate = nativeState();
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    const el = document.getElementById('toast');
    el.textContent = message; el.classList.add('visible');
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3600);
  }
  function go(next) {
    closeModal(); screen = next; render(); window.scrollTo(0, 0);
  }
  function topbar() { return `<header class="topbar"><div class="brand"><div class="brand-icon" aria-hidden="true">u.</div>unlock english</div><button class="level-pill" data-action="level-settings" aria-label="Выбрать уровень: ${state.level}"><i></i>${state.level}${icon('chevron', 12)}</button></header>`; }
  function nav() {
    return `<nav class="bottom-nav" aria-label="Главная навигация">${[['home','home','Сегодня'],['practice','book','Квизы'],['writing','pen','Тексты'],['progress','chart','Прогресс'],['focus','lock','Фокус']].map(([id,ico,label]) => `<button class="nav-btn ${screen === id ? 'active' : ''}" data-action="nav" data-value="${id}" ${screen === id ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(ico)}</span>${label}</button>`).join('')}</nav>`;
  }
  function levelPicker(value, action) { return `<div class="segmented" role="group" aria-label="Уровень сложности">${C.LEVELS.map(l => button(l, action, `segment ${value === l ? 'active' : ''}`, `data-value="${l}" aria-pressed="${value === l}"`)).join('')}</div>`; }
  function render() {
    if (!state.onboarded) { root.innerHTML = renderOnboarding(); return; }
    day(); save();
    let html = '';
    if (screen === 'quiz') html = renderQuiz();
    else if (screen === 'writer') html = renderWriter();
    else {
      const renderers = { home: renderHome, practice: renderPractice, writing: renderWriting, progress: renderProgress, focus: renderFocus };
      html = `<main class="page">${topbar()}${(renderers[screen] || renderHome)()}</main>${nav()}`;
    }
    root.innerHTML = html;
  }
  function renderOnboarding() {
    return `<main class="onboarding"><header class="topbar"><div class="brand"><div class="brand-icon">u.</div>unlock english</div><span class="pill">0.1 · offline</span></header>
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
      <div class="section-head"><h2>План на сегодня</h2><small>Два небольших шага</small></div>
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
      <p class="privacy-foot">XP за один и тот же вопрос начисляются один раз в день.</p>`;
  }
  function renderWriting() {
    const prompts = CONTENT.prompts.filter(p => p.level === writingLevel);
    return `<div class="screen-title"><div class="eyebrow">FIND YOUR OWN WORDS</div><h1 class="spaced">Есть что сказать.</h1><p class="sub">Выбери тему и сформулируй мысль. Подсказки помогут начать.</p></div>${levelPicker(writingLevel,'writing-level')}${prompts.map(p => `<button class="prompt-card" data-action="open-prompt" data-value="${p.id}"><span class="pill">${p.level} · ${p.minWords}–${p.maxWords} слов</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><span class="prompt-foot"><span>${state.drafts[p.id] ? 'Продолжить черновик' : 'Открыть тему'}</span>${icon('arrow',18)}</span></button>`).join('')}<div class="note-card">${icon('info',19)}<div><strong>Локальная проверка</strong><p>Первая версия проверяет объём, базовую структуру и отдельные частые ошибки. Она не оценивает смысл текста и не выставляет балл IELTS.</p></div></div>`;
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
      <div class="bottom-actions">${button(`${icon('download',16)}Экспорт`,'export','secondary')}${button(`${icon('upload',16)}Импорт`,'import','secondary')}</div><p class="privacy-foot">Сохрани резервную копию перед удалением или переустановкой приложения. Тексты и прогресс хранятся локально.</p>`;
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
      <section class="feature-card"><h3>Что видит приложение</h3><p class="spaced">При включённом сервисе Android передаёт название открытого приложения. Оно нужно только для выбранных ограничений. Сервис не запрашивает текст экрана, пароли или переписки. Интернет в этой версии не используется.</p><button class="text-btn spaced" data-action="about">О первой версии</button></section>`;
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
    return `<main class="page quiz-page"><div class="back-row">${button(icon('back',19),'quit-quiz','back-btn','aria-label="Сохранить и выйти"')}<span class="eyebrow">${title}</span></div><div class="progress-bar" aria-label="Вопрос ${idx+1} из ${total}"><span style="width:${idx/total*100}%"></span></div><div class="quiz-label"><span class="pill">${q.level} · ${esc(q.skill)}</span><span class="tiny muted">${idx+1} / ${total}</span></div><p class="quiz-instruction">${esc(q.instruction)}</p><div class="sentence" lang="en">${esc(q.sentence).replace(/_{2,}/g,'<span class="blank">…</span>')}</div>${options}
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
    return `<main class="page"><div class="back-row">${button(icon('back',19),'leave-writer','back-btn','aria-label="Сохранить черновик и выйти"')}<span class="eyebrow">${writerDaily?'DAILY WRITING':'WRITING PRACTICE'}</span><button class="exit" data-action="writing-help" aria-label="О проверке текста">${icon('info',20)}</button></div><span class="pill">${p.level} · ${p.minWords}–${p.maxWords} слов</span><h1 class="writer-heading" lang="en">${esc(p.title)}</h1><p class="sub">${esc(p.description)}</p><ul class="writing-question-list">${p.questions.map(x=>`<li lang="en">${esc(x)}</li>`).join('')}</ul><div class="vocab-list">${p.vocabulary.map(v=>`<span class="vocab-chip">${esc(v.word)} — ${esc(v.meaning)}</span>`).join('')}</div>
      <div class="editor-card"><div class="editor-toolbar"><span>YOUR OWN WORDS</span><strong id="draft-state">Черновик сохранён</strong></div><label for="essay-text" class="hide">Твой текст на английском</label><textarea id="essay-text" class="editor" lang="en" placeholder="Start with one simple thought…" spellcheck="true" maxlength="5000">${esc(text)}</textarea></div><div class="writer-help"><span>Черновик сохраняется автоматически</span><span class="word-count" id="word-count">${a.words} / ${p.minWords} слов</span></div>
      ${writerReview?renderWritingReview(a):button(`Посмотреть разбор ${icon('arrow',17)}`,'analyze-writing','primary',a.words?'':'disabled')}
      ${savedToday?'<p class="privacy-foot">Дневное задание уже засчитано. Можно сохранить новую версию.</p>':''}
      <div class="bottom-actions">${button(`${icon('book',16)}Пример`,'show-sample','secondary')}${button(`${icon('copy',16)}Для ChatGPT`,'copy-essay','secondary')}</div></main>`;
  }
  function renderWritingReview(a) {
    return `<section id="writing-review" class="feature-card"><div class="feature-title"><span class="task-icon">${icon('pen')}</span><h2>Первый взгляд</h2></div><p>Локальный разбор формы текста.</p>${a.checks.map(c=>`<div class="check-row ${c.ok?'good':'bad'}">${icon(c.ok?'circleCheck':'info',18)}<div><strong>${esc(c.label)}</strong><p>${esc(c.detail)}</p></div></div>`).join('')}
      ${a.suggestions.length?`<h3 class="review-title">Проверь эти места</h3>${a.suggestions.map(s=>`<div class="suggestion"><strong>${esc(s.title)}</strong><p>${esc(s.detail)}</p></div>`).join('')}`:'<div class="suggestion"><strong>Встроенные правила не нашли замечаний</strong><p>Это не означает, что текст полностью верный. Прочитай его ещё раз и проверь, понятно ли выражена мысль.</p></div>'}
      <div class="review-limit">Эта проверка не понимает смысл эссе и не заменяет преподавателя или AI-разбор. Для подробной обратной связи можно скопировать текст и запрос для ChatGPT.</div>${button(`Сохранить текст ${icon('check',17)}`,'save-writing','primary',a.canSave?'':'disabled')}${!a.canSave?'<p class="privacy-foot">Добавь нужный объём и хотя бы три предложения на английском.</p>':''}${button('Вернуться к редактированию','edit-writing','plain')}</section>`;
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
  function openWriter(id,isDaily) { activePromptId=id;writerDaily=isDaily;writerDay=today;writerReview=false;go('writer'); }
  function modal(title,body) { modalRoot.innerHTML=`<div class="modal-backdrop" data-backdrop="true"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-head"><h2>${esc(title)}</h2><button class="close" data-action="close-modal" aria-label="Закрыть">${icon('close',16)}</button></header>${body}</section></div>`;document.body.style.overflow='hidden';const first=modalRoot.querySelector('button');if(first)first.focus(); }
  function closeModal() {modalRoot.innerHTML='';document.body.style.overflow='';}
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
    const parsed=C.restoreState(x);parsed.activeQuiz=null;parsed.focusDisclosureAccepted=false;
    return parsed;
  }
  window.onNativeImport=function(raw){
    try{if(raw.length>2000000)throw new Error('Too large');pendingImport=validateImport(raw);modal('Восстановить прогресс?',`<p>Файл содержит ${pendingImport.writingHistory.length} текстов и ${pendingImport.xp} XP. Он заменит текущий учебный прогресс на этом телефоне. Настройки блокировки приложений не импортируются.</p>${button('Заменить прогресс','confirm-import')}${button('Отмена','cancel-import','secondary')}`);}catch(_){toast('Этот файл не похож на резервную копию Unlock English.');}
  };
  function importProgress(){if(window.NativeAndroid&&typeof window.NativeAndroid.importProgress==='function'){nativeCall('importProgress');return;}const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{if(i.files[0]){if(i.files[0].size>2000000){toast('Файл должен быть меньше 2 МБ.');return;}window.onNativeImport(await i.files[0].text());}};i.click();}
  function onAction(action,value){
    switch(action){
      case'nav':go(value);break;
      case'onboard-level':state.level=value;render();break;
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
      case'select-answer':if(state.activeQuiz&&!state.activeQuiz.checked){state.activeQuiz.selected=value;save();render();}break;
      case'check-answer':{
        const s=state.activeQuiz;if(!s||!s.selected.trim())return;
        C.checkSession(state,CONTENT,s.selected);save();render();break;
      }
      case'next-question':C.advanceSession(state);synchronizeCompletion();save();render();window.scrollTo(0,0);break;
      case'quiz-done':state.activeQuiz=null;save();go('home');break;
      case'quiz-to-writing':state.activeQuiz=null;save();openWriter(day().promptId,true);break;
      case'daily-summary':modal('Квиз на сегодня готов',`<p>${day().quizStats?`${day().quizStats.correct} из ${day().quizStats.total} ответов верны с первой попытки. `:''}Все ошибки разобраны. Можно перейти к тексту или выбрать дополнительную практику.</p>${button('Написать текст','daily-writing')}${button('Свободная практика','nav','secondary','data-value="practice"')}`);break;
      case'daily-writing':openWriter(day().promptId,true);break;
      case'open-prompt':openWriter(value,value===day().promptId);break;
      case'leave-writer':save();go(writerDaily?'home':'writing');break;
      case'analyze-writing':writerReview=true;save();render();setTimeout(()=>{const review=document.getElementById('writing-review');if(review)review.scrollIntoView({behavior:'smooth',block:'start'});},40);break;
      case'edit-writing':writerReview=false;render();document.getElementById('essay-text').focus();break;
      case'save-writing':{
        const p=CONTENT.prompts.find(p=>p.id===activePromptId);const result=C.saveWriting(state,p,state.drafts[p.id]||'',writerDay,writerDaily);
        if(!result.saved){toast('Сначала дополни текст по подсказкам.');return;}
        synchronizeCompletion();save();writerReview=false;go(writerDaily?'home':'progress');toast(day().completed?'Миссия выполнена. Доступ открыт до завтра.':'Текст сохранён. Хороший шаг.');break;
      }
      case'show-sample':{
        const p=CONTENT.prompts.find(p=>p.id===activePromptId);modal('Как можно начать',`<p>Пример помогает увидеть структуру. Для практики напиши свои мысли и детали.</p><div class="divider"></div><p class="review-essay-text" lang="en">${esc(p.sample)}</p>${button('Вернуться к своему тексту','close-modal')}`);break;
      }
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
      case'writing-help':modal('Что входит в проверку',`<p>В версии 0.1 разбор выполняется на телефоне: количество английских слов, базовая структура и небольшой набор частых ошибок.</p><div class="disclosure">Приложение не умеет надёжно оценивать смысл, полноту аргументов, весь словарь и всю грамматику. Оно не выставляет CEFR или IELTS-оценку.<br><br>Для подробного разбора используй кнопку «Для ChatGPT»: она подготовит текст и запрос для копирования в твой чат.</div>${button('Понятно','close-modal')}`);break;
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
      case'about':modal('Unlock English · 0.1',`<p>Личная Android-версия: ${CONTENT.questions.length} вопросов, ${CONTENT.prompts.length} письменные темы, повторение ошибок и добровольный режим фокуса.</p><div class="disclosure">Без рекламы, аккаунта и сетевых запросов. Все тексты хранятся на устройстве. Перед удалением приложения сохрани резервную копию во вкладке «Прогресс».<br><br>Ограничение приложений зависит от разрешений и работы специальных возможностей на твоём телефоне. Это инструмент самодисциплины, который владелец может отключить.</div>${button('Понятно','close-modal')}`);break;
      case'export':exportProgress();break;
      case'import':importProgress();break;
      case'confirm-import':if(pendingImport){state=pendingImport;pendingImport=null;practiceLevel=writingLevel=state.level;save();nstate=nativeState();synchronizeCompletion();go('progress');toast('Учебный прогресс восстановлен.');}break;
      case'cancel-import':pendingImport=null;closeModal();break;
      case'close-modal':closeModal();break;
    }
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-action]');
    if(target&&!target.disabled){onAction(target.dataset.action,target.dataset.value);return;}
    if(e.target.dataset.backdrop)closeModal();
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='typed-answer'&&state.activeQuiz&&!state.activeQuiz.checked){state.activeQuiz.selected=e.target.value;save();const b=document.querySelector('[data-action="check-answer"]');if(b)b.disabled=!e.target.value.trim();}
    if(e.target.id==='essay-text'){
      const text=e.target.value;state.drafts[activePromptId]=text;clearTimeout(saveTimer);saveTimer=setTimeout(save,200);
      const p=CONTENT.prompts.find(p=>p.id===activePromptId);document.getElementById('word-count').textContent=`${C.wordList(text).length} / ${p.minWords} слов`;
      const check=document.querySelector('[data-action="analyze-writing"]');if(check)check.disabled=!text.trim();
      if(writerReview){writerReview=false;const r=document.getElementById('writing-review');if(r){const el=document.createElement('div');el.innerHTML=button(`Посмотреть разбор ${icon('arrow',17)}`,'analyze-writing','primary',text.trim()?'':'disabled');r.replaceWith(el.firstElementChild);}}
    }
    if(e.target.id==='app-search')document.getElementById('app-list').innerHTML=appChoices(e.target.value);
  });
  document.addEventListener('change',e=>{if(e.target.dataset.appPackage){if(e.target.checked)chosenApps.add(e.target.dataset.appPackage);else chosenApps.delete(e.target.dataset.appPackage);}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(modalRoot.innerHTML)closeModal();else if(screen==='quiz')onAction('quit-quiz');}
    if(e.key==='Enter'&&e.target.id==='typed-answer'){e.preventDefault();onAction('check-answer');}
    if(e.key==='Tab'&&modalRoot.innerHTML){const focusable=[...modalRoot.querySelectorAll('button:not([disabled]),input,textarea,[tabindex="0"]')];const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  function tick(){
    const key=C.dayKey();
    if(key!==today){save();today=key;state.activeQuiz=null;writerReview=false;if(state.onboarded){day();go('home');toast('Новый день — новая небольшая миссия. Черновики сохранены.');}}
    nstate=nativeState();
    if(state.onboarded)synchronizeCompletion();
  }
  window.addEventListener('native-state-changed',()=>{nstate=nativeState();if(state.onboarded&&(screen==='focus'||screen==='home')&&!modalRoot.innerHTML)render();});
  document.addEventListener('visibilitychange',()=>{save();if(!document.hidden){tick();if(state.onboarded&&(screen==='home'||screen==='focus'))render();}});
  window.addEventListener('pagehide',save);
  window.onNativeBack=function(){if(modalRoot.innerHTML){closeModal();return true;}if(screen==='quiz'){onAction('quit-quiz');return true;}if(screen==='writer'){onAction('leave-writer');return true;}if(screen!=='home'){go('home');return true;}return false;};
  setInterval(tick,30000);
  if(state.onboarded){day();synchronizeCompletion();}
  render();
})();
