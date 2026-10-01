// Pure HTML templates. Every user-entered string goes through esc().
import {
  TANK_LEVELS, tankStatus, weekSummary, billStatus, overview, eur, shortDate, monthlyCost,
} from './store.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

const icon = {
  gear: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  back: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  lock: '<svg class="ico sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  check: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  trash: '<svg class="ico sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  plus: '<svg class="ico sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  share: '<svg class="ico sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
};

const perWord = (c) => (c.period === 'week' ? 'week' : 'month');
const refillText = (s) => (s.daysLeft === 1 ? 'Resets tomorrow' : `Resets ${shortDate(s.end, true)}`);

function chip(level) {
  return `<span class="chip lv-${level}"><span class="chip-dot" aria-hidden="true"></span>${TANK_LEVELS[level]}</span>`;
}

// The bar is drawn at its true level; app.js animates from the previous level.
function meter(cat, s, size) {
  return `
    <span class="meter meter-${size}" aria-hidden="true">
      <span class="meter-fill" data-gauge="${esc(cat.id)}" data-fill="${s.fill}" style="transform: scaleX(${s.fill})"></span>
    </span>`;
}

function tankCard(cat, now) {
  const s = tankStatus(cat, now);
  const label = `${cat.name}: ${eur(s.remaining)} left of ${eur(cat.amount, { cents: false })} this ${perWord(cat)}. ${TANK_LEVELS[s.level]}. Safe to spend today ${eur(s.safeToday)}. Open to log an expense.`;
  return `
    <button class="tank lv-${s.level}" type="button" data-act="open-tank" data-id="${esc(cat.id)}" aria-label="${esc(label)}">
      <span class="tank-top"><span class="tank-name">${esc(cat.name)}</span>${chip(s.level)}</span>
      <span class="tank-amt">
        <span class="tank-rem num">${eur(s.remaining)}</span>
        <span class="tank-of">${s.remaining < 0 ? 'over' : 'left'} of ${eur(cat.amount, { cents: false })}</span>
      </span>
      ${meter(cat, s, 'sm')}
      <span class="tank-foot">
        <span><b class="num">${eur(s.safeToday)}</b> safe today</span>
        <span>${refillText(s)}</span>
      </span>
    </button>`;
}

function weekCard(data, now) {
  const w = weekSummary(data.cats, now);
  if (!w) return '';
  const resets = w.daysLeft === 1 ? 'Resets tomorrow' : `Resets ${shortDate(w.end, true)}`;
  return `
    <section class="panel week lv-${w.level}" aria-label="This week: ${eur(w.remaining)} left of ${eur(w.budget)}. ${eur(w.perDay)} a day. ${resets}.">
      <span class="week-k">Left to spend this week</span>
      <span class="week-amt"><span class="week-rem num">${eur(w.remaining)}</span><span class="tank-of">of ${eur(w.budget, { cents: false })}</span></span>
      <span class="meter meter-lg" aria-hidden="true"><span class="meter-fill" data-gauge="__week" data-fill="${w.fill}" style="transform: scaleX(${w.fill})"></span></span>
      <span class="week-foot"><span><b class="num">${eur(w.perDay)}</b> a day</span><span>${resets}</span></span>
    </section>`;
}

function welcome(ctx) {
  if (!ctx.showWelcome) return '';
  return `
    <section class="notice" aria-label="Getting started">
      <p><b>Your plan:</b> €18.50 a week for entertainment, resetting every Monday. Rent, Factor, subscriptions, groceries, YFood and €100 savings are fixed costs. Change anything in settings.</p>
      ${ctx.showInstall ? `<p class="notice-install">${icon.share}<span>Install it: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</span></p>` : ''}
      <button class="btn ghost sm" type="button" data-act="dismiss-welcome">Got it</button>
    </section>`;
}

function leftoverRow(leftover) {
  if (leftover === null) {
    return `<div class="tele-row">
      <span class="tele-k">Left over each month</span>
      <button class="btn link" type="button" data-act="go-settings" data-focus="income">Add income</button>
    </div>`;
  }
  const tone = leftover < 0 ? 'neg' : leftover < 50 ? 'thin' : 'pos';
  return `<div class="tele-row leftover lo-${tone}">
    <span class="tele-k">${leftover < 0 ? 'Short each month' : 'Left over each month'}</span>
    <span class="tele-v num">${eur(Math.abs(leftover))}</span>
  </div>`;
}

