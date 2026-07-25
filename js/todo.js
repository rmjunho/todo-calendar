'use strict';
// 할 일 저장 · CRUD · 입력 시트 · 이벤트 바인딩. 마지막에 로드된다.

// ---------------------------------------------------------------- persistence
const STORE_KEY = 'todo-cal-v1';       // legacy single-user store, migrated to the admin on first run

function seed(t) {
  const today = fmt(t);
  const first = fmt(new Date(t.getFullYear(), t.getMonth(), 1));
  return [
    { id: uid(), title: '팀 주간 회의', date: today, time: '10:00', pri: 'med', repeat: 'weekly', memo: '회의실 B · 안건 미리 준비', done: false, doneDates: [] },
    { id: uid(), title: '운동', date: today, time: '19:30', pri: 'low', repeat: 'daily', memo: '', done: false, doneDates: [] },
    { id: uid(), title: '약국 들르기', date: today, time: '', pri: 'low', repeat: 'none', memo: '', done: true, doneDates: [] },
    { id: uid(), title: '장보기', date: addDays(today, 1), time: '', pri: 'low', repeat: 'none', memo: '우유 · 달걀 · 시금치', done: false, doneDates: [] },
    { id: uid(), title: '프로젝트 제안서 마감', date: addDays(today, 3), time: '18:00', pri: 'high', repeat: 'none', memo: '최종 검토 후 제출', done: false, doneDates: [] },
    { id: uid(), title: '월세 이체', date: first, time: '', pri: 'high', repeat: 'monthly', memo: '', done: false, doneDates: [] }
  ];
}
// Each account gets its own task list — this is a personal calendar, not a shared one.
const itemsKey = (user) => STORE_KEY + ':' + user.id;

