/* ==========================================================
   Riječi – App-Logik
   Spaced Repetition (SM-2-Variante mit Lernschritten),
   Schreibtraining, Satzübungen, Wörterverwaltung.
   Lernstand liegt in localStorage (pro Gerät).
   ========================================================== */
'use strict';

const APP_VERSION = '1.1.0';

/* ---------- Hilfsfunktionen ---------- */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

function todayStr(ts = Date.now()) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function normHr(s) {
  return s.toLowerCase().replace(/[.,!?;:…]/g, '').replace(/\s+/g, ' ').trim();
}
function stripDia(s) {
  return s.replace(/č/g, 'c').replace(/ć/g, 'c').replace(/đ/g, 'd')
          .replace(/š/g, 's').replace(/ž/g, 'z').replace(/dž/g, 'dz');
}

/* Satz: "*Dobar dan*, kako ste?" → { gap: "Dobar dan", parts: [before, after] } */
function parseSentence(hr) {
  const m = hr.match(/\*(.+?)\*/);
  if (!m) return null;
  return { gap: m[1], before: hr.slice(0, m.index), after: hr.slice(m.index + m[0].length) };
}

/* ---------- Speicher ---------- */

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

let SETTINGS = Object.assign(
  { newPerDay: 8, dirHD: true, dirDH: true },
  store.get('rijeci.settings', {}));

let PROGRESS = Object.assign(
  { cards: {}, log: {} },
  store.get('rijeci.progress', {}));

let CUSTOM = store.get('rijeci.custom', []);

function saveSettings() { store.set('rijeci.settings', SETTINGS); }
function saveProgress() { store.set('rijeci.progress', PROGRESS); }
function saveCustom()   { store.set('rijeci.custom', CUSTOM); }

/* ---------- Daten ---------- */

let LESSONS = [];          // [{id, name, words:[…]}]
const WORDS = new Map();   // id → word

function buildData() {
  LESSONS = (window.VOCAB && window.VOCAB.lessons || []).map(l => ({ ...l }));
  if (CUSTOM.length) {
    LESSONS.push({ id: 'custom', name: 'Eigene Wörter', words: CUSTOM });
  }
  WORDS.clear();
  for (const l of LESSONS) for (const w of l.words) WORDS.set(w.id, w);
}

/* ---------- SRS (SM-2-Variante) ---------- */

const LEARN_STEPS = [1 * MIN, 10 * MIN];   // Lernschritte
const GRAD_IVL = 1, EASY_IVL = 4;          // Tage nach dem Graduieren

function cardKey(wordId, dir) { return wordId + '|' + dir; }

function getCard(wordId, dir) {
  const k = cardKey(wordId, dir);
  if (!PROGRESS.cards[k]) {
    PROGRESS.cards[k] = { st: 'new', step: 0, due: 0, ivl: 0, ef: 2.5, reps: 0, lapses: 0 };
  }
  return PROGRESS.cards[k];
}

function fuzz(days) { return days * (0.95 + Math.random() * 0.1); }

/* grade: 0 = Nochmal, 1 = Schwer, 2 = Gut, 3 = Leicht */
function schedule(card, grade, now = Date.now()) {
  card.reps++;
  if (card.st === 'new') { card.st = 'learn'; card.step = 0; }

  if (card.st === 'learn') {
    if (grade === 0) {
      card.step = 0;
      card.due = now + LEARN_STEPS[0];
    } else if (grade === 1) {
      card.due = now + LEARN_STEPS[card.step];
    } else if (grade === 2) {
      card.step++;
      if (card.step >= LEARN_STEPS.length) {
        card.st = 'rev'; card.ivl = GRAD_IVL;
        card.due = now + fuzz(card.ivl) * DAY;
      } else {
        card.due = now + LEARN_STEPS[card.step];
      }
    } else {
      card.st = 'rev'; card.ivl = EASY_IVL;
      card.due = now + fuzz(card.ivl) * DAY;
    }
  } else { // 'rev'
    if (grade === 0) {
      card.lapses++;
      card.ef = Math.max(1.3, card.ef - 0.2);
      card.st = 'learn'; card.step = 0; card.ivl = GRAD_IVL;
      card.due = now + LEARN_STEPS[0];
    } else if (grade === 1) {
      card.ef = Math.max(1.3, card.ef - 0.15);
      card.ivl = Math.max(card.ivl + 1, card.ivl * 1.2);
      card.due = now + fuzz(card.ivl) * DAY;
    } else if (grade === 2) {
      card.ivl = card.ivl * card.ef;
      card.due = now + fuzz(card.ivl) * DAY;
    } else {
      card.ef = Math.min(2.8, card.ef + 0.15);
      card.ivl = card.ivl * card.ef * 1.3;
      card.due = now + fuzz(card.ivl) * DAY;
    }
  }
}

