import {
  loadData, saveData, seedData, validateData, uid, parseAmount, eur, tankStatus, billStatus,
} from './store.js';
import { homeView, tankView, settingsView } from './views.js';

const VERSION = '6.0.0';
const HINT_KEY = 'budget.welcomeDone';
const TOAST_MS = 5000;
const SWIPE_OPEN_PX = -88;
const SWIPE_DELETE_PX = -180;

const root = document.getElementById('app');
const toastEl = document.getElementById('toast');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const loaded = loadData();
const state = {
  data: loaded.data,
  view: 'home',
  sel: null,
  editor: null,
  confirm: null,
  openTx: null,
  welcomeDone: readFlag(HINT_KEY),
};
// Last values drawn on screen, so gauges/numbers animate from where they were.
const shown = { fill: new Map(), remaining: new Map() };
let toastTimer = null;
let undoSnapshot = null;

if (!loaded.persisted) saveData(state.data);

function readFlag(key) {
  try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(key) {
  try { window.localStorage.setItem(key, '1'); } catch { /* private mode: hint just reappears */ }
}

// ── State changes ──
function commit(mutate, { undoable = false } = {}) {
  const before = state.data;
  const next = structuredClone(before);
  mutate(next);
  state.data = next;
  undoSnapshot = undoable ? before : null;
  if (!saveData(next)) toast('Could not save. Storage is blocked in this browser.', { error: true });
}

function navigate(view, sel = null) {
  const hash = view === 'tank' ? `#/tank/${encodeURIComponent(sel)}` : view === 'settings' ? '#/settings' : '#/';
  if (location.hash !== hash) location.hash = hash;
  else route();
}

function route() {
  const [, view, id] = (location.hash || '#/').split('/');
  const cat = view === 'tank' ? state.data.cats.find((c) => c.id === decodeURIComponent(id || '') && c.type === 'tank') : null;
  state.view = cat ? 'tank' : view === 'settings' ? 'settings' : 'home';
  state.sel = cat ? cat.id : null;
  state.openTx = null;
  state.confirm = null;
  if (state.view !== 'settings') state.editor = null;
  render({ enter: true });
  window.scrollTo(0, 0);
}

// ── Rendering ──
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

function viewContext(now) {
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return {
    version: VERSION,
    weekNo: isoWeek(now),
    showWelcome: !state.welcomeDone,
    showInstall: ios && !standalone,
    editor: state.editor,
    confirm: state.confirm,
    openTx: state.openTx,
  };
}

function render({ enter = false } = {}) {
  const now = new Date();
  const ctx = viewContext(now);
  const cat = state.data.cats.find((c) => c.id === state.sel);
  if (state.view === 'tank' && cat) root.innerHTML = tankView(cat, now, ctx);
  else if (state.view === 'settings') root.innerHTML = settingsView(state.data, ctx);
  else root.innerHTML = homeView(state.data, now, ctx);
  if (enter && !reduceMotion.matches) root.firstElementChild?.classList.add('is-entering');
  settleGauges();
}

// Markup always carries the true level; motion is layered on top, so a paused
// or skipped animation can never leave a stale gauge on screen.
const GAUGE_MS = 750;
const COUNT_MS = 650;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

function settleGauges() {
  root.querySelectorAll('[data-gauge]').forEach((el) => {
    const id = el.dataset.gauge;
    const fill = Number(el.dataset.fill);
    const from = shown.fill.get(id) ?? 1;
    shown.fill.set(id, fill);
    if (from !== fill && !reduceMotion.matches) {
      el.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${fill})` }], { duration: GAUGE_MS, easing: EASE_OUT });
    }
  });
  const counter = root.querySelector('[data-count]');
  if (!counter || !state.sel) return;
  const to = Number(counter.dataset.count);
  const from = shown.remaining.get(state.sel) ?? to;
  shown.remaining.set(state.sel, to);
  countTo(counter, from, to);
}

function countTo(el, from, to) {
  if (from === to || reduceMotion.matches) return;
  const start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / COUNT_MS);
    const eased = 1 - Math.pow(1 - p, 4);
    if (el.isConnected) el.textContent = eur(p < 1 ? from + (to - from) * eased : to);
    if (p < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Toast with undo ──
function toast(message, { undo = false, error = false } = {}) {
  clearTimeout(toastTimer);
  toastEl.className = `toast is-visible${error ? ' is-error' : ''}`;
  toastEl.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = message;
  toastEl.append(text);
  if (undo) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn link';
    btn.dataset.act = 'undo';
    btn.textContent = 'Undo';
    toastEl.append(btn);
  }
  toastTimer = setTimeout(hideToast, TOAST_MS);
}
function hideToast() {
  toastEl.classList.remove('is-visible');
  undoSnapshot = null;
}

// ── Tank actions ──
function logExpense(amount) {
  const form = root.querySelector('[data-form="log"]');
  const cat = state.data.cats.find((c) => c.id === state.sel);
  if (!cat || !(amount > 0)) return showFormError(form, 'Enter an amount above €0.');
  if (amount > 100000) return showFormError(form, 'That amount looks too large.');
  const note = (form?.elements.note.value || '').trim().slice(0, 60);
  commit((d) => {
    d.cats.find((c) => c.id === cat.id).txs.push({ id: uid(), amt: amount, note, ts: Date.now() });
  }, { undoable: true });
  render();
  const left = tankStatus(state.data.cats.find((c) => c.id === cat.id), new Date()).remaining;
  toast(`Logged ${eur(amount)} · ${left < 0 ? `${eur(-left)} over` : `${eur(left)} left`}`, { undo: true });
}

function showFormError(form, message) {
  const err = form?.querySelector('.form-err');
  if (!err) return;
  err.textContent = message;
  err.hidden = false;
}

function deleteTx(id) {
  commit((d) => {
    const c = d.cats.find((x) => x.id === state.sel);
    if (c) c.txs = c.txs.filter((t) => t.id !== id);
  }, { undoable: true });
  state.openTx = null;
  render();
  toast('Expense deleted', { undo: true });
}

function toggleBill(id) {
  const cat = state.data.cats.find((c) => c.id === id);
  if (!cat) return;
  const b = billStatus(cat, new Date());
  commit((d) => { d.cats.find((c) => c.id === id).paidKey = b.paid ? null : b.key; });
  render();
}

// ── Settings: category editor ──
function openEditor(cat) {
  state.confirm = null;
  state.editor = cat
    ? { id: cat.id, name: cat.name, amount: String(cat.amount), type: cat.type, period: cat.period,
        dueDay: String(cat.period === 'month' ? (cat.due || 1) : 1), dueWd: cat.period === 'week' ? (cat.due || 0) : 0, error: '' }
    : { id: null, name: '', amount: '', type: 'tank', period: 'month', dueDay: '1', dueWd: 0, error: '' };
  render();
  root.querySelector('[data-form="editor"] input[name="name"]')?.focus();
}

// Copy typed values into state before a re-render wipes the inputs.
function syncEditorFromForm() {
  const form = root.querySelector('[data-form="editor"]');
  if (!form || !state.editor) return;
  state.editor = {
    ...state.editor,
    name: form.elements.name.value,
    amount: form.elements.amount.value,
    dueDay: form.elements.dueDay ? form.elements.dueDay.value : state.editor.dueDay,
  };
}

function validateEditor(ed) {
  const name = ed.name.trim();
  const amount = parseAmount(ed.amount);
  if (!name) return { error: 'Give it a name.' };
  if (!(amount > 0)) return { error: 'Amount must be more than €0.' };
  const due = ed.period === 'week' ? Number(ed.dueWd) : Math.round(parseAmount(ed.dueDay));
  if (ed.type === 'bill' && ed.period === 'month' && !(due >= 1 && due <= 31)) return { error: 'Due day must be between 1 and 31.' };
  return { fields: { name, amount, type: ed.type, period: ed.period, due: ed.type === 'bill' ? due : null } };
}

function saveEditor() {
  syncEditorFromForm();
  const { error, fields } = validateEditor(state.editor);
  if (error) {
    state.editor = { ...state.editor, error };
    render();
    return;
  }
  const id = state.editor.id;
  commit((d) => {
    const existing = d.cats.find((c) => c.id === id);
    if (existing) Object.assign(existing, fields);
    else d.cats.push({ id: uid(), txs: [], paidKey: null, ...fields });
  });
  state.editor = null;
  render();
  toast(id ? 'Category updated' : 'Category added');
}

function confirmTwice(key, action) {
  if (state.confirm === key) {
    state.confirm = null;
    action();
  } else {
    state.confirm = key;
  }
  render();
}

// ── Backup ──
function exportBackup() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function importBackup(file) {
  if (!file) return;
  try {
    const data = validateData(JSON.parse(await file.text()));
    if (!data) throw new Error('not a budget backup');
    commit((d) => { d.balance = data.balance; d.cats = data.cats; }, { undoable: true });
    shown.fill.clear();
    shown.remaining.clear();
    render();
    toast('Backup restored', { undo: true });
  } catch (err) {
    console.warn('[budget] import failed', err);
    toast('That file is not a Budget backup.', { error: true });
  }
}

// ── Event wiring ──
const actions = {
  'go-home': () => navigate('home'),
  'go-settings': (el) => {
    navigate('settings');
    if (el.dataset.focus) requestAnimationFrame(() => document.getElementById(el.dataset.focus)?.focus());
  },
  'open-tank': (el) => navigate('tank', el.dataset.id),
  'dismiss-welcome': () => { state.welcomeDone = true; writeFlag(HINT_KEY); render(); },
  quick: (el) => logExpense(Number(el.dataset.amt)),
  'toggle-bill': (el) => toggleBill(el.dataset.id),
  'reveal-tx': (el) => { state.openTx = state.openTx === el.dataset.id ? null : el.dataset.id; render(); },
  'del-tx': (el) => deleteTx(el.dataset.id),
  undo: () => {
    if (!undoSnapshot) return;
    state.data = undoSnapshot;
    saveData(state.data);
    hideToast();
    render();
  },
  'edit-cat': (el) => openEditor(state.data.cats.find((c) => c.id === el.dataset.id)),
  'new-cat': () => openEditor(null),
  'cancel-edit': () => { state.editor = null; state.confirm = null; render(); },
  'ed-set': (el) => {
    syncEditorFromForm();
    const value = el.dataset.field === 'dueWd' ? Number(el.dataset.value) : el.dataset.value;
    state.editor = { ...state.editor, [el.dataset.field]: value, error: '' };
    render();
  },
  'del-cat': () => confirmTwice('cat', () => {
    const id = state.editor.id;
    commit((d) => { d.cats = d.cats.filter((c) => c.id !== id); }, { undoable: true });
    state.editor = null;
    toast('Category deleted', { undo: true });
  }),
  export: exportBackup,
  wipe: () => confirmTwice('wipe', () => {
    commit((d) => { d.cats.forEach((c) => { c.txs = []; }); }, { undoable: true });
    toast('All expenses cleared', { undo: true });
  }),
  reset: () => confirmTwice('reset', () => {
    commit((d) => { const fresh = seedData(); d.balance = fresh.balance; d.cats = fresh.cats; }, { undoable: true });
    shown.fill.clear();
    shown.remaining.clear();
    toast('Reset to starting numbers', { undo: true });
  }),
};

let swipe = null;
let suppressClick = false;

document.addEventListener('click', (e) => {
  if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  if (state.confirm && !['del-cat', 'wipe', 'reset'].includes(el.dataset.act)) state.confirm = null;
  actions[el.dataset.act](el);
});

root.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.dataset.form === 'log') logExpense(parseAmount(form.elements.amount.value));
  if (form.dataset.form === 'editor') saveEditor();
});

function saveBalance(value) {
  const raw = value.trim();
  const n = parseAmount(raw);
  if (raw && !Number.isFinite(n)) { toast('Balance must be a number.', { error: true }); return; }
  commit((d) => { d.balance = raw ? n : null; });
  toast(raw ? `Balance set to ${eur(n)}` : 'Balance cleared');
}

root.addEventListener('change', (e) => {
  const input = e.target.dataset.input;
  if (input === 'balance') saveBalance(e.target.value);
  if (input === 'import') importBackup(e.target.files?.[0]);
});

// Swipe-left to reveal delete on expense rows (tap does the same for accessibility).
root.addEventListener('pointerdown', (e) => {
  const front = e.target.closest('.tx-front');
  if (!front || e.button) return;
  const row = front.parentElement;
  swipe = { front, row, id: front.dataset.id, x0: e.clientX, y0: e.clientY, base: row.classList.contains('is-open') ? SWIPE_OPEN_PX : 0, dx: 0, moved: false };
});
root.addEventListener('pointermove', (e) => {
  if (!swipe) return;
  const raw = e.clientX - swipe.x0;
  if (!swipe.moved) {
    if (Math.abs(raw) < 8) return;
    if (Math.abs(e.clientY - swipe.y0) > Math.abs(raw)) { swipe = null; return; }
    swipe.moved = true;
    swipe.front.classList.add('is-dragging');
    try { swipe.front.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
  }
  swipe.dx = Math.max(-260, Math.min(0, swipe.base + raw));
  swipe.front.style.transform = `translateX(${swipe.dx}px)`;
});
function endSwipe() {
  if (!swipe) return;
  const s = swipe;
  swipe = null;
  if (!s.moved) return;
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 350);
  s.front.classList.remove('is-dragging');
  s.front.style.transform = '';
  if (s.dx < SWIPE_DELETE_PX) { deleteTx(s.id); return; }
  state.openTx = s.dx < SWIPE_OPEN_PX / 2 ? s.id : null;
  render();
}
root.addEventListener('pointerup', endSwipe);
root.addEventListener('pointercancel', endSwipe);

window.addEventListener('hashchange', route);
// Periods roll over at midnight and on Mondays/the 1st: refresh when the app comes back
// on a new day (same-day returns keep whatever is half-typed in the forms).
let renderedDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  const today = new Date().toDateString();
  if (document.visibilityState !== 'visible' || today === renderedDay) return;
  renderedDay = today;
  syncEditorFromForm();
  render();
});

if (navigator.storage?.persist) navigator.storage.persist().catch(() => { /* best effort */ });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[budget] offline mode unavailable', err));
  // When a new release takes over, reload once so the page never runs half old, half new.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}

route();
