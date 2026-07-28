'use strict';
// 할 일 저장 · CRUD · 입력 시트 · 이벤트 바인딩. 마지막에 로드된다.

// ---------------------------------------------------------------- persistence
// 할 일은 users/{uid}/todos/{id} 에 산다. 목록은 firebase.js 의 onSnapshot 이
// state.items 로 흘려 넣는다 — 여기서는 쓰기만 한다.
const blankForm = (date) => ({ title: '', date, hasTime: false, time: '07:00', end: '08:00',
  pri: 'none', repeat: 'none', days: [], memo: '' });

// ★ 자정 넘김을 막는다. 종료가 시작보다 빠르거나 같으면 저장하지 않는다 —
//   23:00 → 01:00 을 허용하면 "그 날 안"이라는 전제가 깨져서 반복 판정·정렬·
//   일간 뷰가 전부 이틀에 걸친 항목을 다뤄야 한다. 'HH:MM' 은 사전순이 곧
//   시간순이라 문자열 비교로 충분하다 (Date 를 만들면 타임존이 끼어든다).
const endOk = (f) => !f.hasTime || !f.end || f.end > f.time;
// 폼 → 저장값. 하루 종일이면 둘 다 비운다. weekly 의 days 와 같은 방식으로
// endTime 은 **늘 쓴다** — 옛 문서엔 키가 없고, 읽는 쪽이 `|| ''` 로 폴백한다.
const formTimes = (f) => (f.hasTime ? { time: f.time, endTime: f.end || '' } : { time: '', endTime: '' });
// 요일 반복의 기본값 = 시작일의 요일 하나. 아무것도 안 고치면 예전 '매주' 와
// 결과가 같다. 색인은 getDay() 기준 0=일 (주 시작 일요일 고정 — CONTEXT §5).
const defaultDays = (ds) => [parse(ds).getDay()];

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

  // 요일 선택 줄. 기존 .seg-wrap / .seg 를 그대로 쓴다 (새 CSS 규칙 0개).
  // dow() 가 0=일 순서로 주므로 버튼 순서도 일요일부터다 — data-dow 값이 곧 색인.
  // data-day 는 달력 셀이 이미 쓰고 있어서 이름을 달리한다.
  const dayRow = f.repeat !== 'weekly' ? '' :
    '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' +
      esc(t('form.days')) + '</div>' +
    '<div class="seg-wrap" role="group" aria-label="' + esc(t('form.days')) + '">' +
      dow().map((nm, i) =>
        '<button class="seg' + (f.days.includes(i) ? ' seg-on' : '') + '" data-dow="' + i +
        '" aria-pressed="' + f.days.includes(i) + '" style="flex:1;min-width:0;padding:0">' +
        esc(nm) + '</button>').join('') + '</div>' +
    (f.days.length ? '' :
      '<div style="font-size:12px;color:#FF3B30;margin-top:6px">' + esc(t('form.daysEmpty')) + '</div>');

  // 요일을 하나도 안 고른 '매주' 는 아무 날에도 안 뜨는 항목이 된다 — 저장을 막는다.
  const canSave = !!f.title.trim() && !(f.repeat === 'weekly' && !f.days.length) && endOk(f);

  // 시작·종료 한 쌍. 종료를 비우면 종료 없음 — endTime 이 없던 옛 항목과 같은 상태다.
  const timeField = (k, v, key) =>
    '<div><div style="font-size:12px;font-weight:600;color:var(--label-tertiary);margin:0 0 4px">' +
      esc(t(key)) + '</div>' +
    '<input class="field" type="time" data-f="' + k + '" value="' + esc(v) +
      '" style="padding:11px 14px;font-size:15px"></div>';

  const timeBlock = f.hasTime
    ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        timeField('time', f.time, 'form.timeStart') + timeField('end', f.end, 'form.timeEnd') + '</div>' +
      (endOk(f) ? '' : '<div style="font-size:12px;color:#FF3B30;margin-top:6px">' +
        esc(t('form.endBeforeStart')) + '</div>')
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

      '<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
        '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('form.date')) + '</span>' +
        // ★ 요일은 표시 전용이다 (CONTEXT §5). type="date" 의 네이티브 표시는 브라우저가
        //   정해서 요일을 끼워 넣을 수 없으므로 라벨 줄에 따로 적는다. 저장되는 값은
        //   아래 input 의 'YYYY-MM-DD' 하나뿐이고, dow() 결과가 그리로 되돌아가는
        //   경로는 없다. 날짜를 지워 value 가 비면 요일도 안 그린다.
        (f.date ? '<span style="font-size:13px;font-weight:600;color:var(--label-tertiary)">(' +
          esc(dow()[parse(f.date).getDay()]) + ')</span>' : '') +
      '</div>' +
      // value 는 'YYYY-MM-DD' 그대로다. type="date" 가 요구하는 형식이자 저장 키의
      // 형식이라 Intl 을 끼우면 안 된다 — 표시 형식은 브라우저가 로케일에 맞춘다.
      '<input class="field" type="date" data-f="date" value="' + esc(f.date) + '" style="padding:11px 14px;font-size:15px">' +

      '<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
        '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('form.time')) + '</span>' +
        '<button class="sw" role="switch" data-act="toggleTime" aria-checked="' + f.hasTime +
          '" aria-label="' + esc(t('form.timeToggle')) + '"><span></span></button>' +
      '</div>' + timeBlock +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.pri')) + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + priChoices + '</div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.repeat')) + '</div>' +
      '<div class="picker"><button class="picker-btn" data-act="repeatToggle" aria-haspopup="menu" aria-expanded="' + state.repeatOpen + '">' +
        '<span>' + esc(repLabel(f.repeat)) + '</span>' + icon('chevron.up.chevron.down', 15, 'var(--tint)') + '</button>' + repeatMenu + '</div>' +
      dayRow +

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
          (canSave ? '' : ' disabled') + '>' + esc(t('form.save')) + '</button></span>' +
      '</div></div></div>';
}