/* Intervall-Vorschau für die Buttons */
function previewIvl(card, grade) {
  const c = JSON.parse(JSON.stringify(card));
  schedule(c, grade, Date.now());
  const ms = c.due - Date.now();
  if (ms < 60 * MIN) return '<' + Math.max(1, Math.round(ms / MIN)) + ' Min.';
  if (ms < DAY * 1.5) return '1 Tag';
  return Math.round(ms / DAY) + ' Tage';
}

function activeDirs() {
  const dirs = [];
  if (SETTINGS.dirHD) dirs.push('hd');
  if (SETTINGS.dirDH) dirs.push('dh');
  return dirs.length ? dirs : ['hd'];
}

function logToday(field, inc = 1) {
  const t = todayStr();
  if (!PROGRESS.log[t]) PROGRESS.log[t] = { rev: 0, nw: 0 };
  PROGRESS.log[t][field] += inc;
}

function newIntroducedToday() {
  const l = PROGRESS.log[todayStr()];
  return l ? l.nw : 0;
}

/* Pro Wort zählt höchstens eine fällige Karte (Geschwisterkarten werden
   in der Sitzung ohnehin zurückgestellt). */
function countDue(now = Date.now()) {
  let due = 0;
  for (const id of WORDS.keys()) {
    for (const dir of activeDirs()) {
      const c = PROGRESS.cards[cardKey(id, dir)];
      if (c && c.st !== 'new' && c.due <= now) { due++; break; }
    }
  }
  return due;
}

