'use strict';
// 할 일 저장 · CRUD · 입력 시트 · 이벤트 바인딩. 마지막에 로드된다.

// ---------------------------------------------------------------- persistence
// 할 일은 users/{uid}/todos/{id} 에 산다. 목록은 firebase.js 의 onSnapshot 이
// state.items 로 흘려 넣는다 — 여기서는 쓰기만 한다.
const blankForm = (date) => ({ title: '', date, hasTime: false, time: '09:00', pri: 'none', repeat: 'none', memo: '' });

// 낙관적 업데이트: 화면을 먼저 바꾸고 Firestore 에 쓴다. 실패하면 알리고,
// 스냅샷이 서버 값으로 되돌려 놓는다. 예전 save() 처럼 조용히 삼키지 않는다 —
// localStorage 에서는 용량 초과였지만 여기서는 데이터 소실이다.
function commit(items, write) {
  state.items = items;
  render();
  write().catch((e) => fb.fail('저장에 실패했습니다', e));
}

function toggleDone(id, ds) {
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  const repeating = !!it.repeat && it.repeat !== 'none';
  const dd = it.doneDates || [];
  const on = repeating ? !dd.includes(ds) : !it.done;
  const next = repeating
    ? Object.assign({}, it, { doneDates: on ? dd.concat(ds) : dd.filter((x) => x !== ds) })
    : Object.assign({}, it, { done: on });
  commit(state.items.map((x) => (x.id === id ? next : x)), () => fb.setToggle(id, ds, repeating, on));
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
  // 새 항목의 id 는 Firestore 가 만든다 — 기기 간 충돌이 없고, 쓰기를 기다리지
  // 않고도 화면에 먼저 넣을 수 있다.
  const editing = !!state.editingId;
  const id = state.editingId || fb.newId();
  const fresh = Object.assign({ id }, base, { done: false, doneDates: [] });
  const items = editing
    ? state.items.map((it) => (it.id === id ? Object.assign({}, it, base) : it))
    : state.items.concat(fresh);
  state.selected = f.date;
  state.showForm = false;
  state.editingId = null;
  state.form = null;
  commit(items, () => fb.saveTodo(id, editing ? base
    : { title: fresh.title, date: fresh.date, time: fresh.time, pri: fresh.pri,
        repeat: fresh.repeat, memo: fresh.memo, done: false, doneDates: [] }));
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
  // 약관 전문 보기. data-agree 보다 먼저 본다 — 체크 행 바로 옆에 있는 버튼이다.
  if ((el = hit('[data-legal]'))) { state.legal = el.dataset.legal; return render(); }
  if ((el = hit('[data-agree]'))) {
    const g = state.auth.agree, k = el.dataset.agree;
    if (k === 'all') {
      // 선택 항목(marketing)까지 포함해 전부 켜고, 다시 누르면 전부 끈다.
      const on = !(g.terms && g.privacy && g.age && g.marketing);
      g.terms = g.privacy = g.marketing = on;
      g.age = on ? 'over14' : '';
    } else if (k === 'age') {
      // 배타 선택: 같은 걸 다시 누르면 해제, 다른 걸 누르면 교체된다.
      g.age = g.age === el.dataset.val ? '' : el.dataset.val;
    } else {
      g[k] = !g[k];
    }
    return render();
  }
  if ((el = hit('[data-approve]'))) return decide(el.dataset.approve, 'approved');
  if ((el = hit('[data-reject]'))) return decide(el.dataset.reject, 'rejected');
  if ((el = hit('[data-resetpin]'))) return resetPin(el.dataset.resetpin);
  if ((el = hit('[data-delacct]'))) return removeAccount(el.dataset.delacct);
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
      case 'closeLegal': state.legal = null; return render();
      case 'admin': state.showAdmin = true; return render();
      case 'closeAdmin': state.showAdmin = false; return render();
      case 'settings': state.showSettings = true; state.del = null; return render();
      case 'closeSettings': state.showSettings = false; state.del = null; return render();
      // 탈퇴는 두 단계다 — 버튼 한 번으로는 절대 지워지지 않는다.
      case 'askDelete': state.del = { pin: '', error: '', busy: false }; return render();
      case 'cancelDelete': state.del = null; return render();
      case 'confirmDelete': return removeSelf();
      case 'migrate': return migrateLocal();
      case 'open': return openForm(null);
      case 'close': return closeForm();
      case 'save': return saveForm();
      case 'delete': {
        const id = state.editingId;
        state.showForm = false;
        state.editingId = null;
        state.form = null;
        return commit(state.items.filter((it) => it.id !== id), () => fb.removeTodo(id));
      }
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
  // 탈퇴 확인 PIN. state.auth 와 섞지 않는다 — 로그인 폼과 수명이 다르다.
  const del = e.target.closest('[data-d]');
  if (del) { if (state.del) state.del[del.dataset.d] = del.value; return; }
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
    // 약관 모달이 제일 위에 뜬다 — 먼저 닫는다.
    if (state.legal) { state.legal = null; return render(); }
    if (state.showForm) return closeForm();
    if (state.showAdmin) { state.showAdmin = false; return render(); }
    // 삭제 중에는 Esc 로 닫지 않는다 — 진행 중인 요청을 취소하지 못한다.
    if (state.showSettings && !(state.del && state.del.busy)) {
      state.showSettings = false; state.del = null; return render();
    }
  }
  // Enter submits the login / signup form.
  if (e.key === 'Enter' && !state.user && e.target.closest('[data-a]')) {
    return state.auth.mode === 'login' ? login() : signup();
  }
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
// The "now" indicator tracks a real clock, so refresh the day view each minute.
setInterval(() => { if (state.view === 'day' && !state.showForm) render(); }, 60000);

