'use strict';
// New recovery smoke/regression tests. They are NOT recovered original tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const core = require('../web/core.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'web/content.js'), 'utf8'), context);
const content = JSON.parse(JSON.stringify(context.window.LESSON_CONTENT));
const DAY = '2026-10-25';
const nextDay = core.shiftDay(DAY, 1);
function start(level = 'A2') {
  const state = core.defaultState(); state.level = level;
  core.ensureDay(state, content, DAY);
  state.activeQuiz = core.makeSession('daily', level, state, content, DAY);
  return state;
}
function answerCorrectly(state) {
  let count = 0;
  while (!state.activeQuiz.finished) {
    assert.ok(count++ < 30, 'session must terminate');
    const q = core.sessionQuestion(state.activeQuiz, content);
    assert.equal(core.checkSession(state, content, q.answer).correct, true);
    core.advanceSession(state);
  }
}
test('bank: 96 unique questions, 24 topics, balanced A1–B2', () => {
  assert.equal(content.questions.length, 96); assert.equal(content.prompts.length, 24);
  assert.equal(new Set(content.questions.map(q => q.id)).size, 96);
  assert.equal(new Set(content.prompts.map(q => q.id)).size, 24);
  for (const level of core.LEVELS) {
    assert.equal(content.questions.filter(q => q.level === level).length, 24);
    assert.equal(content.prompts.filter(q => q.level === level).length, 6);
  }
});
test('every quiz answer is valid; choices contain the correct answer', () => {
  for (const q of content.questions) {
    assert.ok(q.id && q.sentence && q.answer && q.explanation);
    assert.ok(core.isCorrect(q, q.answer));
    assert.equal(core.isCorrect(q, 'intentionally wrong answer zxq'), false);
    if (q.type === 'choice') assert.ok(q.options.includes(q.answer));
  }
});
test('normalization accepts case/whitespace but not a different tense', () => {
  assert.ok(core.isCorrect({answer:'went'}, '  WENT.  '));
  assert.ok(core.isCorrect({answer:"don't"}, 'don’t'));
  assert.equal(core.isCorrect({answer:'went'}, 'go'), false);
});
test('daily mission is deterministic and uses the selected level', () => {
  for (const level of core.LEVELS) {
    const a = core.defaultState(); a.level = level;
    const b = core.defaultState(); b.level = level;
    const d = core.ensureDay(a, content, DAY);
    assert.deepEqual(d, core.ensureDay(b, content, DAY));
    assert.equal(d.questionIds.length, 5);
    assert.equal(new Set(d.questionIds).size, 5);
    assert.ok(d.questionIds.every(id => content.questions.find(q => q.id === id).level === level));
    assert.equal(content.prompts.find(p => p.id === d.promptId).level, level);
    a.level = 'B2'; assert.equal(core.ensureDay(a, content, DAY).level, level);
  }
});
test('daily quiz awards 50 XP and ignores repeat checks after completion', () => {
  const state = start(); answerCorrectly(state);
  assert.equal(state.xp, 50); assert.equal(state.days[DAY].quizDone, true);
  assert.equal(state.days[DAY].completed, false);
  assert.equal(core.checkSession(state, content, 'extra'), null);
  assert.equal(core.advanceSession(state), 'invalid');
  assert.equal(state.xp, 50); assert.equal(state.sessions.length, 1);
});
test('wrong answers require repair and enter tomorrow’s review', () => {
  const state = start();
  for (let i = 0; i < 5; i++) {
    assert.equal(core.checkSession(state, content, 'wrong').correct, false);
    core.advanceSession(state);
  }
  assert.equal(state.activeQuiz.repairing, true);
  assert.equal(state.days[DAY].quizDone, false);
  assert.equal(core.checkSession(state, content, 'still wrong').correct, false);
  assert.equal(core.advanceSession(state), 'retry');
  answerCorrectly(state);
  assert.equal(state.xp, 50); assert.equal(state.activeQuiz.correct, 0);
  assert.equal(core.dueMistakes(state, content.questions, DAY).length, 0);
  assert.equal(core.dueMistakes(state, content.questions, nextDay).length, 5);
});
test('writing and completion rewards are idempotent: 50 + 30 + 20 XP', () => {
  const state = start(); answerCorrectly(state);
  const prompt = content.prompts.find(p => p.id === state.days[DAY].promptId);
  assert.equal(core.saveWriting(state, prompt, prompt.sample, DAY, true).saved, true);
  assert.equal(state.xp, 80);
  assert.equal(core.saveWriting(state, prompt, prompt.sample, DAY, true).saved, true);
  assert.equal(state.xp, 80);
  assert.equal(core.completeDay(state, DAY), true);
  assert.equal(core.completeDay(state, DAY), false);
  assert.equal(state.xp, 100);
});
test('incomplete mission cannot be completed', () => {
  const state = start(); assert.equal(core.completeDay(state, DAY), false);
  state.days[DAY].quizDone = true;
  assert.equal(core.completeDay(state, DAY), false); assert.equal(state.xp, 0);
});
test('all 24 reference texts satisfy the app’s local writing gate', () => {
  for (const p of content.prompts) assert.equal(core.analyzeWriting(p.sample, p).canSave, true, p.id);
});
test('local writing rejects empty/non-English/repetitive input', () => {
  const prompt = content.prompts[0];
  for (const text of ['', 'Это текст на русском. Второе предложение. Третье предложение.', 'hello '.repeat(100)]) {
    assert.equal(core.analyzeWriting(text, prompt).canSave, false);
  }
});
test('state restoration preserves draft, progress and active quiz', () => {
  const state = start(); state.drafts['test'] = 'My saved draft.';
  assert.deepEqual(core.restoreState(JSON.stringify(state)), state);
  assert.deepEqual(core.restoreState('{invalid'), core.defaultState());
  assert.equal(core.restoreState({version:1,level:'invalid',xp:-20}).level, 'A2');
  assert.equal(core.restoreState({version:1,level:'invalid',xp:-20}).xp, 0);
});
test('calendar shifts and streak behavior across missing days', () => {
  assert.equal(core.shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(core.shiftDay('2024-02-28', 1), '2024-02-29');
  const state = core.defaultState();
  state.days[DAY] = {completed:true};
  state.days[core.shiftDay(DAY,-1)] = {completed:true};
  assert.equal(core.streak(state, DAY), 2);
  assert.equal(core.streak(state, nextDay), 2);
  assert.equal(core.streak(state, core.shiftDay(DAY,2)), 0);
});
test('preserved original APK and assets have their recorded SHA-256 hashes', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'docs/apk-inventory.json'),'utf8'));
  const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(hash(path.join(root,'original/Unlock-English-0.1.0.apk')), manifest.apk_sha256);
  for (const item of manifest.entries.filter(i => i.apk_path.startsWith('assets/'))) {
    assert.equal(hash(path.join(root,'original/web',item.apk_path.slice(7))), item.sha256, item.apk_path);
  }
});
