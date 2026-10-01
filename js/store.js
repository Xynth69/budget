// Data model, persistence and budget maths. No DOM access in this file.

const STORAGE_KEY = 'budget.v1';
const DAY_MS = 86400000;
const WEEKS_PER_MONTH = 52 / 12;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const uid = () => Math.random().toString(36).slice(2, 10);

const DATA_VERSION = 4;

// The plan as of v4: food (Factor, groceries, YFood) and €100 savings are fixed costs;
// personal spending is €23 a week (≈ €100 a month) and resets every Monday.
const PLAN = [
  { id: 'fun', name: 'Personal costs', type: 'tank', amount: 23, period: 'week' },
  { id: 'rent', name: 'Rent', type: 'bill', amount: 800, period: 'month', due: 1 },
  // Weekly bill `due` is a weekday index where 0 = Monday.
  { id: 'factor', name: 'Factor meals', type: 'bill', amount: 60, period: 'week', due: 0 },
  { id: 'subs', name: 'Subscriptions', type: 'bill', amount: 50, period: 'month', due: 15 },
  { id: 'gro', name: 'Groceries', type: 'bill', amount: 46, period: 'month', due: 1 },
  { id: 'drinks', name: 'YFood', type: 'bill', amount: 24, period: 'month', due: 1 },
  { id: 'save', name: 'Savings', type: 'bill', amount: 100, period: 'month', due: 1 },
];

// Shapes earlier versions shipped. A category still in one of these was never edited,
// so it is safe to move it to the current plan; anything the user changed is left alone.
const SHIPPED = {
  gro: [['tank', 'month', 46], ['tank', 'week', 10.5]],
  fun: [['tank', 'month', 100], ['tank', 'week', 23], ['tank', 'week', 18.5]],
  drinks: [['tank', 'month', 24], ['tank', 'week', 5.5]],
};

const isUntouched = (c) => (SHIPPED[c.id] || []).some(([type, period, amount]) =>
  c.type === type && c.period === period && c.amount === amount);

function migrate(data) {
  if (data.v >= DATA_VERSION) return data;
  const cats = data.cats.map((c) => {
    const plan = PLAN.find((p) => p.id === c.id);
    if (plan && isUntouched(c)) return { ...c, ...plan, due: plan.due ?? null };
    // Earlier versions called it 'Entertainment'; rename it but keep any amount the user set.
    if (c.id === 'fun' && c.name === 'Entertainment') return { ...c, name: plan.name };
    return c;
  });
  const missingSavings = !cats.some((c) => c.id === 'save');
  const save = PLAN.find((p) => p.id === 'save');
  return {
    ...data,
    v: DATA_VERSION,
    cats: missingSavings ? [...cats, { txs: [], paidKey: null, ...save }] : cats,
  };
}

export function seedData() {
  return {
    v: DATA_VERSION,
    balance: null,
    cats: PLAN.map((p) => ({ txs: [], paidKey: null, due: null, ...p })),
  };
}

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

// Returns a clean copy of `raw` or null if it isn't a usable budget file.
export function validateData(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.cats)) return null;
  const cats = [];
  for (const c of raw.cats) {
    if (!c || typeof c.name !== 'string' || !isNum(c.amount) || c.amount <= 0) return null;
    if (!['tank', 'bill'].includes(c.type) || !['week', 'month'].includes(c.period)) return null;
    const txs = Array.isArray(c.txs)
      ? c.txs.filter((t) => t && isNum(t.amt) && t.amt > 0 && isNum(t.ts))
          .map((t) => ({ id: String(t.id || uid()), amt: t.amt, note: String(t.note || '').slice(0, 80), ts: t.ts }))
      : [];
    cats.push({
      id: String(c.id || uid()),
      name: c.name.slice(0, 40),
      type: c.type,
      amount: c.amount,
      period: c.period,
      due: isNum(c.due) ? c.due : null,
      paidKey: typeof c.paidKey === 'string' ? c.paidKey : null,
      txs,
    });
  }
  return { v: isNum(raw.v) ? raw.v : 1, balance: isNum(raw.balance) ? raw.balance : null, cats };
}

export function loadData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const valid = validateData(JSON.parse(raw));
      if (valid) {
        const data = migrate(valid);
        return { data, persisted: data === valid };
      }
    }
  } catch (err) {
    console.warn('[budget] could not read saved data', err);
  }
  return { data: seedData(), persisted: false };
}

// Returns true when the write succeeded so the UI can warn if storage is unavailable.
export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('[budget] could not save', err);
    return false;
  }
}

// ── Dates ──
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const shortDate = (d, withWeekday = false) =>
  `${withWeekday ? WEEKDAYS[d.getDay()] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}`;