function streak() {
  let n = 0;
  const d = new Date();
  if (!PROGRESS.log[todayStr(d.getTime())]) d.setDate(d.getDate() - 1);
  while (PROGRESS.log[todayStr(d.getTime())]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* Wörter, mit denen schon gelernt wurde (für Übungsmodi) */
function startedWordIds() {
  const ids = new Set();
  for (const k in PROGRESS.cards) {
    if (PROGRESS.cards[k].st !== 'new') ids.add(k.split('|')[0]);
  }
  return ids;
}

/* ---------- Navigation ---------- */

const VIEWS = ['home', 'learn', 'write', 'sentences', 'words', 'settings'];

function showView(name) {
  for (const v of VIEWS) $('#view-' + v).hidden = (v !== name);
  $$('.bottomnav button').forEach(b =>
    b.classList.toggle('active', b.dataset.goto === name));
  if (name === 'home') renderHome();
  if (name === 'learn') startLearnSession();
  if (name === 'write') resetWrite();
  if (name === 'sentences') resetSentences();
  if (name === 'words') renderWords();
  if (name === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

/* ---------- Kockice (Fortschritt) ---------- */

function renderKockice(el, done, total) {
  el.innerHTML = '';
  if (total <= 0) return;
  if (total <= 30) {
    for (let i = 0; i < total; i++) {
      const k = document.createElement('span');
      k.className = 'k' + (i < done ? (i % 2 === 0 ? ' f-r' : ' f-w') : '');
      el.appendChild(k);
    }
  } else {
    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('i');
    fill.style.setProperty('--p', Math.round(done / total * 100) + '%');
    bar.appendChild(fill);
    el.appendChild(bar);
  }
}

/* ---------- Startseite ---------- */

function renderHome() {
  const h = new Date().getHours();
  let hr = 'Dobar dan!', de = 'Guten Tag!';
  if (h < 10) { hr = 'Dobro jutro!'; de = 'Guten Morgen!'; }
  else if (h >= 18) { hr = 'Dobra večer!'; de = 'Guten Abend!'; }
  $('#home-greeting').textContent = hr;
  $('#home-greeting-sub').textContent = de;

  $('#stat-due').textContent = countDue();
  const newLeft = Math.max(0, SETTINGS.newPerDay - newIntroducedToday());
  $('#stat-new').textContent = newLeft;
  const s = streak();
  $('#stat-streak').textContent = s;
  $('#stat-streak-label').textContent = s === 1 ? 'Tag in Folge' : 'Tage in Folge';

  const list = $('#home-lesson-list');
  list.innerHTML = '';
  const started = startedWordIds();
  for (const l of LESSONS) {
    const known = l.words.filter(w => started.has(w.id)).length;
    const row = document.createElement('div');
    row.className = 'lesson-row';
    row.innerHTML = '<span class="lesson-name">' + esc(l.name) + '</span>' +
      '<span class="lesson-meta">' + known + ' / ' + l.words.length + ' begonnen</span>';
    list.appendChild(row);
  }
}

/* ---------- Lernen (SRS-Session) ---------- */

const learn = { queue: [], total: 0, done: 0, current: null, revealed: false, active: false };

/* Sitzungsaufbau mit zwei Regeln gegen „Geschwisterkarten“:
   1. Pro Wort höchstens eine Richtung pro Sitzung (die fälligere gewinnt,
      die andere bleibt fällig und kommt in der nächsten Sitzung dran).
   2. Neue Wörter starten nur Kroatisch→Deutsch (Erkennen); die Richtung
      Deutsch→Kroatisch (Produzieren) wird erst eingeführt, wenn die erste
      Karte graduiert ist – also nach einigen Tagen erfolgreicher Wiederholung. */
function collectSession() {
  const now = Date.now();
  const dirs = activeDirs();
  const dueByWord = new Map();
  const newCands = [];

  for (const l of LESSONS) {
    for (const w of l.words) {
      for (const dir of dirs) {
        const c = getCard(w.id, dir);
        if (c.st !== 'new' && c.due <= now) {
          const prev = dueByWord.get(w.id);
          if (!prev || getCard(w.id, prev).due > c.due) dueByWord.set(w.id, dir);
        }
      }
      if (!dueByWord.has(w.id)) {
        const hd = dirs.includes('hd') ? getCard(w.id, 'hd') : null;
        const dh = dirs.includes('dh') ? getCard(w.id, 'dh') : null;
        if (hd && hd.st === 'new') newCands.push({ id: w.id, dir: 'hd' });
        else if (dh && dh.st === 'new' && (!hd || hd.st === 'rev')) {
          newCands.push({ id: w.id, dir: 'dh' });
        }
      }
    }
  }
  const dueCards = Array.from(dueByWord, ([id, dir]) => ({ id, dir }));
  shuffle(dueCards);
  const newLimit = Math.max(0, SETTINGS.newPerDay - newIntroducedToday());
  return dueCards.concat(newCands.slice(0, newLimit));
}

function startLearnSession() {
  learn.queue = collectSession();
  learn.total = learn.queue.length;
  learn.done = 0;
  learn.active = learn.total > 0;
  $('#learn-done').hidden = true;
  if (!learn.active) {
    $('#learn-card').hidden = true;
    $('#learn-empty').hidden = false;
    renderKockice($('#learn-progress'), 0, 0);
    return;
  }
  $('#learn-empty').hidden = true;
  nextLearnCard();
}

function nextLearnCard() {
  renderKockice($('#learn-progress'), learn.done, learn.total);
  if (!learn.queue.length) return finishLearnSession();

  learn.current = learn.queue.shift();
  learn.revealed = false;
  const w = WORDS.get(learn.current.id);
  const dir = learn.current.dir;

  $('#learn-card').hidden = false;
  $('#card-dir').textContent = dir === 'hd' ? 'Kroatisch → Deutsch' : 'Deutsch → Kroatisch';
  const front = $('#card-front-word');
  front.textContent = dir === 'hd' ? w.hr : w.de;
  front.className = 'headword' + (dir === 'dh' ? ' de' : '');
  $('#card-front-pos').textContent = w.pos || '';
  $('#card-back').hidden = true;
  $('#grade-row').hidden = true;
  $('#btn-reveal').hidden = false;
}

function revealCard() {
  if (!learn.current || learn.revealed) return;
  learn.revealed = true;
  const w = WORDS.get(learn.current.id);
  const dir = learn.current.dir;

  const back = $('#card-back-word');
  back.textContent = dir === 'hd' ? w.de : w.hr;
  back.className = 'headword answer' + (dir === 'hd' ? ' de' : '');
  $('#card-note').textContent = w.note || '';

  const exEl = $('#card-example');
  if (w.sentences && w.sentences.length) {
    const s = w.sentences[0];
    exEl.innerHTML = esc(s.hr).replace(/\*(.+?)\*/, '<em>$1</em>') +
      '<span class="ex-de">' + esc(s.de) + '</span>';
  } else exEl.innerHTML = '';

  const card = getCard(learn.current.id, dir);
  for (let g = 0; g < 4; g++) $('#ivl-' + g).textContent = previewIvl(card, g);

  $('#card-back').hidden = false;
  $('#btn-reveal').hidden = true;
  $('#grade-row').hidden = false;
}

function gradeCard(grade) {
  if (!learn.current || !learn.revealed) return;
  const card = getCard(learn.current.id, learn.current.dir);
  const wasNew = card.st === 'new';
  schedule(card, grade);
  logToday('rev');
  if (wasNew) logToday('nw');
  saveProgress();

  if (card.st === 'learn') {
    // Karte kommt in dieser Session nochmal dran
    const pos = Math.min(learn.queue.length, grade === 0 ? 3 : 6);
    learn.queue.splice(pos, 0, learn.current);
    if (grade >= 2) { /* Zwischenschritt zählt nicht als erledigt */ }
  } else {
    learn.done++;
  }
  // "Nochmal"/Zwischenschritte verlängern die Session nicht in der Anzeige:
  // total wächst nur, wenn die Warteschlange größer als geplant wird.
  learn.total = Math.max(learn.total, learn.done + learn.queue.length);
  nextLearnCard();
}

function finishLearnSession() {
  learn.active = false;
  $('#learn-card').hidden = true;
  renderKockice($('#done-kockice'), learn.total, learn.total);
  const t = PROGRESS.log[todayStr()] || { rev: 0, nw: 0 };
  $('#done-summary').textContent =
    'Heute: ' + t.rev + ' Wiederholungen, ' + t.nw + ' neue Wörter.';
  $('#learn-done').hidden = false;
}

/* ---------- Schreiben ---------- */

const write = { queue: [], total: 0, done: 0, ok: 0, current: null, answered: false };

function fillLessonSelect(sel) {
  sel.innerHTML = '';
  const started = startedWordIds();
  if (started.size >= 4) {
    const o = document.createElement('option');
    o.value = '__started';
    o.textContent = 'Bereits gelernte Wörter';
    sel.appendChild(o);
  }
  for (const l of LESSONS) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.name;
    sel.appendChild(o);
  }
}

function resetWrite() {
  $('#write-setup').hidden = false;
  $('#write-card').hidden = true;
  $('#write-done').hidden = true;
  renderKockice($('#write-progress'), 0, 0);
  fillLessonSelect($('#write-lesson'));
}

function wordsForPool(sel) {
  if (sel === '__started') {
    const s = startedWordIds();
    return Array.from(s).map(id => WORDS.get(id)).filter(Boolean);
  }
  const l = LESSONS.find(x => x.id === sel);
  return l ? l.words.slice() : [];
}

function startWrite() {
  const pool = wordsForPool($('#write-lesson').value);
  write.queue = shuffle(pool.slice()).slice(0, 10);
  write.total = write.queue.length;
  write.done = 0; write.ok = 0;
  if (!write.total) return;
  $('#write-setup').hidden = true;
  $('#write-done').hidden = true;
  nextWrite();
}

function nextWrite() {
  renderKockice($('#write-progress'), write.done, write.total);
  if (!write.queue.length) return finishWrite();
  write.current = write.queue.shift();
  write.answered = false;
  $('#write-card').hidden = false;
  $('#write-prompt').textContent = write.current.de;
  $('#write-pos').textContent = write.current.pos || '';
  const inp = $('#write-input');
  inp.value = '';
  inp.disabled = false;
  $('#write-feedback').hidden = true;
  $('#btn-write-check').hidden = false;
  $('#btn-write-next').hidden = true;
  inp.focus();
}

function checkWrite() {
  if (write.answered || !write.current) return;
  write.answered = true;
  const given = normHr($('#write-input').value);
  const target = normHr(write.current.hr);
  const fb = $('#write-feedback');
  let cls, html;
  if (given === target) {
    cls = 'ok'; write.ok++;
    html = 'Točno! <b>' + esc(write.current.hr) + '</b>';
  } else if (given && stripDia(given) === stripDia(target)) {
    cls = 'near'; write.ok++;
    html = 'Fast – achte auf die Sonderzeichen: <b>' + esc(write.current.hr) + '</b>';
  } else {
    cls = 'bad';
    html = 'Richtig wäre: <b>' + esc(write.current.hr) + '</b>';
  }
  fb.className = 'write-feedback ' + cls;
  fb.innerHTML = html;
  fb.hidden = false;
  $('#write-input').disabled = true;
  $('#btn-write-check').hidden = true;
  $('#btn-write-next').hidden = false;
  $('#btn-write-next').focus();
  write.done++;
}

function finishWrite() {
  $('#write-card').hidden = true;
  $('#write-summary').textContent =
    write.ok + ' von ' + write.total + ' richtig geschrieben.';
  $('#write-done').hidden = false;
}

/* ---------- Satzübungen ---------- */

const sent = { queue: [], total: 0, done: 0, ok: 0, current: null, answered: false };

function resetSentences() {
  $('#sent-setup').hidden = false;
  $('#sent-card').hidden = true;
  $('#sent-done').hidden = true;
  renderKockice($('#sent-progress'), 0, 0);
  fillLessonSelect($('#sent-lesson'));
}

function collectSentences(pool) {
  const items = [];
  for (const w of pool) {
    for (const s of (w.sentences || [])) {
      const p = parseSentence(s.hr);
      if (p) items.push({ word: w, de: s.de, ...p });
    }
  }
  return items;
}

function startSentences() {
  const pool = wordsForPool($('#sent-lesson').value);
  const all = collectSentences(pool);
  sent.queue = shuffle(all).slice(0, 10);
  sent.total = sent.queue.length;
  sent.done = 0; sent.ok = 0;
  if (!sent.total) return;
  // Ablenkungs-Antworten aus dem gesamten Wortschatz
  sent.distractors = collectSentences(Array.from(WORDS.values())).map(i => i.gap);
  $('#sent-setup').hidden = true;
  $('#sent-done').hidden = true;
  nextSentence();
}

function nextSentence() {
  renderKockice($('#sent-progress'), sent.done, sent.total);
  if (!sent.queue.length) return finishSentences();
  sent.current = sent.queue.shift();
  sent.answered = false;

  $('#sent-card').hidden = false;
  $('#sent-text').innerHTML =
    esc(sent.current.before) + '<span class="gap" id="gap">&nbsp;</span>' + esc(sent.current.after);
  $('#sent-de').textContent = sent.current.de;
  $('#btn-sent-next').hidden = true;

  const correct = sent.current.gap;
  const opts = new Set([correct]);
  const cands = shuffle(sent.distractors.slice());
  for (const c of cands) {
    if (opts.size >= 4) break;
    if (normHr(c) !== normHr(correct)) opts.add(c);
  }
  const chips = $('#sent-chips');
  chips.innerHTML = '';
  for (const o of shuffle(Array.from(opts))) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = o.toLowerCase();
    b.addEventListener('click', () => answerSentence(b, o, correct));
    chips.appendChild(b);
  }
}

function answerSentence(btn, chosen, correct) {
  if (sent.answered) return;
  sent.answered = true;
  const right = normHr(chosen) === normHr(correct);
  if (right) { btn.classList.add('right'); sent.ok++; }
  else {
    btn.classList.add('wrong');
    for (const b of $$('#sent-chips .chip')) {
      if (normHr(b.textContent) === normHr(correct)) b.classList.add('right');
    }
  }
  for (const b of $$('#sent-chips .chip')) b.disabled = true;
  $('#gap').textContent = correct;
  sent.done++;
  $('#btn-sent-next').hidden = false;
  $('#btn-sent-next').focus();
}

function finishSentences() {
  $('#sent-card').hidden = true;
  $('#sent-summary').textContent = sent.ok + ' von ' + sent.total + ' Sätzen richtig.';
  $('#sent-done').hidden = false;
}

/* ---------- Wörter ---------- */

function renderWords() {
  const q = normHr($('#word-search').value || '');
  const box = $('#word-lists');
  box.innerHTML = '';
  const started = startedWordIds();

  for (const l of LESSONS) {
    const words = q
      ? l.words.filter(w => normHr(w.hr).includes(q) || normHr(w.de).includes(q))
      : l.words;
    if (!words.length) continue;

    const det = document.createElement('details');
    det.className = 'word-lesson';
    det.open = Boolean(q) || LESSONS.length === 1;
    const known = l.words.filter(w => started.has(w.id)).length;
    det.innerHTML = '<summary>' + esc(l.name) +
      '<span class="lesson-meta">' + known + ' / ' + l.words.length + '</span></summary>';

    for (const w of words) {
      let cls = '';
      for (const dir of activeDirs()) {
        const c = PROGRESS.cards[cardKey(w.id, dir)];
        if (c && c.st === 'rev') cls = 'known';
        else if (c && c.st === 'learn' && cls !== 'known') cls = 'learn';
      }
      const row = document.createElement('div');
      row.className = 'wordrow';
      row.innerHTML = '<span class="dot ' + cls + '"></span>' +
        '<span class="hr">' + esc(w.hr) + '</span>' +
        (w.extra ? '<span class="tag" title="Passend ergänzte Vokabel">plus</span>' : '') +
        '<span class="de">' + esc(w.de) + '</span>';
      det.appendChild(row);
    }
    box.appendChild(det);
  }
}

function addCustomWord() {
  const hr = $('#add-hr').value.trim();
  const de = $('#add-de').value.trim();
  const note = $('#add-note').value.trim();
  const fb = $('#add-feedback');
  if (!hr || !de) {
    fb.textContent = 'Kroatisch und Deutsch ausfüllen, dann speichern.';
    return;
  }
  CUSTOM.push({
    id: 'c' + Date.now(),
    hr, de, note, pos: '', extra: false, sentences: []
  });
  saveCustom();
  buildData();
  $('#add-hr').value = ''; $('#add-de').value = ''; $('#add-note').value = '';
  fb.textContent = '„' + hr + '“ gespeichert.';
  renderWords();
}

/* ---------- Einstellungen ---------- */

function renderSettings() {
  $('#set-newperday').value = SETTINGS.newPerDay;
  $('#set-dir-hd').checked = SETTINGS.dirHD;
  $('#set-dir-dh').checked = SETTINGS.dirDH;
  $('#app-version').textContent =
    'Riječi ' + APP_VERSION + ' · Vokabelstand: ' +
    ((window.VOCAB && window.VOCAB.updated) || '–');
}

function exportProgress() {
  const data = {
    app: 'rijeci', version: APP_VERSION, exported: new Date().toISOString(),
    progress: PROGRESS, settings: SETTINGS, custom: CUSTOM
  };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rijeci-lernstand-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.app !== 'rijeci') throw new Error('kein Riječi-Lernstand');
      PROGRESS = data.progress || PROGRESS;
      SETTINGS = Object.assign(SETTINGS, data.settings || {});
      CUSTOM = data.custom || CUSTOM;
      saveProgress(); saveSettings(); saveCustom();
      buildData();
      renderSettings();
      alert('Lernstand geladen.');
      showView('home');
    } catch (e) {
      alert('Diese Datei konnte nicht gelesen werden: ' + e.message);
    }
  };
  reader.readAsText(file);
}

