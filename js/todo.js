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
  write().catch((e) => fb.fail(t('err.save'), e));
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
      '<span style="width:9px;height:9px;border-radius:50%;background:' + c + '"></span>' + esc(priLabel(k)) + '</button>';
  }).join('');

  const repeatMenu = state.repeatOpen ? '<div class="picker-menu" role="menu">' +
    REP_KEYS.map((k) =>
      '<button role="menuitemradio" aria-checked="' + (f.repeat === k) + '" data-repeat="' + k + '">' +
      '<span>' + esc(repLabel(k)) + '</span>' + (f.repeat === k ? icon('checkmark', 16, 'var(--tint)') : '') + '</button>'
    ).join('') + '</div>' : '';

  const timeBlock = f.hasTime
    ? '<input class="field" type="time" data-f="time" value="' + esc(f.time) + '" style="padding:11px 14px;font-size:15px">'
    : '<div style="padding:11px 14px;font-size:14px;color:var(--label-tertiary);background:var(--fill-quaternary);border-radius:12px">' +
      esc(t('item.allDay')) + '</div>';

  return '<div data-act="close" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div id="sheet" role="dialog" aria-modal="true" style="pointer-events:auto;width:min(560px,100vw);max-height:88vh;overflow:auto;' +
      'background:var(--bg);border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(t(state.editingId ? 'form.edit' : 'form.new')) + '</h3>' +
        '<button data-act="close" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;width:30px;height:30px;border-radius:50%;' +
          'background:var(--fill-tertiary);color:var(--label-secondary);display:flex;align-items:center;justify-content:center;padding:0">' +
          icon('xmark', 14) + '</button></div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.title')) + '</div>' +
      '<input class="field" type="text" data-f="title" placeholder="' + esc(t('form.titlePh')) + '" value="' + esc(f.title) +
        '" style="padding:12px 14px;font-size:16px">' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
        '<div><div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.date')) + '</div>' +
          // value 는 'YYYY-MM-DD' 그대로다. type="date" 가 요구하는 형식이자 저장 키의
          // 형식이라 Intl 을 끼우면 안 된다 — 표시 형식은 브라우저가 로케일에 맞춘다.
          '<input class="field" type="date" data-f="date" value="' + esc(f.date) + '" style="padding:11px 14px;font-size:15px"></div>' +
        '<div><div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
            '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('form.time')) + '</span>' +
            '<button class="sw" role="switch" data-act="toggleTime" aria-checked="' + f.hasTime +
              '" aria-label="' + esc(t('form.timeToggle')) + '"><span></span></button>' +
          '</div>' + timeBlock + '</div></div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.pri')) + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + priChoices + '</div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.repeat')) + '</div>' +
      '<div class="picker"><button class="picker-btn" data-act="repeatToggle" aria-haspopup="menu" aria-expanded="' + state.repeatOpen + '">' +
        '<span>' + esc(repLabel(f.repeat)) + '</span>' + icon('chevron.up.chevron.down', 15, 'var(--tint)') + '</button>' + repeatMenu + '</div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.memo')) + '</div>' +
      '<textarea class="field" rows="2" data-f="memo" placeholder="' + esc(t('form.memoPh')) + '" ' +
        'style="padding:12px 14px;font-size:15px;resize:vertical">' + esc(f.memo) + '</textarea>' +

      '<div style="display:flex;gap:10px;margin-top:20px;align-items:center">' +
        (state.editingId ? '<button class="btn btn-plain btn-md" data-act="delete" style="color:#FF3B30">' +
          esc(t('form.delete')) + '</button>' : '') +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-gray btn-md" data-act="close">' + esc(t('form.cancel')) + '</button>' +
        '<span data-raise="tint" style="display:inline-flex">' +
          '<button class="btn btn-prominent btn-md" id="saveBtn" data-act="save"' +
          (f.title.trim() ? '' : ' disabled') + '>' + esc(t('form.save')) + '</button></span>' +
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
  // 테마·언어. 설정 시트와 로그인 화면 양쪽에서 같은 핸들러를 쓴다.
  // 로그인 전이면 localStorage 까지만 — Firestore 쓰기는 setPref 안에서 막힌다.
  if ((el = hit('[data-pref]'))) return setPref(el.dataset.pref, el.dataset.val);
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
  // 년·월 점프. 년은 고르기만 하고, 월을 누르는 순간 확정된다.
  if ((el = hit('[data-jy]'))) { state.jump.y = Number(el.dataset.jy); return render(); }
  if ((el = hit('[data-jm]'))) return applyJump(Number(el.dataset.jm));
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
      // 이미지 내보내기. 여는 순간 캔버스와 Blob 을 다 만들고, 공유·저장은
      // 시트 안의 **새 제스처**로 받는다 (export.js 의 2단 흐름).
      case 'export': return openExport();
      case 'closeExport': return closeExport();
      case 'expMemo': return toggleExportMemo();
      case 'expDetail': return toggleExportDetail();
      case 'jump': return openJump();
      case 'closeJump': return closeJump();
      case 'expShare': return shareImage();
      case 'expSave': return saveImage();
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
    // 이미지 미리보기·점프는 다른 시트 위에 뜨지 않는다 — 본문 위에서만 열린다.
    if (state.exp) return closeExport();
    if (state.jump) return closeJump();
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
// theme:'system' 일 때만 의미가 있다. render() 안의 applyTheme() 이 저장값을
// 먼저 보므로, 밝은/어두운으로 고정해 둔 사람은 OS 를 바꿔도 흔들리지 않는다.
darkMQ.addEventListener('change', render);
// The "now" indicator tracks a real clock, so refresh the day view each minute.
setInterval(() => { if (state.view === 'day' && !sheetBusy()) render(); }, 60000);