// Weekly periods run Monday→Monday, monthly periods 1st→1st.
export function periodBounds(period, now) {
  if (period === 'week') {
    const start = startOfDay(now);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

// ── Money ──
export function eur(n, { cents = true } = {}) {
  const abs = Math.abs(n);
  const showCents = cents || Math.abs(abs - Math.round(abs)) > 0.004;
  const [whole, frac] = abs.toFixed(showCents ? 2 : 0).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < -0.004 ? '−' : ''}€${grouped}${frac ? '.' + frac : ''}`;
}

// Accepts "4,50", "4.50", " 12 " — Dutch keyboards type a comma.
export function parseAmount(v) {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const monthlyCost = (c) => (c.period === 'week' ? c.amount * WEEKS_PER_MONTH : c.amount);

// ── Derived state ──
export const TANK_LEVELS = {
  nom: 'On track',
  cau: 'Getting low',
  warn: 'Almost out',
  over: 'Overspent',
};

export function tankStatus(cat, now) {
  const { start, end } = periodBounds(cat.period, now);
  const txs = cat.txs
    .filter((t) => t.ts >= start.getTime() && t.ts < end.getTime())
    .sort((a, b) => b.ts - a.ts);
  const spent = Math.round(txs.reduce((sum, t) => sum + t.amt, 0) * 100) / 100;
  const remaining = Math.round((cat.amount - spent) * 100) / 100;
  const ratio = cat.amount > 0 ? remaining / cat.amount : 0;
  const daysLeft = Math.max(1, dayDiff(end, now));
  const level = remaining <= 0 ? 'over' : ratio < 0.25 ? 'warn' : ratio <= 0.5 ? 'cau' : 'nom';
  return {
    txs, spent, remaining, daysLeft, level, end,
    fill: Math.max(0, Math.min(1, ratio)),
    safeToday: remaining > 0 ? remaining / daysLeft : 0,
  };
}

// Combined view of every weekly budget, so the home screen can show one weekly number.
export function weekSummary(cats, now) {
  const weekly = cats.filter((c) => c.type === 'tank' && c.period === 'week');
  if (!weekly.length) return null;
  const parts = weekly.map((c) => tankStatus(c, now));
  const budget = weekly.reduce((sum, c) => sum + c.amount, 0);
  const remaining = Math.round(parts.reduce((sum, s) => sum + s.remaining, 0) * 100) / 100;
  const ratio = budget > 0 ? remaining / budget : 0;
  const daysLeft = parts[0].daysLeft;
  return {
    budget, remaining, daysLeft, end: parts[0].end,
    fill: Math.max(0, Math.min(1, ratio)),
    level: remaining <= 0 ? 'over' : ratio < 0.25 ? 'warn' : ratio <= 0.5 ? 'cau' : 'nom',
    perDay: remaining > 0 ? remaining / daysLeft : 0,
  };
}

export function billDueDate(cat, ref) {
  if (cat.period === 'week') {
    const d = periodBounds('week', ref).start;
    d.setDate(d.getDate() + (cat.due || 0));
    return d;
  }
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return new Date(ref.getFullYear(), ref.getMonth(), Math.min(Math.max(1, cat.due || 1), daysInMonth));
}

export function billStatus(cat, now) {
  const { start, end } = periodBounds(cat.period, now);
  const key = ymd(start);
  const paid = cat.paidKey === key;
  if (paid) {
    const next = billDueDate(cat, new Date(end.getTime() + 3600000));
    return { key, paid, tone: 'ok', text: `Paid · next ${shortDate(next, cat.period === 'week')}` };
  }
  const due = billDueDate(cat, now);
  const diff = dayDiff(due, now);
  if (diff < 0) return { key, paid, tone: 'late', text: `Overdue since ${shortDate(due)}` };
  if (diff === 0) return { key, paid, tone: 'soon', text: 'Due today' };
  const when = diff === 1 ? 'tomorrow' : `in ${diff} days`;
  return { key, paid, tone: diff <= 3 ? 'soon' : 'idle', text: `Due ${shortDate(due, cat.period === 'week')} · ${when}` };
}

export function overview(data, now) {
  const burn = data.cats.reduce((sum, c) => sum + monthlyCost(c), 0);
  const fixed = data.cats.filter((c) => c.type === 'bill').reduce((sum, c) => sum + monthlyCost(c), 0);
  let runway = null;
  if (isNum(data.balance) && burn > 0) {
    const months = Math.max(0, data.balance / burn);
    const days = Math.floor(months * 365 / 12);
    runway = { months, weeks: Math.floor(days / 7), until: new Date(now.getTime() + days * DAY_MS) };
  }
  return { burn, perWeek: burn / WEEKS_PER_MONTH, fixed, flexible: burn - fixed, runway };
}