function resetProgress() {
  if (!confirm('Wirklich den gesamten Lernstand dieses Geräts löschen? Eigene Wörter bleiben erhalten.')) return;
  PROGRESS = { cards: {}, log: {} };
  saveProgress();
  showView('home');
}

/* ---------- Sonderzeichen-Leiste ---------- */

function wireCharbar(barSel, inputSel) {
  $(barSel).addEventListener('click', e => {
    const btn = e.target.closest('button[data-ch]');
    if (!btn) return;
    const inp = $(inputSel);
    const start = inp.selectionStart ?? inp.value.length;
    inp.value = inp.value.slice(0, start) + btn.dataset.ch + inp.value.slice(inp.selectionEnd ?? start);
    inp.focus();
    inp.setSelectionRange(start + 1, start + 1);
  });
}

/* ---------- Start ---------- */

function wireEvents() {
  document.body.addEventListener('click', e => {
    const nav = e.target.closest('[data-goto]');
    if (nav) showView(nav.dataset.goto);
  });
  $('#btn-settings').addEventListener('click', () => showView('settings'));
  $('#btn-start-learn').addEventListener('click', () => showView('learn'));

  $('#btn-reveal').addEventListener('click', revealCard);
  $('#grade-row').addEventListener('click', e => {
    const b = e.target.closest('[data-grade]');
    if (b) gradeCard(Number(b.dataset.grade));
  });

  document.addEventListener('keydown', e => {
    if (!learn.active || $('#view-learn').hidden) return;
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); learn.revealed ? gradeCard(2) : revealCard(); }
    if (learn.revealed && ['1', '2', '3', '4'].includes(e.key)) gradeCard(Number(e.key) - 1);
  });

  $('#btn-start-write').addEventListener('click', startWrite);
  $('#btn-write-check').addEventListener('click', checkWrite);
  $('#btn-write-next').addEventListener('click', nextWrite);
  $('#btn-write-again').addEventListener('click', () => { resetWrite(); });
  $('#write-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); write.answered ? nextWrite() : checkWrite(); }
  });
  wireCharbar('#charbar', '#write-input');
  wireCharbar('#charbar-add', '#add-hr');

  $('#btn-start-sent').addEventListener('click', startSentences);
  $('#btn-sent-next').addEventListener('click', nextSentence);
  $('#btn-sent-again').addEventListener('click', () => { resetSentences(); });

  $('#word-search').addEventListener('input', renderWords);
  $('#btn-add-word').addEventListener('click', addCustomWord);

  $('#set-newperday').addEventListener('change', e => {
    SETTINGS.newPerDay = Math.max(0, Math.min(50, Number(e.target.value) || 0));
    saveSettings();
  });
  $('#set-dir-hd').addEventListener('change', e => {
    if (!e.target.checked && !$('#set-dir-dh').checked) { e.target.checked = true; return; }
    SETTINGS.dirHD = e.target.checked; saveSettings();
  });
  $('#set-dir-dh').addEventListener('change', e => {
    if (!e.target.checked && !$('#set-dir-hd').checked) { e.target.checked = true; return; }
    SETTINGS.dirDH = e.target.checked; saveSettings();
  });
  $('#btn-export').addEventListener('click', exportProgress);
  $('#import-file').addEventListener('change', e => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
    e.target.value = '';
  });
  $('#btn-reset').addEventListener('click', resetProgress);
}

function init() {
  buildData();
  wireEvents();
  showView('home');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