// 세션 복원은 firebase.js 의 onAuthStateChanged 가 한다. 여기서는 로딩 화면만
// 띄우고, 모듈이 끝내 오지 않으면(오프라인·CDN 차단) 사용자를 붙잡아 두지 않는다.
render();
setTimeout(() => {
  if (!state.booting) return;
  state.booting = false;
  state.auth.error = '서버에 연결하지 못했습니다. 네트워크를 확인하고 새로고침해 주세요.';
  render();
}, 10000);

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
  // 계정은 이제 Firebase 가 들고 있다. 여기서 검사할 수 있는 건 서버에 보내기
  // 전의 입력 규칙뿐 — PIN은 Firebase Auth 비밀번호라 6자리여야 한다.
  ok(validPin('123456'), 'a 6-digit PIN is accepted');
  ok(!validPin('4943') && !validPin('1234567'), 'PINs shorter or longer than 6 digits are rejected');
  ok(!validPin('12a456') && !validPin('') && !validPin(null), 'non-numeric and empty PINs are rejected');
  ok(validEmail('a@b.co') && !validEmail('a@b') && !validEmail(''), 'signup requires a real email address');
  ok(normName('  이준호  ') === '이준호', 'the name is trimmed before it is used as a key');

  // --- 약관 동의 ---
  // 여기가 뚫리면 동의 없이 가입 신청이 나간다. 서버(firestore.rules)가 한 번 더
  // 막지만, 그때는 Auth 계정만 만들어졌다 지워지는 낭비가 생긴다.
  const ag = (o) => Object.assign(blankAuth().agree, o);
  ok(agreeMissing(ag({ terms: true, privacy: true, age: 'over14' })) === '', 'all required consents pass');
  ok(agreeMissing(ag({ terms: true, privacy: true, age: 'under14_guardian' })) === '',
    'under-14 with guardian consent passes');
  ok(agreeMissing(ag({ privacy: true, age: 'over14' })), 'missing terms consent is rejected');
  ok(agreeMissing(ag({ terms: true, age: 'over14' })), 'missing privacy consent is rejected');
  ok(agreeMissing(ag({ terms: true, privacy: true })), 'missing age confirmation is rejected');
  ok(agreeMissing(ag({ terms: true, privacy: true, age: 'yes' })), 'an unknown age value is rejected');
  ok(agreeMissing(blankAuth().agree), 'a fresh signup form has nothing agreed yet');
  // marketing 은 선택이다 — 꺼져 있어도 통과해야 한다.
  ok(agreeMissing(ag({ terms: true, privacy: true, age: 'over14', marketing: false })) === '',
    'the optional marketing consent never blocks signup');

  // --- 탈퇴 ---
  // 관리자가 스스로 지우면 서비스가 관리자 없이 잠긴다. 보안 규칙에도 같은
  // 조건이 있지만, 화면에서 버튼을 감추는 판정도 여기서 지킨다.
  ok(!canDeleteSelf({ role: 'admin' }), 'an admin cannot delete their own account');
  ok(canDeleteSelf({ role: 'user' }), 'a normal user can delete their own account');
  ok(!canDeleteSelf(null), 'no session means there is nothing to delete');

  console.log('selftest: all checks passed');
}