// ---------------------------------------------------------------- interaction
const app = document.getElementById('app');

function openForm(id, ds) {
  if (id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    state.editingId = id;
    state.form = { title: it.title, date: ds || it.date, hasTime: !!it.time, time: it.time || '07:00',
      // endTime 은 옛 항목에 아예 없다 — 없으면 '' 로 열려 '종료 없음' 이 그대로
      // 유지된다. 하루 종일이던 항목의 시간을 켜면 새 항목과 같은 07:00–08:00 에서
      // 시작한다 (그 항목에는 지울 종료 시간이 애초에 없다).
      end: it.time ? (it.endTime || '') : '08:00',
      pri: it.pri || 'none', repeat: it.repeat || 'none',
      // days 가 없는 옛 weekly 항목은 시작일 요일 하나가 켜진 채로 열린다 — 지금
      // 판정과 같은 상태다. 그대로 저장하면 days 가 생기지만 결과는 안 바뀐다.
      days: (it.days && it.days.length) ? it.days.slice()
        : (it.repeat === 'weekly' ? defaultDays(it.date) : []),
      memo: it.memo || '' };
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
  // 요일을 하나도 안 고른 '매주' 는 아무 날에도 안 뜬다. 저장 버튼도 disabled 지만
  // 여기서도 막는다 — 화면 검사 하나만 믿지 않는다.
  if (f.repeat === 'weekly' && !f.days.length) return;
  // 자정을 넘기는 종료 시간도 같은 이유로 여기서 한 번 더 막는다.
  if (!endOk(f)) return;
  const base = Object.assign({ title: f.title.trim(), date: f.date }, formTimes(f), {
    pri: f.pri, repeat: f.repeat,
    // 오름차순으로 굳혀 둔다 — 판정과 라벨이 고른 순서에 안 흔들린다.
    // weekly 가 아니면 []. done/doneDates 와 같은 방식이다: 필드는 늘 있고
    // 어느 쪽을 읽을지는 repeat 이 정한다 (occursOn 은 weekly 에서만 days 를 본다).
    days: f.repeat === 'weekly' ? f.days.slice().sort((a, b) => a - b) : [],
    memo: (f.memo || '').trim() });
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
    : { title: fresh.title, date: fresh.date, time: fresh.time, endTime: fresh.endTime,
        pri: fresh.pri, repeat: fresh.repeat, days: fresh.days, memo: fresh.memo,
        done: false, doneDates: [] }));
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
  // 년·월 점프. 탭은 **임시 선택**만 옮긴다 — 달력은 [이동] 을 눌러야 움직인다.
  // 스크롤 위치는 render() 진입부의 saveJumpScroll() 이 챙기므로 여기서 안 만진다.
  if ((el = hit('[data-jy]'))) { state.jump.y = Number(el.dataset.jy); return render(); }
  if ((el = hit('[data-jm]'))) { state.jump.m = Number(el.dataset.jm); return render(); }
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
  if ((el = hit('[data-repeat]'))) {
    state.form.repeat = el.dataset.repeat;
    // '매주' 를 고르면 시작일 요일 하나가 켜진 채로 열린다 — 아무것도 더 안 고르고
    // 저장하면 예전 '매주' 와 결과가 같다.
    if (state.form.repeat === 'weekly' && !state.form.days.length) {
      state.form.days = defaultDays(state.form.date);
    }
    state.repeatOpen = false;
    return render();
  }
  if ((el = hit('[data-dow]'))) {
    const n = Number(el.dataset.dow), d = state.form.days;
    state.form.days = d.includes(n) ? d.filter((x) => x !== n) : d.concat(n).sort((a, b) => a - b);
    return render();
  }
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
      case 'expGrid': return toggleExportGrid();
      case 'jump': return openJump();
      case 'closeJump': return closeJump();
      case 'jumpGo': return applyJump();
      case 'jumpToday': return jumpNow();
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

  // --- 요일 반복 (weekly + days) ---
  // 2026-01-05 는 월요일이다: 05 월 · 06 화 · 07 수 · 08 목 · 09 금 · 10 토 · 11 일.
  const wd = { id: 'wd', date: '2026-01-05', repeat: 'weekly', days: [1, 3, 5], time: '', pri: 'none' };
  ok(occursOn(wd, '2026-01-05') && occursOn(wd, '2026-01-07') && occursOn(wd, '2026-01-09'),
    'a weekly item with days occurs on every selected weekday');
  ok(!occursOn(wd, '2026-01-06') && !occursOn(wd, '2026-01-08') && !occursOn(wd, '2026-01-11'),
    'a weekly item with days skips the weekdays that were not selected');
  ok(!occursOn(wd, '2026-01-02'), 'days never pull an item earlier than its start date');
  const sunOnly = { id: 'su', date: '2026-01-05', repeat: 'weekly', days: [0] };
  ok(occursOn(sunOnly, '2026-01-11') && !occursOn(sunOnly, '2026-01-05'),
    'days:[0] is Sundays only — the index is getDay(), not an offset from the start');
  const allDays = { id: 'ad', date: '2026-01-05', repeat: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] };
  ok([0, 1, 2, 3, 4, 5, 6].every((i) => occursOn(allDays, addDays('2026-01-05', i))),
    'all seven weekdays selected occurs on every day');
  // 빈 배열은 '없음'과 같이 다룬다. 저장은 막지만, 어쩌다 들어온 문서가 화면에서
  // 사라지는 것보다 옛 동작으로 도는 편이 안전하다.
  const emptyDays = { id: 'ed', date: '2026-01-05', repeat: 'weekly', days: [] };
  ok(occursOn(emptyDays, '2026-01-12') && !occursOn(emptyDays, '2026-01-13'),
    'an empty days array falls back to the start weekday instead of disappearing');

  // ★ 옛 항목(days 없음)과, 편집 시트가 days 를 채워 저장한 뒤의 같은 항목이
  //   모든 날짜에서 한 칸도 다르지 않아야 한다. 이게 깨지면 기존 반복 할 일이
  //   편집 한 번에 다른 날로 옮겨간다.
  const migrated = Object.assign({}, w, { days: defaultDays(w.date) });
  let sameAsOld = true;
  for (let i = -3; i < 40; i++) {
    const d = addDays('2026-01-05', i);
    if (occursOn(w, d) !== occursOn(migrated, d)) sameAsOld = false;
  }
  ok(sameAsOld, 'filling days in from the start weekday changes no occurrence, on any date');

  // --- 시작·종료 시간 (endTime) ---
  // ★ 제일 중요한 것은 첫 세 줄이다: endTime 키가 아예 없는 옛 항목의 표시가
  //   한 글자도 변하면 안 된다. 변하면 기존 사용자의 화면과 내보낸 이미지가
  //   조용히 전부 달라진다.
  const e0 = { id: 'e0', title: '회의', date: '2026-01-05', repeat: 'none', time: '07:00', pri: 'none' };
  const e1 = Object.assign({}, e0, { id: 'e1', endTime: '08:00' });
  ok(timeRange('07:00', '') === timeLabel('07:00'), 'an empty end time renders exactly like the old start-only label');
  ok(pill(e0, '2026-01-05').range === timeLabel('07:00') &&
     pill(e0, '2026-01-05').timeLabel === timeLabel('07:00'),
    'an item with no endTime key is unchanged in both grid labels');
  ok(exRow(e0, '2026-01-05', false).time === timeLabel('07:00'),
    'and unchanged in the exported image');
  ok(timeRange('07:00', '08:00') === timeLabel('07:00') + ' – ' + timeLabel('08:00'),
    'a range is the two labels joined by an en dash');
  ok(pill(e1, '2026-01-05').range === timeRange('07:00', '08:00') &&
     exRow(e1, '2026-01-05', false).time === timeRange('07:00', '08:00'),
    'an item with an end time shows the range everywhere it is drawn wide');
  // 주간 격자만 시작 시간을 유지한다 — 51px 칸에서 범위는 3~4줄로 접힌다.
  ok(pill(e1, '2026-01-05').timeLabel === timeLabel('07:00'),
    'the narrow week grid keeps the start-only label');
  ok(pill({ id: 'a', date: '2026-01-05', repeat: 'none', time: '', pri: 'none' }, '2026-01-05').range
     === t('item.allDay'), 'an all-day item has no time at either end');

  // ★ 자정 넘김 금지.
  ok(endOk({ hasTime: true, time: '07:00', end: '08:00' }), 'an end after the start is accepted');
  ok(!endOk({ hasTime: true, time: '23:00', end: '01:00' }), 'a range that crosses midnight is refused');
  ok(!endOk({ hasTime: true, time: '07:00', end: '07:00' }), 'an end equal to the start is refused');
  ok(endOk({ hasTime: true, time: '07:00', end: '' }), 'leaving the end empty is always allowed');
  ok(endOk({ hasTime: false, time: '23:00', end: '01:00' }), 'an all-day item ignores both times');

  // 하루 종일로 바꾸면 시작·종료가 함께 비워진다.
  const cleared = formTimes({ hasTime: false, time: '07:00', end: '08:00' });
  ok(cleared.time === '' && cleared.endTime === '', 'switching to all-day clears the start and the end together');
  ok(formTimes({ hasTime: true, time: '07:00', end: '' }).endTime === '',
    'a missing end is stored as an empty string, never undefined');
  ok(formTimes({ hasTime: true, time: '07:00', end: '08:00' }).endTime === '08:00',
    'the end time is stored as the plain HH:MM string it came in as');

  // 정렬은 endTime 을 안 본다 — 시작이 같으면 넣은 순서를 지킨다 (안정 정렬).
  const q1 = { id: 'q1', date: '2026-01-05', repeat: 'none', time: '09:00', endTime: '23:00', pri: 'none' };
  const q2 = { id: 'q2', date: '2026-01-05', repeat: 'none', time: '09:00', pri: 'none' };
  ok(sortItems([q1, q2]).map((x) => x.id).join() === 'q1,q2' &&
     sortItems([q2, q1]).map((x) => x.id).join() === 'q2,q1',
    'endTime never reorders items that start at the same time');

  // ko/en 양쪽 형식. 문자열을 통째로 박아 두지 않는다 — Intl 이 AM/PM 앞에 좁은
  // 공백(U+202F)을 넣는 브라우저가 있어서, 구조만 본다.
  const lk = SETTINGS.lang;
  setSettings({ lang: 'ko' });
  const koR = timeRange('07:00', '08:00');
  setSettings({ lang: 'en' });
  const enR = timeRange('07:00', '08:00');
  ok(koR.indexOf(' – ') > 0 && enR.indexOf(' – ') > 0, 'both languages use the same separator');
  ok(koR !== enR && koR.indexOf('오전') === 0 && enR.indexOf('AM') > 0,
    'the range is localised on both sides, not just the first');
  ok(timeRange('07:00', '') === timeLabel('07:00'), 'a start-only label stays start-only in English too');
  setSettings({ lang: lk });

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
  // days 판정도 언어를 안 탄다 — 위 한국어 구간에서 단언한 것과 같은 값이어야 한다.
  ok(occursOn(wd, '2026-01-07') && !occursOn(wd, '2026-01-08'),
    'occursOn with days gives the same answer in English');
  // 라벨은 반대로 반드시 언어를 타야 한다. 숫자 days → 이름은 dow() 만 지난다.
  ok(repLabel('weekly', [1, 3, 5]) === 'Every Mon, Wed, Fri', 'the weekday label is translated');
  ok(repLabel('weekly', [3]) === 'Every Wednesday', 'a single weekday uses the long English name');
  ok(repLabel('weekly', [0, 1, 2, 3, 4, 5, 6]) === 'Weekly (all days)' && repLabel('daily') === 'Daily',
    'all seven weekdays get their own label, distinct from Daily');

  setSettings({ lang: 'ko' });
  ok(repLabel('weekly') === '매주' && repLabel('weekly', []) === '매주',
    'an old weekly item with no days still shows the plain label');
  ok(repLabel('weekly', [1, 3, 5]) === '매주 월·수·금', 'the label lists the selected weekdays');
  ok(repLabel('weekly', [3]) === '매주 수요일', 'a single weekday gets the long name');
  ok(repLabel('weekly', [0, 1, 2, 3, 4, 5, 6]) === '매주 (매일)' && repLabel('daily') === '매일',
    'seven weekdays read as 매주 (매일), which is not 매일');
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

  // --- [캘린더 포함] 토글 ---
  // 격자를 빼면 그 높이가 통째로 빠지고 제목(150)·꼬리말(64)만 남는다.
  const gOn = exportModel('month', busy, '2026-07-26', 2026, 6, true, true, true);
  const gOff = exportModel('month', busy, '2026-07-26', 2026, 6, true, true, false);
  const gridOnly = exportModel('month', busy, '2026-07-26', 2026, 6, true, false, true);
  ok(gridOnly.layout.h === 1150, 'grid on + detail off is the unchanged 1150 baseline');
  ok(gOn.layout.h === on.layout.h, 'grid on + detail on matches what it was before the toggle existed');
  ok(gOff.layout.h === gOn.layout.h - 936, 'dropping the grid removes exactly its 936px (56 + 176x5)');
  ok(gOff.layout.gridH === 0 && gOff.layout.grid === false, 'the grid contributes no height when off');
  ok(exMonthLayout(2026, 6).h === 1150, 'omitting the flag keeps the grid — old call sites still mean what they meant');
  ok(exMonthLayout(2026, 6, 0).gridH === 0, 'any falsy value turns the grid off, not just a literal false');
  ok(gOff.layout.detail.shown === 28, 'the detail list survives with the grid off');
  ok(gOff.title === gOn.title && gOff.sub === gOn.sub,
    'the heading stays so the image still says which month it is');
  // 주간도 같은 규칙 — 격자 높이만 빠진다.
  const wOn = exportModel('week', busy, '2026-07-26', 2026, 6, true, true, true);
  const wOff = exportModel('week', busy, '2026-07-26', 2026, 6, true, true, false);
  ok(wOn.layout.h - wOff.layout.h === wOn.layout.gridH, 'the week loses exactly its grid height');
  ok(wOff.layout.h > 214, 'the week keeps its heading, footer and detail list');

  // ★ 마지막 남은 하나는 끌 수 없다. 양방향 대칭이어야 한다.
  ok(expCanToggle({ grid: true, detail: true }, 'grid'), 'either can be turned off while both are on');
  ok(expCanToggle({ grid: true, detail: true }, 'detail'), 'symmetric for the other one');
  ok(!expCanToggle({ grid: true, detail: false }, 'grid'), 'the last remaining one cannot be turned off');
  ok(!expCanToggle({ grid: false, detail: true }, 'detail'), 'and the same the other way round');
  ok(expCanToggle({ grid: false, detail: true }, 'grid'), 'an already-off toggle can always be turned back on');
  ok(expCanToggle({ grid: true, detail: false }, 'detail'), 'symmetric for turning the other back on');
  // ★ memo 는 내용이 아니라 개인정보 장치다. 무엇이 꺼져 있든 항상 끌 수 있어야 한다.
  ok(expCanToggle({ grid: false, detail: true, memo: true }, 'memo'),
    'the note switch never locks just because the calendar is off');
  ok(expCanToggle({ grid: true, detail: false, memo: true }, 'memo'),
    'nor because the detail list is off');

  // --- 점프 팝오버: 임시 선택 ---
  // ★ 탭은 임시 선택만 옮긴다. [이동] 을 누르기 전에는 달력이 안 움직인다.
  const kv = { view: state.view, cy: state.cy, cm: state.cm, selected: state.selected, jump: state.jump };
  state.view = 'month'; state.cy = 2026; state.cm = 6; state.selected = '2026-07-26';

  openJump();
  ok(state.jump.y === 2026 && state.jump.m === 6, 'the picker opens on the month currently shown');
  ok(state.jump.sy === null && state.jump.sm === null, 'scroll offsets start unset so the first render centres them');
  state.jump.y = 2030; state.jump.m = 11;      // 탭 두 번과 같다
  ok(state.cy === 2026 && state.cm === 6 && state.selected === '2026-07-26',
    'staging a year and month does not move the calendar');
  closeJump();
  ok(state.jump === null && state.cy === 2026 && state.cm === 6 && state.selected === '2026-07-26',
    'cancelling the picker throws the staged selection away');

  openJump();
  state.jump.y = 2030; state.jump.m = 11;
  applyJump();
  ok(state.cy === 2030 && state.cm === 11 && state.selected === '2030-12-01' && state.jump === null,
    'Go commits all three at once and closes the picker');

  // 일간은 같은 '일' 을 유지하고 없으면 말일로 내려앉는다.
  state.view = 'day'; state.cy = 2026; state.cm = 0; state.selected = '2026-01-31';
  openJump(); state.jump.y = 2026; state.jump.m = 1; applyJump();
  ok(state.selected === '2026-02-28', 'day view clamps Jan 31 to the last day of February');
  state.cy = 2028; state.cm = 0; state.selected = '2028-01-31';
  openJump(); state.jump.y = 2028; state.jump.m = 1; applyJump();
  ok(state.selected === '2028-02-29', 'a leap year keeps the 29th');

  // 스크롤 오프셋: 선택 항목이 5칸 중 3번째에 온다. 맨 위 두 개는 0 으로 눌린다.
  ok(jumpOffset(0) === 0 && jumpOffset(2) === 0, 'the first entries do not scroll past the top');
  ok(jumpOffset(10) === 8 * J_ITEM, 'a mid-list entry is scrolled to the third visible slot');
  ok(jumpOffset(jumpYears(2026, 2026).indexOf(2026)) === 8 * J_ITEM,
    'opening on the current year does not leave the list sitting at 2016');

  Object.assign(state, kv);   // 검사 때문에 달력이 옮겨진 채 끝나지 않게 되돌린다

  console.log('selftest: all checks passed');
}