function burnPanel(data, now) {
  const o = overview(data, now);
  const fixedPct = o.burn > 0 ? (o.fixed / o.burn) * 100 : 0;
  const runway = o.runway
    ? `<div class="tele-row">
         <span class="tele-k">Balance lasts</span>
         <span class="tele-v num">${o.runway.months.toFixed(1)} mo <small>· ${o.runway.weeks} wk</small></span>
       </div>
       <div class="tele-row sub">
         <span class="tele-k">${eur(data.balance)} runs out</span>
         <span class="tele-v num">~${shortDate(o.runway.until)} ${o.runway.until.getFullYear()}</span>
       </div>`
    : `<div class="tele-row">
         <span class="tele-k">Balance lasts</span>
         <button class="btn link" type="button" data-act="go-settings" data-focus="balance">Add balance</button>
       </div>`;
  return `
    <section class="panel tele" aria-labelledby="burn-h">
      <div class="tele-head">
        <h2 id="burn-h">This month</h2>
        <span class="tele-total num">${eur(o.burn)}</span>
      </div>
      <div class="split" role="img" aria-label="${Math.round(fixedPct)}% of monthly money out is fixed costs">
        <i class="split-bills" style="width:${fixedPct.toFixed(1)}%"></i><i class="split-flex"></i>
      </div>
      <div class="tele-row">
        <span class="tele-k"><span class="key key-bills"></span>Fixed costs</span>
        <span class="tele-v num">${eur(o.fixed)}</span>
      </div>
      <div class="tele-row">
        <span class="tele-k"><span class="key key-flex"></span>Spending money</span>
        <span class="tele-v num">${eur(o.flexible)}</span>
      </div>
      ${leftoverRow(o.leftover)}
      ${runway}
    </section>`;
}

function billRow(cat, now) {
  const b = billStatus(cat, now);
  return `
    <li class="bill ${b.paid ? 'is-paid' : ''}">
      <span class="bill-main">
        <span class="bill-name">${icon.lock}<span>${esc(cat.name)}</span></span>
        <span class="bill-due due-${b.tone}">${esc(b.text)}</span>
      </span>
      <span class="bill-amt num">${eur(cat.amount, { cents: false })}<small>/${cat.period === 'week' ? 'wk' : 'mo'}</small></span>
      <button class="switch" type="button" role="switch" aria-checked="${b.paid}" data-act="toggle-bill" data-id="${esc(cat.id)}" aria-label="${esc(cat.name)} paid this ${perWord(cat)}">
        <span class="switch-knob">${icon.check}</span>
      </button>
    </li>`;
}

export function homeView(data, now, ctx) {
  const tanks = data.cats.filter((c) => c.type === 'tank');
  const bills = data.cats.filter((c) => c.type === 'bill');
  const billTotal = bills.reduce((sum, c) => sum + monthlyCost(c), 0);
  return `
    <div class="screen" data-screen="home">
      <header class="top">
        <div>
          <h1 class="title">Budget</h1>
          <p class="today num">${shortDate(now, true)} · wk ${ctx.weekNo}</p>
        </div>
        <button class="btn icon" type="button" data-act="go-settings" aria-label="Settings">${icon.gear}</button>
      </header>
      ${welcome(ctx)}
      ${weekCard(data, now)}
      <section class="group" aria-labelledby="fuel-h">
        <div class="sec-head"><h2 id="fuel-h">Spending money</h2><span>Tap to log spending</span></div>
        ${tanks.length
          ? `<div class="tank-grid">${tanks.map((c) => tankCard(c, now)).join('')}</div>`
          : `<p class="empty">No budgets yet. Add a weekly or monthly budget in settings.</p>`}
      </section>
      ${burnPanel(data, now)}
      <section class="bills" aria-labelledby="bills-h">
        <div class="sec-head"><h2 id="bills-h">Fixed costs</h2><span class="num">${eur(billTotal)}/mo</span></div>
        ${bills.length ? `<ul class="bill-list">${bills.map((c) => billRow(c, now)).join('')}</ul>` : '<p class="empty">No fixed costs.</p>'}
      </section>
    </div>`;
}