// 세션 복원은 firebase.js 의 onAuthStateChanged 가 한다. 여기서는 로딩 화면만
// 띄우고, 모듈이 끝내 오지 않으면(오프라인·CDN 차단) 사용자를 붙잡아 두지 않는다.
render();
setTimeout(() => {
  if (!state.booting) return;
  state.booting = false;
  state.auth.error = t('app.offline');
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

  // --- 설정 값 ---
  ok(okTheme('light') && okTheme('dark') && okTheme('system'), 'the three themes are accepted');
  ok(!okTheme('Dark') && !okTheme('') && !okTheme(null), 'unknown theme values are rejected');
  ok(okLang('ko') && okLang('en') && !okLang('jp'), 'only the two supported languages are accepted');

  // 원격에 있는 키는 Firestore 가 이기고, 빠진 키는 로컬 값이 살아남는다 —
  // 로그인 화면에서 고른 언어가 첫 로그인 때 사라지지 않게 하는 규칙이다.
  const keep = { theme: SETTINGS.theme, lang: SETTINGS.lang };
  setSettings({ theme: 'dark', lang: 'en' });
  ok(adoptSettings({ theme: 'light', lang: 'ko' }) === true &&
     SETTINGS.theme === 'light' && SETTINGS.lang === 'ko', 'a complete remote settings map wins');
  setSettings({ theme: 'dark', lang: 'en' });
  ok(adoptSettings({ theme: 'light' }) === false && SETTINGS.lang === 'en',
    'a missing remote key keeps the local value and asks to be promoted');
  ok(adoptSettings(undefined) === false, 'an account with no settings field asks to be promoted');
  ok(adoptSettings({ theme: 'neon', lang: 'jp' }) === false && SETTINGS.lang === 'en',
    'garbage from the server is ignored, not adopted');

  // --- ★ 언어를 바꿔도 날짜 데이터 키는 그대로여야 한다 ---
  // 여기가 뚫리면 Intl 이 저장 경로로 새어 들어간 것이고, 할 일이 하루씩 밀린다.
  // 표시 문자열은 달라지고 데이터는 안 달라진다 — 그 둘을 한 번에 본다.
  const probe = new Date(2026, 6, 25);            // 로컬 자정, 토요일
  setSettings({ lang: 'ko' });
  const koDate = fmt(probe), koDay = dayTitle(probe), koDow = dow().join();
  const koOcc = [occursOn(w, '2026-01-12'), occursOn(m, '2026-03-31'), occursOn(o, '2026-01-05')].join();
  const koDone = [isDone(w, '2026-01-12'), isDone(w, '2026-01-05'), isDone(o, '2026-01-05')].join();
  setSettings({ lang: 'en' });
  ok(fmt(probe) === koDate && fmt(probe) === '2026-07-25', 'fmt() is byte-identical in English');
  ok(fmt(parse('2026-07-25')) === '2026-07-25', 'the date key survives a parse/format round trip');
  ok(addDays('2026-07-25', 1) === '2026-07-26' && addDays('2026-12-31', 1) === '2027-01-01',
    'addDays stays on the local-string calendar across a year boundary');
  ok([occursOn(w, '2026-01-12'), occursOn(m, '2026-03-31'), occursOn(o, '2026-01-05')].join() === koOcc,
    'occursOn does not depend on the language');
  ok([isDone(w, '2026-01-12'), isDone(w, '2026-01-05'), isDone(o, '2026-01-05')].join() === koDone,
    'isDone does not depend on the language');
  ok(itemsOn([w, m, o], '2026-01-05', true).map((x) => x.id).join() === 'w,o',
    'ordering does not depend on the language');
  // 반대쪽도 확인한다 — 표시 문자열까지 안 바뀌면 Intl 이 아예 안 걸린 것이다.
  ok(dayTitle(probe) !== koDay && dow().join() !== koDow, 'the displayed month and weekday names do change');
  ok(dow().length === 7 && dow('long')[0] === 'Sunday', 'the weekday array is Sunday-first');
  setSettings(keep);   // ?selftest 가 저장된 설정을 건드리고 끝나지 않게 되돌린다

  // --- 이미지 내보내기 ---
  // 캔버스 픽셀은 검증이 어렵다. 순수 함수로 뽑아 둔 네 가지만 본다 —
  // 줄바꿈·말줄임 / 뷰별 레이아웃 좌표 / 파일명 / 메모 제외.

  // 가짜 측정기. 글자 하나가 10px 이라고 치면 계산을 손으로 검산할 수 있다.
  const mm = (s) => s.length * 10;
  ok(exEllipsize('가나다라마', 50, mm) === '가나다라마', 'text that already fits is left alone');
  ok(exEllipsize('가나다라마바사', 50, mm) === '가나다라…', 'an overlong string is cut and gets an ellipsis');
  ok(exWrap('가나다라마바사아자차', 50, 1, mm).join('|') === '가나다라…',
    'a single-line box ellipsises a long Korean title');
  ok(exWrap('가나다라마바사아자차', 50, 2, mm).join('|') === '가나다라마|바사아자차',
    'Korean wraps per character when there is no space to break on');
  ok(exWrap('hello world foo', 100, 2, mm).join('|') === 'hello|world foo',
    'English breaks on the last space, not mid-word');
  ok(exWrap('', 100, 2, mm).length === 0, 'an empty title produces no lines');
  ok(exWrap('   ', 100, 2, mm).length === 0, 'a whitespace-only title produces no lines');
  ok(exWrap('가나다', 5, 1, mm).length === 1, 'a box too narrow for one glyph still terminates');

  // 2026-07-01 은 수요일(offset 3) + 31일 → 5주. 2026-08-01 은 토요일(offset 6) → 6주.
  // 2026-02-01 은 일요일(offset 0) + 28일 → 정확히 4주, 격자 경계 케이스다.
  const jul = exMonthLayout(2026, 6), aug = exMonthLayout(2026, 7), feb = exMonthLayout(2026, 1);
  ok(jul.weeks === 5 && jul.h === 1150, 'a 5-week month is 1080x1150');
  ok(aug.weeks === 6 && aug.h === 1326, 'a 6-week month is one row taller');
  ok(feb.weeks === 4 && feb.offset === 0, 'a month that starts on Sunday and ends on Saturday is exactly 4 weeks');
  ok(aug.h - jul.h === 176 && jul.w === 1080 && aug.w === 1080, 'only the height changes with the week count');
  ok(Math.abs(jul.cellW * 7 - 1020) < 1e-9, 'the seven columns fill the grid exactly');

  // 주·일은 데이터가 높이를 정하므로 위아래를 클램프한다.
  // 하한은 데이터가 적으면 이미지도 짧아야 해서 낮췄다 (총 598px = 요일 줄 + 3칸).
  ok(exWeekLayout(0).h === 598 && exWeekLayout(0).fit >= 1, 'a sparse week produces a short image');
  ok(exWeekLayout(3).h === 598, 'the week floor covers three slots exactly');
  ok(exWeekLayout(4).h > 598, 'past the floor the week grows with the data');
  ok(exWeekLayout(99).h === 1700, 'a packed week is clamped instead of growing forever');
  ok(exWeekLayout(99).fit < 99, 'a packed week hides the overflow behind a +N line');
  ok(exDayLayout([]).h === 700 && exDayLayout([]).shown === 0, 'an empty day still renders a card');
  const many = exDayLayout(new Array(120).fill(110));
  ok(many.h <= EX_MAX_H && many.hidden > 0 && many.shown + many.hidden === 120,
    'a day with too many rows is clamped and reports what it hid');
  ok(exDayLayout(new Array(40).fill(110)).hidden === 0,
    '40 rows now fit — the day ceiling was raised from 1800 to the shared 8000 cap');

  // 파일명. 주는 ISO 주차가 아니라 **그 주 일요일**로 적는다 — 이 앱의 주는
  // 일요일 시작이고 ISO 는 월요일 시작이라 섞으면 반드시 어긋난다.
  ok(exportFilename('month', '2026-07-26', 2026, 6) === 'todo-calendar-month-2026-07.png',
    'the month filename is zero-padded');
  ok(exportFilename('day', '2026-07-26', 2026, 6) === 'todo-calendar-day-2026-07-26.png',
    'the day filename is the selected date');
  ok(exportFilename('week', '2026-07-29', 2026, 6) === 'todo-calendar-week-2026-07-26.png',
    'the week filename normalises any weekday to that week’s Sunday');

  // --- 메모는 끄면 데이터에 아예 없어야 한다 ---
  // 빈 문자열로 두면 나중에 누가 `row.memo != null` 로 검사할 때 새어 나간다.
  const secret = [{ id: 's', title: '병원', date: '2026-07-26', time: '', pri: 'none',
    repeat: 'none', memo: '진료 기록 열람', done: false }];
  const withMemo = exportModel('day', secret, '2026-07-26', 2026, 6, true);
  const noMemo = exportModel('day', secret, '2026-07-26', 2026, 6, false);
  ok(withMemo.rows[0].memo === '진료 기록 열람', 'the note is carried when the toggle is on');
  ok(!('memo' in noMemo.rows[0]), 'the note key is absent entirely when the toggle is off');
  ok(JSON.stringify(noMemo).indexOf('진료 기록 열람') === -1,
    'the note text appears nowhere in the exported model when the toggle is off');
  // 월 뷰도 같은 경로를 지난다 — 셀에 메모를 안 그린다고 모델에 남겨 두면 안 된다.
  const mNo = exportModel('month', secret, '2026-07-26', 2026, 6, false);
  ok(JSON.stringify(mNo).indexOf('진료 기록 열람') === -1,
    'the month model drops the note too');
  ok(mNo.days.length === 35 && mNo.days.filter((d) => d.inMonth).length === 31,
    'the month model covers 5 weeks and 31 days of July 2026');

  // --- 상세 목록 (월·주 격자 아래) ---
  // 셀 폭 154px 에서 잘리는 제목을 폭 1080 으로 다시 싣는 영역이다.
  const g1 = [{ ds: '2026-07-26', rows: [{ title: '가', done: false }] }];
  ok(exDetailLayout([], 5000).h === 0, 'no days with to-dos means no detail section at all');
  ok(exDetailLayout(g1, 5000).h === 56 + 110 + 20,
    'one day with one row is a date header plus a row plus the gap');
  ok(exDetailLayout(g1, 5000).hidden === 0 && exDetailLayout(g1, 5000).shown === 1,
    'nothing is hidden when it fits');
  ok(exDetailLayout([{ ds: 'x', rows: [{ title: 'a' }, { title: 'b', memo: 'm' }] }], 5000).h
     === 56 + 110 + (110 + 62) + 20, 'a row carrying a note reserves two extra lines');
  const gMany = [];
  for (let i = 0; i < 60; i++) gMany.push({ ds: '2026-07-' + pad((i % 28) + 1), rows: [{ title: 'a' }] });
  const dm = exDetailLayout(gMany, 1000);
  ok(dm.hidden > 0 && dm.shown + dm.hidden === 60, 'an over-budget detail list reports what it cut');
  ok(dm.h <= 1000, 'the +N line is counted inside the budget, not added on top of it');

  // 상세를 끄면 월 이미지는 지금과 바이트 동일해야 한다 — 높이가 안 변해야 성립한다.
  const busy = [];
  for (let d = 1; d <= 28; d++) {
    busy.push({ id: 'x' + d, title: '항목 ' + d, date: '2026-07-' + pad(d), time: '',
      pri: 'none', repeat: 'none', memo: '메모 ' + d, done: false });
  }
  const off = exportModel('month', busy, '2026-07-26', 2026, 6, true, false);
  const on = exportModel('month', busy, '2026-07-26', 2026, 6, true, true);
  ok(off.layout.h === 1150 && !off.layout.detail,
    'with the detail list off the month image keeps its exact old height');
  ok(on.layout.h > off.layout.h && on.layout.detail.shown === 28,
    'with it on the image grows and every day that has to-dos gets a header');
  ok(on.layout.h <= EX_MAX_H, 'the detail list never pushes the image past the canvas ceiling');
  // 앞뒤 달에서 넘어온 칸은 격자에만 있고 상세에는 안 실린다.
  ok(on.layout.detail.groups.every((g) => g.ds.slice(0, 7) === '2026-07'),
    'the month detail lists only days belonging to that month');

  // ★ 두 토글의 상호작용: 상세는 나오되 메모 줄은 없어야 한다.
  const dOnMOff = exportModel('month', busy, '2026-07-26', 2026, 6, false, true);
  ok(dOnMOff.layout.detail.shown === 28, 'detail=true still produces the list when memo=false');
  ok(dOnMOff.layout.detail.groups.every((g) => g.rows.every((r) => !('memo' in r))),
    'detail=true + memo=false leaves no note on any detail row');
  ok(JSON.stringify(dOnMOff).indexOf('메모 ') === -1,
    'no note text survives anywhere in the model when memo is off');
  ok(dOnMOff.layout.h < on.layout.h, 'dropping the notes makes the detail list shorter');

  // --- 년·월 점프 ---
  const ys = jumpYears(2026, 2026);
  ok(ys.length === 21 && ys[0] === 2016 && ys[20] === 2036, 'the year range is today ±10');
  ok(jumpYears(2026, 2040).indexOf(2040) >= 0 && jumpYears(2026, 2040).length === 22,
    'a year outside the range is added so the current view is always selectable');
  ok(jumpYears(2026, 2016).length === 21, 'a year already at the boundary is not duplicated');

  // 말일 클램프 — 없는 날을 고르면 그 달 마지막 날로 내려앉는다.
  ok(clampDay(2026, 1, 31) === '2026-02-28', 'Jan 31 → February lands on the 28th');
  ok(clampDay(2028, 1, 31) === '2028-02-29', 'a leap year keeps the 29th');
  ok(clampDay(2026, 3, 31) === '2026-04-30', '31st → a 30-day month lands on the 30th');
  ok(clampDay(2026, 6, 15) === '2026-07-15', 'a day that exists is left alone');

  // ★ 점프는 cy/cm/selected 를 함께 쓴다. `<` `>` 는 축이 갈리지만(월간은 cy/cm 만),
  //   점프는 [data-day]·[today] 계열이다 — 안 그러면 하단 리스트가 이전 달을 가리킨다.
  const jm = jumpTo('month', 2026, 1, '2026-07-26');
  ok(jm.cy === 2026 && jm.cm === 1 && jm.selected === '2026-02-01',
    'jumping in month view moves the selection to the 1st of the target month');
  ok(jumpTo('week', 2027, 11, '2026-07-26').selected === '2027-12-01',
    'week view jumps to the 1st as well');
  ok(jumpTo('day', 2026, 1, '2026-01-31').selected === '2026-02-28',
    'day view keeps the day-of-month and clamps it to the last day');
  ok(jumpTo('day', 2026, 1, '2026-01-15').selected === '2026-02-15',
    'day view keeps the day-of-month when it exists');
  // 어느 뷰든 선택된 날은 반드시 점프한 달 안에 있어야 한다.
  ['month', 'week', 'day'].forEach((v) => {
    const r = jumpTo(v, 2026, 1, '2026-07-31');
    ok(r.selected.slice(0, 7) === '2026-02' && parse(r.selected).getMonth() === r.cm,
      'the selected date always lands inside the month that was jumped to (' + v + ')');
  });

  console.log('selftest: all checks passed');
}