function load(user) {
  let items = null;
  try { items = JSON.parse(localStorage.getItem(itemsKey(user))); } catch (e) {}
  if (!Array.isArray(items)) {
    // First login: the admin inherits any tasks saved before accounts existed,
    // falling back to the sample set. New members start with an empty calendar.
    if (user.role === 'admin') {
      try { items = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
      if (!Array.isArray(items)) items = seed(new Date());
    } else {
      items = [];
    }
    save(user, items);
  }
  return items;
}
function save(user, items) {
  try { localStorage.setItem(itemsKey(user), JSON.stringify(items)); } catch (e) {}
}

const blankForm = (date) => ({ title: '', date, hasTime: false, time: '09:00', pri: 'none', repeat: 'none', memo: '' });

function persist(items) { state.items = items; save(state.user, items); render(); }

function toggleDone(id, ds) {
  persist(state.items.map((it) => {
    if (it.id !== id) return it;
    if (it.repeat && it.repeat !== 'none') {
      const dd = it.doneDates || [];
      return Object.assign({}, it, { doneDates: dd.includes(ds) ? dd.filter((x) => x !== ds) : dd.concat(ds) });
    }
    return Object.assign({}, it, { done: !it.done });
  }));
}

// ---------------------------------------------------------------- form sheet
function renderSheet() {
  const f = state.form;
  const priChoices = Object.keys(PRI).map((k) => {
    const on = f.pri === k, c = PRI[k].c;
    return '<button class="pri" data-pri="' + k + '" style="background-color:' +
      (on ? 'color-mix(in srgb, ' + c + ' 16%, transparent)' : 'var(--fill-tertiary)') +
      ';color:' + (on ? c : 'var(--label-secondary)') +
      (on ? ';box-shadow:inset 0 0 0 1.5px ' + c + ', var(--tc-raise-sm)' : '') + '">' +
      '<span style="width:9px;height:9px;border-radius:50%;background:' + c + '"></span>' + PRI[k].label + '</button>';
  }).join('');

  const repeatMenu = state.repeatOpen ? '<div class="picker-menu" role="menu">' +
    Object.keys(REP).map((k) =>
      '<button role="menuitemradio" aria-checked="' + (f.repeat === k) + '" data-repeat="' + k + '">' +
      '<span>' + REP[k] + '</span>' + (f.repeat === k ? icon('checkmark', 16, 'var(--tint)') : '') + '</button>'
    ).join('') + '</div>' : '';

  const timeBlock = f.hasTime
    ? '<input class="field" type="time" data-f="time" value="' + esc(f.time) + '" style="padding:11px 14px;font-size:15px">'
    : '<div style="padding:11px 14px;font-size:14px;color:var(--label-tertiary);background:var(--fill-quaternary);border-radius:12px">하루 종일</div>';

  return '<div data-act="close" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div id="sheet" role="dialog" aria-modal="true" style="pointer-events:auto;width:min(560px,100vw);max-height:88vh;overflow:auto;' +
      'background:var(--bg);border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + (state.editingId ? '할 일 편집' : '새로운 할 일') + '</h3>' +
        '<button data-act="close" aria-label="닫기" style="border:none;cursor:pointer;width:30px;height:30px;border-radius:50%;' +
          'background:var(--fill-tertiary);color:var(--label-secondary);display:flex;align-items:center;justify-content:center;padding:0">' +
          icon('xmark', 14) + '</button></div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">제목</div>' +
      '<input class="field" type="text" data-f="title" placeholder="무엇을 해야 하나요?" value="' + esc(f.title) +
        '" style="padding:12px 14px;font-size:16px">' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
        '<div><div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">날짜</div>' +
          '<input class="field" type="date" data-f="date" value="' + esc(f.date) + '" style="padding:11px 14px;font-size:15px"></div>' +
        '<div><div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
            '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">시간</span>' +
            '<button class="sw" role="switch" data-act="toggleTime" aria-checked="' + f.hasTime + '" aria-label="시간 지정"><span></span></button>' +
          '</div>' + timeBlock + '</div></div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">우선순위</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + priChoices + '</div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">반복</div>' +
      '<div class="picker"><button class="picker-btn" data-act="repeatToggle" aria-haspopup="menu" aria-expanded="' + state.repeatOpen + '">' +
        '<span>' + REP[f.repeat] + '</span>' + icon('chevron.up.chevron.down', 15, 'var(--tint)') + '</button>' + repeatMenu + '</div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">메모</div>' +
      '<textarea class="field" rows="2" data-f="memo" placeholder="메모를 남겨 보세요 (선택)" ' +
        'style="padding:12px 14px;font-size:15px;resize:vertical">' + esc(f.memo) + '</textarea>' +

      '<div style="display:flex;gap:10px;margin-top:20px;align-items:center">' +
        (state.editingId ? '<button class="btn btn-plain btn-md" data-act="delete" style="color:#FF3B30">삭제</button>' : '') +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-gray btn-md" data-act="close">취소</button>' +
        '<span data-raise="tint" style="display:inline-flex">' +
          '<button class="btn btn-prominent btn-md" id="saveBtn" data-act="save"' +
          (f.title.trim() ? '' : ' disabled') + '>저장</button></span>' +
      '</div></div></div>';
}

// ---------------------------------------------------------------- interaction
const app = document.getElementById('app');

function openForm(id, ds) {
  if (id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    state.editingId = id;
    state.form = { title: it.title, date: ds || it.date, hasTime: !!it.time, time: it.time || '09:00',
      pri: it.pri || 'none', repeat: it.repeat || 'none', memo: it.memo || '' };
  } else {
    state.editingId = null;
    state.form = blankForm(state.selected);
  }
  state.showForm = true;
  state.repeatOpen = false;
  render();
}
function closeForm() {
  state.showForm = false;
  state.editingId = null;
  state.form = null;
  state.repeatOpen = false;
  render();
}
function saveForm() {
  const f = state.form;
  if (!f.title.trim()) return;
  const base = { title: f.title.trim(), date: f.date, time: f.hasTime ? f.time : '',
    pri: f.pri, repeat: f.repeat, memo: (f.memo || '').trim() };
  const items = state.editingId
    ? state.items.map((it) => (it.id === state.editingId ? Object.assign({}, it, base) : it))
    : state.items.concat(Object.assign({ id: uid() }, base, { done: false, doneDates: [] }));
  state.selected = f.date;
  state.showForm = false;
  state.editingId = null;
  state.form = null;
  persist(items);
}

app.addEventListener('click', (e) => {
  const t = e.target;
  const hit = (sel) => t.closest(sel);
  let el;

  if ((el = hit('[data-authmode]'))) {
    state.auth.mode = el.dataset.authmode;
    state.auth.pin = state.auth.pin2 = state.auth.error = state.auth.notice = '';
    return render();
  }
  if ((el = hit('[data-approve]'))) return decide(el.dataset.approve, 'approved');
  if ((el = hit('[data-reject]'))) return decide(el.dataset.reject, 'rejected');
  if ((el = hit('[data-view]'))) { state.view = el.dataset.view; return render(); }
  if ((el = hit('[data-nav]'))) {
    const dir = el.dataset.nav;
    if (dir === 'today') {
      const n = new Date();
      state.cy = n.getFullYear(); state.cm = n.getMonth(); state.selected = fmt(n);
    } else {
      const step = dir === 'prev' ? -1 : 1;
      if (state.view === 'month') {
        const m = new Date(state.cy, state.cm + step, 1);
        state.cy = m.getFullYear(); state.cm = m.getMonth();
      } else {
        state.selected = addDays(state.selected, step * (state.view === 'week' ? 7 : 1));
      }
    }
    return render();
  }
  if ((el = hit('[data-toggle]'))) { e.stopPropagation(); return toggleDone(el.dataset.toggle, state.selected); }
  if ((el = hit('[data-open]'))) { e.stopPropagation(); return openForm(el.dataset.open, el.dataset.ds); }
  if ((el = hit('[data-day]'))) {
    const ds = el.dataset.day, d = parse(ds);
    state.selected = ds; state.cy = d.getFullYear(); state.cm = d.getMonth();
    return render();
  }
  if ((el = hit('[data-pri]'))) { state.form.pri = el.dataset.pri; return render(); }
  if ((el = hit('[data-repeat]'))) { state.form.repeat = el.dataset.repeat; state.repeatOpen = false; return render(); }
  if ((el = hit('[data-act]'))) {
    switch (el.dataset.act) {
      case 'login': return login();
      case 'signup': return signup();
      case 'logout': return logout();
      case 'toggleRemember': state.auth.remember = !state.auth.remember; return render();
      case 'admin': state.showAdmin = true; return render();
      case 'closeAdmin': state.showAdmin = false; return render();
      case 'open': return openForm(null);
      case 'close': return closeForm();
      case 'save': return saveForm();
      case 'delete':
        state.showForm = false;
        return persist(state.items.filter((it) => it.id !== state.editingId));
      case 'toggleTime': state.form.hasTime = !state.form.hasTime; return render();
      case 'repeatToggle': state.repeatOpen = !state.repeatOpen; return render();
    }
  }
  // click outside an open repeat menu closes it
  if (state.repeatOpen && !hit('.picker')) { state.repeatOpen = false; render(); }
});

// Form fields stay uncontrolled so typing never re-renders (and never loses the
// caret); state is updated in place and read back on the next render.
app.addEventListener('input', (e) => {
  const auth = e.target.closest('[data-a]');
  if (auth) { state.auth[auth.dataset.a] = auth.value; return; }
  const el = e.target.closest('[data-f]');
  if (!el || !state.form) return;
  state.form[el.dataset.f] = el.value;
  if (el.dataset.f === 'title') {
    const btn = document.getElementById('saveBtn');
    if (btn) btn.disabled = !el.value.trim();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.showForm) return closeForm();
    if (state.showAdmin) { state.showAdmin = false; return render(); }
  }
  // Enter submits the login / signup form.
  if (e.key === 'Enter' && !state.user && e.target.closest('[data-a]')) {
    return state.auth.mode === 'login' ? login() : signup();
  }
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
// The "now" indicator tracks a real clock, so refresh the day view each minute.
setInterval(() => { if (state.view === 'day' && !state.showForm) render(); }, 60000);

restoreSession();
render();

// ---------------------------------------------------------------- self-check
// Run with ?selftest in the URL. Covers recurrence + per-date completion +
// ordering — the logic that silently corrupts the calendar if it breaks.
if (location.search.includes('selftest')) {
  const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
  const w = { id: 'w', date: '2026-01-05', repeat: 'weekly', time: '', pri: 'none', doneDates: ['2026-01-12'] };
  const m = { id: 'm', date: '2026-01-31', repeat: 'monthly', time: '09:00', pri: 'none', doneDates: [] };
  const o = { id: 'o', date: '2026-01-05', repeat: 'none', time: '08:00', pri: 'high', done: true };

  ok(!occursOn(w, '2026-01-04'), 'no occurrence before start date');
  ok(occursOn(w, '2026-01-05') && occursOn(w, '2026-01-12'), 'weekly repeats on same weekday');
  ok(!occursOn(w, '2026-01-13'), 'weekly skips other weekdays');
  ok(occursOn(m, '2026-03-31'), 'monthly repeats on same day-of-month');
  ok(!occursOn(m, '2026-02-28'), 'monthly skips months without that day');
  ok(occursOn(o, '2026-01-05') && !occursOn(o, '2026-01-06'), 'one-off occurs only on its date');

  ok(isDone(w, '2026-01-12') && !isDone(w, '2026-01-05'), 'repeating completion is per-date');
  ok(isDone(o, '2026-01-05'), 'one-off completion uses the done flag');

  ok(itemsOn([w, m, o], '2026-01-05', true).map((x) => x.id).join() === 'w,o',
    'all-day sorts before timed items');
  ok(itemsOn([w, m, o], '2026-01-05', false).map((x) => x.id).join() === 'w',
    'completed items are filtered out when hidden');

  // --- accounts ---
  ok(validPin('4943') && validPin('12345678'), 'PINs of 4 to 8 digits are accepted');
  ok(!validPin('123') && !validPin('123456789'), 'PINs outside 4-8 digits are rejected');
  ok(!validPin('12a4') && !validPin('') && !validPin(null), 'non-numeric and empty PINs are rejected');

  const admin = state.users.find((u) => u.role === 'admin');
  ok(admin && admin.name === '이준호' && admin.pin === '4943' && admin.status === 'approved',
    'the admin account is seeded and pre-approved');
  ok(findUser(state.users, '  이준호  '), 'lookup trims surrounding whitespace in the name');
  ok(!findUser(state.users, '이준'), 'lookup does not match a partial name');
  ok(itemsKey({ id: 'a1' }) !== itemsKey({ id: 'a2' }), 'each account stores tasks under its own key');

  console.log('selftest: all checks passed');
}
