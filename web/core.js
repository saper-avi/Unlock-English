/* Pure local learning logic. No network, AI claims, tracking, or external dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EnglishCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LEVELS = ['A1', 'A2', 'B1', 'B2'];
  const WORDS = /[A-Za-z]+(?:['’\-][A-Za-z]+)*/g;
  function dayKey(date = new Date()) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function shiftDay(day, amount) {
    const parts = day.split('-').map(Number);
    return dayKey(new Date(parts[0], parts[1] - 1, parts[2] + amount, 12));
  }
  function defaultState() {
    return { version: 1, onboarded: false, level: 'A2', xp: 0, days: {}, mistakes: {}, sessions: [], drafts: {}, writingHistory: [], activeQuiz: null, focusDisclosureAccepted: false };
  }
  function restoreState(raw) {
    const base = defaultState();
    try {
      const old = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!old || old.version !== 1 || typeof old !== 'object') return base;
      const result = { ...base, ...old };
      if (!LEVELS.includes(result.level)) result.level = 'A2';
      for (const key of ['days', 'mistakes', 'drafts']) if (!result[key] || typeof result[key] !== 'object' || Array.isArray(result[key])) result[key] = {};
      for (const key of ['sessions', 'writingHistory']) if (!Array.isArray(result[key])) result[key] = [];
      result.xp = Math.max(0, Number(result.xp) || 0);
      return result;
    } catch (_) { return base; }
  }
  function hash(value) {
    let n = 2166136261;
    for (let i = 0; i < value.length; i++) { n ^= value.charCodeAt(i); n = Math.imul(n, 16777619); }
    return n >>> 0;
  }
  function shuffled(list, seed) {
    const out = list.slice();
    let n = hash(String(seed));
    for (let i = out.length - 1; i > 0; i--) {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      const j = n % (i + 1); [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function normalizeAnswer(text) {
    return String(text || '').trim().toLowerCase().replace(/[‘’]/g, "'").replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
  }
  function isCorrect(question, answer) {
    const valid = [question.answer, ...(question.accepted || [])].map(normalizeAnswer);
    return valid.includes(normalizeAnswer(answer));
  }
  function dueMistakes(state, questions, day = dayKey()) {
    const ids = new Set(questions.map(q => q.id));
    return Object.values(state.mistakes).filter(m => ids.has(m.questionId) && (!m.nextReview || m.nextReview <= day)).sort((a, b) => (a.nextReview || '').localeCompare(b.nextReview || '') || b.count - a.count);
  }
  function ensureDay(state, content, day = dayKey(), preferredIds = []) {
    if (!state.days[day]) {
      const level = state.level;
      const pool = content.questions.filter(q => q.level === level);
      const due = dueMistakes(state, pool, day).slice(0, 2).map(m => m.questionId);
      const preferred = [...new Set(preferredIds)].filter(id => !due.includes(id) && pool.some(q => q.id === id)).slice(0, 2);
      const ordered = shuffled(pool.filter(q => !due.includes(q.id) && !preferred.includes(q.id)), day + level);
      const prompts = content.prompts.filter(p => p.level === level);
      const questionIds = [...due, ...preferred, ...ordered.map(q => q.id)].slice(0, 5);
      state.days[day] = { level, questionIds, promptId: prompts[hash(day + level + 'writing') % prompts.length].id, quizDone: false, writingDone: false, completed: false, rewardedQuestions: [], quizStats: null };
    }
    return state.days[day];
  }
  function awardQuestion(state, day, id) {
    const d = state.days[day];
    if (!d.rewardedQuestions) d.rewardedQuestions = [];
    if (!d.rewardedQuestions.includes(id)) { d.rewardedQuestions.push(id); state.xp += 10; }
  }
  function recordAnswer(state, question, answer, day, review = false) {
    const correct = isCorrect(question, answer);
    const m = state.mistakes[question.id];
    if (!correct) {
      state.mistakes[question.id] = { questionId: question.id, count: (m ? m.count : 0) + 1, lastAnswer: String(answer).slice(0, 150), lastSeen: day, nextReview: day, reviewStreak: 0 };
    } else {
      awardQuestion(state, day, question.id);
      if (m) {
        const streak = (m.reviewStreak || 0) + 1;
        state.mistakes[question.id] = { ...m, lastSeen: day, reviewStreak: streak, nextReview: shiftDay(day, [1, 3, 7, 14, 30][Math.min(streak - 1, 4)]) };
      }
    }
    return correct;
  }
  function makeSession(mode, level, state, content, day = dayKey()) {
    const d = ensureDay(state, content, day);
    let ids;
    if (mode === 'daily') ids = d.questionIds.slice();
    else if (mode === 'review') ids = dueMistakes(state, content.questions, day).slice(0, 8).map(m => m.questionId);
    else ids = shuffled(content.questions.filter(q => q.level === level), day + '-' + state.sessions.length + '-' + Date.now()).slice(0, 8).map(q => q.id);
    return { mode, level: mode === 'daily' ? d.level : level, day, ids, index: 0, correct: 0, answers: [], repairIds: [], repairIndex: 0, repairing: false, checked: false, selected: '', finished: false, lastCorrect: null };
  }
  function sessionQuestion(session, content) {
    const id = session.repairing ? session.repairIds[session.repairIndex] : session.ids[session.index];
    return content.questions.find(q => q.id === id);
  }
  function checkSession(state, content, input) {
    const s = state.activeQuiz;
    if (!s || s.checked || s.finished) return null;
    const q = sessionQuestion(s, content);
    if (!q) return null;
    const correct = isCorrect(q, input);
    s.selected = String(input); s.lastCorrect = correct; s.checked = true;
    if (!s.repairing) {
      recordAnswer(state, q, input, s.day, s.mode === 'review');
      s.answers.push({ questionId: q.id, answer: String(input), correct });
      if (correct) s.correct++; else s.repairIds.push(q.id);
    }
    return { correct, question: q };
  }
  function advanceSession(state) {
    const s = state.activeQuiz;
    if (!s || !s.checked || s.finished) return 'invalid';
    if (s.repairing) {
      if (!s.lastCorrect) { s.checked = false; s.selected = ''; return 'retry'; }
      const repairedId = s.repairIds[s.repairIndex];
      awardQuestion(state, s.day, repairedId);
      // A same-session correction earns completion, not a long-term mastery
      // claim. Bring the question back on the following day.
      if (state.mistakes[repairedId]) {
        state.mistakes[repairedId].nextReview = shiftDay(s.day, 1);
        state.mistakes[repairedId].lastSeen = s.day;
      }
      s.repairIndex++;
      if (s.repairIndex >= s.repairIds.length) return finishSession(state);
    } else {
      s.index++;
      if (s.index >= s.ids.length) {
        if (s.repairIds.length) { s.repairing = true; s.repairIndex = 0; }
        else return finishSession(state);
      }
    }
    s.checked = false; s.selected = ''; s.lastCorrect = null;
    return 'next';
  }
  function finishSession(state) {
    const s = state.activeQuiz;
    if (s.finished) return 'finished';
    s.finished = true;
    const result = { day: s.day, level: s.level, mode: s.mode, correct: s.correct, total: s.ids.length, fixed: s.repairIds.length, completedAt: Date.now() };
    state.sessions.push(result);
    state.sessions = state.sessions.slice(-300);
    if (s.mode === 'daily') { state.days[s.day].quizDone = true; state.days[s.day].quizStats = result; }
    return 'finished';
  }
  function wordList(text) { return String(text).match(WORDS) || []; }
  function analyzeWriting(text, prompt) {
    const trimmed = String(text).trim();
    const words = wordList(trimmed);
    const sentences = trimmed.split(/[.!?]+(?:\s+|$)/).filter(x => /[A-Za-z]/.test(x));
    const paragraphs = trimmed.split(/\n\s*\n/).filter(x => x.trim());
    const latin = (trimmed.match(/[A-Za-z]/g) || []).length;
    const cyrillic = (trimmed.match(/[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/g) || []).length;
    const unique = new Set(words.map(x => x.toLowerCase()));
    const enoughEnglish = latin > 0 && latin / Math.max(latin + cyrillic, 1) >= .8;
    const varied = unique.size >= Math.min(12, Math.ceil(prompt.minWords / 3));
    const checks = [
      { label: `Объём: от ${prompt.minWords} слов`, ok: words.length >= prompt.minWords, detail: `${words.length} из ${prompt.minWords} слов` },
      { label: 'Текст на английском', ok: enoughEnglish, detail: enoughEnglish ? 'Основной язык текста — английский.' : 'Напиши основную часть английскими словами.' },
      { label: 'Несколько законченных мыслей', ok: sentences.length >= 3, detail: sentences.length >= 3 ? `${sentences.length} предложений или фрагментов.` : 'Ориентир — хотя бы 3 предложения с точками.' }
    ];
    const suggestions = [];
    const rules = [
      [/\bi am agree\b/i, 'I am agree', 'Обычно говорят «I agree»: agree — глагол, am перед ним не нужен.'],
      [/\bi have \d{1,2} years(?: old)?\b/i, 'Возраст', 'Для возраста используй «I am … years old».'],
      [/\bpeoples\b/i, 'peoples', 'Если речь просто о людях, проверь: обычно нужно people. Peoples уместно, когда речь о народах.'],
      [/\bmore better\b/i, 'more better', 'Better уже сравнительная форма. Обычно достаточно «better».'],
      [/\bdiscuss about\b/i, 'discuss about', 'Обычно discuss употребляется без about: «discuss the problem».'],
      [/\bdepend of\b/i, 'depend of', 'Проверь предлог: стандартное сочетание — «depend on».'],
      [/\bi\b/, 'Местоимение I', 'В английском местоимение I пишется с заглавной буквы.'],
      [/\b(a|an) informations?\b/i, 'information', 'Information обычно неисчисляемое: «some information» или «a piece of information».']
    ];
    for (const [pattern, title, detail] of rules) if (pattern.test(trimmed)) suggestions.push({ title, detail });
    if (words.length > prompt.maxWords) suggestions.push({ title: 'Сократи текст', detail: `Для этой темы ориентир — до ${prompt.maxWords} слов. Попробуй убрать повторения.` });
    if (prompt.minWords >= 90 && paragraphs.length < 2) suggestions.push({ title: 'Раздели мысли', detail: 'Попробуй выделить абзацы: позиция, аргумент с примером, итог.' });
    if (sentences.some(x => wordList(x).length > 35)) suggestions.push({ title: 'Длинное предложение', detail: 'Есть фраза длиннее 35 слов. Проверь, можно ли разделить её на две мысли.' });
    if (!/[.!?]$/.test(trimmed)) suggestions.push({ title: 'Знак в конце', detail: 'Проверь пунктуацию в конце последнего предложения.' });
    if (!varied) suggestions.push({ title: 'Разнообразие текста', detail: 'Слишком мало разных слов. Добавь несколько собственных мыслей и деталей.' });
    return { words: words.length, sentences: sentences.length, paragraphs: paragraphs.length, uniqueWords: unique.size, checks, suggestions, canSave: words.length >= prompt.minWords && enoughEnglish && sentences.length >= 3 && varied };
  }
  function saveWriting(state, prompt, text, day, isDaily) {
    const analysis = analyzeWriting(text, prompt);
    if (!analysis.canSave) return { saved: false, analysis };
    const existing = state.writingHistory.find(w => w.promptId === prompt.id && w.day === day && w.text === String(text));
    const record = existing || { id: 'w-' + Date.now() + '-' + hash(prompt.id + '\0' + text).toString(36), promptId: prompt.id, level: prompt.level, title: prompt.title, text: String(text), day, words: analysis.words, createdAt: Date.now(), localFlags: analysis.suggestions.map(s => s.title) };
    if (!existing) state.writingHistory.unshift(record);
    state.writingHistory = state.writingHistory.slice(0, 150);
    if (isDaily && state.days[day] && state.days[day].promptId === prompt.id && !state.days[day].writingDone) {
      state.days[day].writingDone = true; state.xp += 30;
    }
    return { saved: true, record, analysis };
  }
  function completeDay(state, day = dayKey()) {
    const d = state.days[day];
    if (!d || !d.quizDone || !d.writingDone || d.completed) return false;
    d.completed = true; d.completedAt = Date.now(); state.xp += 20;
    return true;
  }
  function streak(state, today = dayKey()) {
    let day = state.days[today] && state.days[today].completed ? today : shiftDay(today, -1);
    let n = 0;
    while (state.days[day] && state.days[day].completed && n < 36500) { n++; day = shiftDay(day, -1); }
    return n;
  }
  function stats(state, today = dayKey()) {
    const sessions = state.sessions;
    const answered = sessions.reduce((n, x) => n + x.total, 0);
    const correct = sessions.reduce((n, x) => n + x.correct, 0);
    return { xp: state.xp, streak: streak(state, today), completedDays: Object.values(state.days).filter(d => d.completed).length, answered, accuracy: answered ? Math.round(correct / answered * 100) : null, words: state.writingHistory.reduce((n, w) => n + w.words, 0), essays: state.writingHistory.length };
  }
  return { LEVELS, dayKey, shiftDay, defaultState, restoreState, hash, shuffled, normalizeAnswer, isCorrect, dueMistakes, ensureDay, awardQuestion, recordAnswer, makeSession, sessionQuestion, checkSession, advanceSession, wordList, analyzeWriting, saveWriting, completeDay, streak, stats };
});