function txRow(tx, openId) {
  const d = new Date(tx.ts);
  const time = `${shortDate(d, true)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const open = openId === tx.id;
  return `
    <li class="tx ${open ? 'is-open' : ''}">
      <button class="tx-del" type="button" data-act="del-tx" data-id="${esc(tx.id)}" tabindex="${open ? 0 : -1}" aria-label="Delete ${eur(tx.amt)} ${esc(tx.note || 'expense')}">${icon.trash}<span>Delete</span></button>
      <button class="tx-front" type="button" data-act="reveal-tx" data-id="${esc(tx.id)}" aria-expanded="${open}" aria-label="${esc(tx.note || 'Expense')}, ${eur(tx.amt)}, ${time}. Show delete">
        <span class="tx-main"><span class="tx-note">${esc(tx.note || 'Expense')}</span><span class="tx-when num">${time}</span></span>
        <span class="tx-amt num">−${eur(tx.amt)}</span>
      </button>
    </li>`;
}

export function tankView(cat, now, ctx) {
  const s = tankStatus(cat, now);
  return `
    <div class="screen lv-${s.level}" data-screen="tank">
      <header class="top bar">
        <button class="btn link back" type="button" data-act="go-home">${icon.back}<span>Back</span></button>
        <h1 class="bar-title">${esc(cat.name)}</h1>
        ${chip(s.level)}
      </header>

      <section class="panel gauge-panel" aria-label="${esc(cat.name)} status">
        <span class="lbl">${s.remaining < 0 ? 'Over budget by' : 'Left to spend'}</span>
        <span class="big-rem num" data-count="${s.remaining}">${eur(s.remaining)}</span>
        <span class="tank-of">of ${eur(cat.amount, { cents: false })} per ${perWord(cat)}</span>
        ${meter(cat, s, 'lg')}
        <dl class="readouts">
          <div class="ro hl"><dt>Safe to spend today</dt><dd class="num">${eur(s.safeToday)}</dd></div>
          <div class="ro"><dt>Spent so far</dt><dd class="num">${eur(s.spent)}</dd></div>
          <div class="ro"><dt>Resets</dt><dd class="num">${s.daysLeft === 1 ? 'Tomorrow' : `${shortDate(s.end, true)} <small>· in ${s.daysLeft} days</small>`}</dd></div>
        </dl>
      </section>

      <form class="panel log" data-form="log" autocomplete="off" aria-labelledby="log-h">
        <h2 id="log-h">Log spending</h2>
        <label class="field-wrap">
          <span class="lbl">What for? <span class="opt">optional</span></span>
          <input class="field" name="note" type="text" maxlength="60" placeholder="Albert Heijn, shawarma…" enterkeyhint="next">
        </label>
        <div class="quick" role="group" aria-label="Quick amounts">
          ${[2, 5, 10, 20].map((n) => `<button class="btn key" type="button" data-act="quick" data-amt="${n}">€${n}</button>`).join('')}
        </div>
        <div class="custom">
          <label class="euro">
            <span class="sr">Other amount in euro</span>
            <span class="euro-sign" aria-hidden="true">€</span>
            <input class="field num" name="amount" type="text" inputmode="decimal" placeholder="Other amount" enterkeyhint="done">
          </label>
          <button class="btn primary" type="submit">Log</button>
        </div>
        <p class="form-err" role="alert" hidden></p>
      </form>

      <section class="history" aria-labelledby="hist-h">
        <div class="sec-head"><h2 id="hist-h">This ${perWord(cat)}</h2><span class="num">${s.txs.length} · ${eur(s.spent)}</span></div>
        ${s.txs.length
          ? `<ul class="tx-list">${s.txs.map((t) => txRow(t, ctx.openTx)).join('')}</ul>
             <p class="hint">Swipe left or tap an expense to delete it.</p>`
          : `<p class="empty">Nothing logged this ${perWord(cat)} yet.</p>`}
      </section>
    </div>`;
}

function seg(name, options, current) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(name)}">${options.map(([value, label, full]) => `
    <button class="btn seg-btn" type="button" role="radio" aria-checked="${current === value}" data-act="ed-set" data-field="${esc(name)}" data-value="${esc(value)}"${full ? ` aria-label="${esc(full)}"` : ''}>${esc(label)}</button>`).join('')}</div>`;
}

function editor(ed, confirm) {
  const isBill = ed.type === 'bill';
  const help = isBill
    ? `Fixed amount. Tick it as paid each ${ed.period === 'week' ? 'week' : 'month'}.`
    : `Goes down as you log spending. Resets ${ed.period === 'week' ? 'every Monday' : 'on the 1st'}.`;
  const due = !isBill ? '' : ed.period === 'month'
    ? `<label class="field-wrap"><span class="lbl">Due day of month</span><input class="field num" name="dueDay" type="text" inputmode="numeric" value="${esc(ed.dueDay)}" placeholder="1–31"></label>`
    : `<div class="field-wrap"><span class="lbl">Due day</span>${seg('dueWd', [['0', 'M', 'Monday'], ['1', 'T', 'Tuesday'], ['2', 'W', 'Wednesday'], ['3', 'T', 'Thursday'], ['4', 'F', 'Friday'], ['5', 'S', 'Saturday'], ['6', 'S', 'Sunday']], String(ed.dueWd))}</div>`;
  return `
    <form class="panel editor" data-form="editor" autocomplete="off" aria-labelledby="ed-h">
      <h2 id="ed-h">${ed.id ? `Edit ${esc(ed.name)}` : 'New category'}</h2>
      <label class="field-wrap"><span class="lbl">Name</span><input class="field" name="name" type="text" maxlength="40" value="${esc(ed.name)}" placeholder="e.g. Transport"></label>
      <label class="field-wrap"><span class="lbl">Amount</span>
        <span class="euro"><span class="euro-sign" aria-hidden="true">€</span><input class="field num" name="amount" type="text" inputmode="decimal" value="${esc(ed.amount)}" placeholder="0.00"></span>
      </label>
      <div class="field-wrap"><span class="lbl">Type</span>${seg('type', [['tank', 'Spending'], ['bill', 'Fixed cost']], ed.type)}</div>
      <div class="field-wrap"><span class="lbl">Period</span>${seg('period', [['week', 'Weekly'], ['month', 'Monthly']], ed.period)}</div>
      ${due}
      <p class="help">${help}</p>
      <p class="form-err" role="alert" ${ed.error ? '' : 'hidden'}>${esc(ed.error || '')}</p>
      <div class="actions">
        <button class="btn" type="button" data-act="cancel-edit">Cancel</button>
        <button class="btn primary" type="submit">Save</button>
      </div>
      ${ed.id ? `<button class="btn danger" type="button" data-act="del-cat">${confirm === 'cat' ? 'Tap again to delete' : 'Delete category'}</button>` : ''}
    </form>`;
}

function catRow(c) {
  return `
    <li class="cat">
      <span class="cat-type ${c.type === 'tank' ? 'is-tank' : ''}">${c.type === 'tank' ? 'Spend' : 'Fixed'}</span>
      <span class="cat-name">${esc(c.name)}</span>
      <span class="cat-amt num">${eur(c.amount, { cents: false })}<small>/${c.period === 'week' ? 'wk' : 'mo'}</small></span>
      <button class="btn link" type="button" data-act="edit-cat" data-id="${esc(c.id)}" aria-label="Edit ${esc(c.name)}">Edit</button>
    </li>`;
}

export function settingsView(data, ctx) {
  const balance = typeof data.balance === 'number' ? String(data.balance) : '';
  const income = typeof data.income === 'number' ? String(data.income) : '';
  return `
    <div class="screen" data-screen="settings">
      <header class="top bar">
        <button class="btn link back" type="button" data-act="go-home">${icon.back}<span>Back</span></button>
        <h1 class="bar-title">Settings</h1>
        <span class="bar-spacer" aria-hidden="true"></span>
      </header>

      <section class="panel" aria-labelledby="inc-h">
        <div class="sec-head"><h2 id="inc-h">Money in per month</h2><span>Optional</span></div>
        <label class="euro">
          <span class="sr">Money coming in per month in euro</span>
          <span class="euro-sign" aria-hidden="true">€</span>
          <input class="field num" id="income" data-input="income" type="text" inputmode="decimal" value="${esc(income)}" placeholder="e.g. 1362" autocomplete="off">
        </label>
        <p class="help">What arrives each month, rent included. The home screen shows what is left after every bill and tank.</p>
      </section>

      <section class="panel" aria-labelledby="bal-h">
        <div class="sec-head"><h2 id="bal-h">Total balance</h2><span>Optional</span></div>
        <label class="euro">
          <span class="sr">Current total balance in euro</span>
          <span class="euro-sign" aria-hidden="true">€</span>
          <input class="field num" id="balance" data-input="balance" type="text" inputmode="decimal" value="${esc(balance)}" placeholder="e.g. 4200" autocomplete="off">
        </label>
        <p class="help">Everything you have across accounts. Used to show how long your money lasts. Leave empty to hide it.</p>
      </section>

      ${ctx.editor ? editor(ctx.editor, ctx.confirm) : `
      <section class="panel" aria-labelledby="cat-h">
        <div class="sec-head"><h2 id="cat-h">Categories</h2><span>${data.cats.length}</span></div>
        <ul class="cat-list">${data.cats.map(catRow).join('')}</ul>
        <button class="btn dashed" type="button" data-act="new-cat">${icon.plus}<span>Add category</span></button>
      </section>`}

      <section class="panel" aria-labelledby="data-h">
        <div class="sec-head"><h2 id="data-h">Your data</h2></div>
        <p class="help">Saved on this phone only. No account, no bank connection. Export a backup now and then so you never lose it.</p>
        <div class="actions">
          <button class="btn" type="button" data-act="export">Export backup</button>
          <label class="btn file-btn">Import backup<input type="file" accept="application/json,.json" data-input="import" class="sr"></label>
        </div>
        <div class="actions">
          <button class="btn danger" type="button" data-act="wipe">${ctx.confirm === 'wipe' ? 'Tap again to clear' : 'Clear all expenses'}</button>
          <button class="btn danger" type="button" data-act="reset">${ctx.confirm === 'reset' ? 'Tap again to reset' : 'Reset everything'}</button>
        </div>
      </section>
      <p class="foot">Budget · works offline · v${ctx.version}</p>
    </div>`;
}
