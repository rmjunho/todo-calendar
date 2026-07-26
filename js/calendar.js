'use strict';
// 공용 상수 · 유틸 · 반복 규칙 · 전역 state · 캘린더 렌더링.

// ---------------------------------------------------------------- constants
// 색만 남긴다. 이름은 i18n.js 의 문자열 테이블에서 온다 — 라벨을 여기 두면
// 언어를 바꿔도 우선순위·반복 이름만 한국어로 남는다.
const PRI = {
  high: { c: '#FF3B30' },
  med:  { c: '#FF9500' },
  low:  { c: '#34C759' },
  none: { c: '#8E8E93' }
};
const PRI_ORDER = { high: 0, med: 1, low: 2, none: 3 };
const priLabel = (k) => t('pri.' + k);
// 배열 순서가 곧 반복 메뉴의 순서다.
const REP_KEYS = ['none', 'daily', 'weekly', 'monthly'];
const repLabel = (k) => t('rep.' + k);
const HOUR_START = 6, HOUR_H = 52;
const SHOW_COMPLETED = true;

// SF-Symbols-style glyphs, lifted verbatim from the design system's Icon.jsx
const GLYPHS = {
  'checkmark': '<path d="M5 12.5l4.2 4.3L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  'xmark': '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  'plus': '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  'chevron.left': '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  'chevron.right': '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  'chevron.up.chevron.down': '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10l4-4 4 4"/><path d="M8 14l4 4 4-4"/></g>'
};
function icon(name, size, color) {
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" role="img" aria-label="' + name +
    '" style="display:inline-block;vertical-align:middle;flex-shrink:0' + (color ? ';color:' + color : '') + '">' +
    (GLYPHS[name] || '') + '</svg>';
}

// ---------------------------------------------------------------- utilities
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };

// timeLabel() 은 i18n.js 로 옮겼다 — 오전/오후는 로케일 문자열이라
// Intl.DateTimeFormat 이 준다. 여기 남은 fmt/parse 는 데이터 키 전용이다.

// ------------------------------------------------------------- recurrence
// ponytail: monthly recurrence matches on day-of-month, so a task on the 31st
// simply skips shorter months. Switch to a clamped "last day of month" rule if
// users report missed occurrences.
function occursOn(it, ds) {
  if (ds < it.date) return false;
  const rep = it.repeat || 'none';
  if (rep === 'none') return it.date === ds;
  if (rep === 'daily') return true;
  const a = parse(it.date), b = parse(ds);
  if (rep === 'weekly') return a.getDay() === b.getDay();
  if (rep === 'monthly') return a.getDate() === b.getDate();
  return false;
}
// Repeating tasks track completion per-date; one-off tasks use a single flag.
function isDone(it, ds) {
  return (it.repeat && it.repeat !== 'none') ? (it.doneDates || []).includes(ds) : !!it.done;
}
function sortItems(list) {
  return list.slice().sort((x, y) => {
    const tx = x.time || '', ty = y.time || '';
    if (tx === ty) return (PRI_ORDER[x.pri] ?? 3) - (PRI_ORDER[y.pri] ?? 3);
    if (!tx) return -1;
    if (!ty) return 1;
    return tx < ty ? -1 : 1;
  });
}
function itemsOn(items, ds, showCompleted) {
  return sortItems(items.filter((it) => occursOn(it, ds) && (showCompleted || !isDone(it, ds))));
}

// ---------------------------------------------------------------- state
const now0 = new Date();
const state = {
  view: 'month',
  cy: now0.getFullYear(),
  cm: now0.getMonth(),
  selected: fmt(now0),
  items: [],
  showForm: false,
  editingId: null,
  form: null,
  repeatOpen: false,
  // Firestore 읽기는 전부 비동기다 — 여기서 계정을 동기로 채울 수 없다.
  // firebase.js(모듈)가 인증 상태를 알려줄 때까지 booting 화면을 보여준다.
  users: [],          // 관리자로 로그인했을 때만 채워지는 users 컬렉션 스냅샷
  user: null,
  auth: blankAuth(),
  booting: true,
  showAdmin: false,
  legal: null,        // null | 'terms' | 'privacy' — 회원가입 화면의 약관 전문 모달
  showSettings: false,
  del: null,          // 탈퇴 확인 { pin, error, busy }. null 이면 확인 단계 전
  exp: null,          // 이미지 미리보기 { memo, detail, busy, url, file, canShare, err }
  jump: null          // 년·월 점프 { y } — y 는 고른 년, 월을 누르면 확정된다
};

// 시트가 열려 있으면 원격 스냅샷 렌더를 미룬다 — render() 가 #app 을 통째로
// 갈아엎어서 시트가 튀기 때문이다. 미리보기·점프 시트도 같은 보호가 필요하다.
// 미룬 변경은 closeForm()/closeExport()/closeJump() 의 render() 가 반영한다.
const sheetBusy = () => state.showForm || !!state.exp || !!state.jump;

// ---------------------------------------------------------------- 년·월 점프
// ★ 아래 셋은 순수 함수다 (?selftest 가 검증한다). Intl 을 안 쓴다 — 피커에
//   보이는 년·월 **이름**만 표시용이고, 돌려주는 값은 숫자와 fmt() 문자열이다.

// 같은 '일' 을 유지하되 그 달에 없으면 말일로 맞춘다 (1/31 → 2월 = 2/28).
// Date 는 계산에만 쓰고 저장하지 않는다 — 나가는 값은 fmt() 문자열이다.
function clampDay(y, m, d) {
  const last = new Date(y, m + 1, 0).getDate();
  return fmt(new Date(y, m, Math.min(d, last)));
}

// 오늘 기준 앞뒤 10년(21개). 지금 보고 있는 해가 그 밖이면 합쳐 넣는다 —
// 안 그러면 목록에 정작 자기가 있는 해가 없다.
function jumpYears(nowY, curY) {
  const out = [];
  for (let y = nowY - 10; y <= nowY + 10; y++) out.push(y);
  if (out.indexOf(curY) < 0) out.push(curY);
  return out.sort((a, b) => a - b);
}

// ★ `<` `>` 는 축이 갈린다 — 월간은 cy/cm 만, 주·일간은 selected 만 바꾼다.
//   점프는 "특정 날짜로 간다" 는 조작이라 셋을 함께 쓰는 [data-day]·[today]
//   계열을 따른다. 안 그러면 다른 달로 옮긴 뒤 하단 리스트가 이전 달을 가리킨다.
function jumpTo(view, y, m, selected) {
  return {
    cy: y, cm: m,
    selected: view === 'day' ? clampDay(y, m, parse(selected).getDate()) : fmt(new Date(y, m, 1))
  };
}

// ---------------------------------------------------------------- view model
function pill(it, ds) {
  const c = (PRI[it.pri] || PRI.none).c;
  const done = isDone(it, ds);
  return {
    id: it.id, title: it.title, color: c,
    bg: 'color-mix(in srgb, ' + c + ' 16%, transparent)',
    deco: done ? 'line-through' : 'none',
    op: done ? 0.5 : 1,
    timeLabel: it.time ? timeLabel(it.time) : t('item.allDay')
  };
}
// data-open carries the id + the date the row was rendered for, so editing a
// repeating task opens it on the occurrence the user actually tapped.
const openAttr = (p, ds) => 'data-open="' + esc(p.id) + '" data-ds="' + ds + '"';

// ---------------------------------------------------------------- render
function render() {
  const today = fmt(new Date());
  const sel = state.selected;
  const selD = parse(sel);
  const todayD = new Date();
  const items = state.items;

  // 저장된 설정이 이긴다. 'system' 일 때만 OS 설정을 따라간다 (i18n.js).
  applyTheme();

  // 인증 상태를 확인하기 전에 로그인 화면을 그리면 새로고침마다 한 번 번쩍인다.
  if (state.booting) {
    document.getElementById('app').innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'font-size:15px;font-weight:600;color:var(--label-secondary)">' + esc(t('app.loading')) + '</div>';
    return;
  }
  // 약관 모달은 로그인 화면 위에만 뜬다 — 여기서 return 하므로 아래 본문 렌더까지
  // 내려가지 않는다. 그래서 renderAuth() 뒤에 바로 이어 붙인다.
  if (!state.user) {
    document.getElementById('app').innerHTML = renderAuth() + (state.legal ? renderLegalSheet() : '');
    return;
  }

  // -- header ---------------------------------------------------------------
  // 월·요일 이름은 Intl 이 만든다. 여기 들어오는 값은 전부 화면용이다.
  const monthLabel = state.view === 'month'
    ? monthTitle(state.cy, state.cm)
    : monthTitle(selD.getFullYear(), selD.getMonth());
  const todayLabel = t('hdr.today', shortDay(todayD));

  const segments = ['month', 'week', 'day'].map((k) => {
    const on = state.view === k;
    return '<button class="seg' + (on ? ' seg-on' : '') + '" data-view="' + k + '">' +
      esc(t('view.' + k)) + '</button>';
  }).join('');

  const isAdmin = state.user.role === 'admin';
  const pending = pendingUsers().length;
  const accountBar = '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:14px">' +
    '<span style="font-size:13px;font-weight:600;color:var(--label-secondary);background:var(--fill-quaternary);' +
      'padding:6px 12px;border-radius:999px">' + esc(state.user.name) +
      (isAdmin ? ' · ' + esc(t('hdr.admin')) : '') + '</span>' +
    (isAdmin ? '<button class="btn btn-gray btn-sm" data-act="admin">' + esc(t('hdr.signups')) +
      (pending ? '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;' +
        'padding:0 5px;margin-left:2px;border-radius:999px;background:#FF3B30;color:#fff;font-size:11px;font-weight:700">' +
        pending + '</span>' : '') + '</button>' : '') +
    '<button class="btn btn-gray btn-sm" data-act="settings">' + esc(t('hdr.settings')) + '</button>' +
    '<button class="btn btn-gray btn-sm" data-act="logout">' + esc(t('hdr.logout')) + '</button></div>';

  let html = '<div style="max-width:1024px;margin:0 auto;padding:28px 16px 130px">' + accountBar +
    '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px">' +
      // 제목을 누르면 년·월 점프 시트가 열린다. < > 로 한 칸씩 걸어가지 않아도 된다.
      '<button data-act="jump" aria-label="' + esc(t('jump.title')) + '" style="border:none;padding:0;' +
        'margin:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;display:block">' +
        '<div style="font-size:13px;font-weight:600;color:var(--tint)">' + esc(todayLabel) + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<h1 style="margin:2px 0 0;font-size:30px;font-weight:700;letter-spacing:.2px">' + esc(monthLabel) + '</h1>' +
          icon('chevron.up.chevron.down', 17, 'var(--label-tertiary)') +
        '</div>' +
      '</button>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<div class="seg-wrap">' + segments + '</div>' +
        '<div data-raise="glass" style="display:flex;gap:8px;align-items:center">' +
          '<button class="btn btn-glass btn-sm btn-icon" data-nav="prev" aria-label="' + esc(t('nav.prev')) + '">' + icon('chevron.left', 15) + '</button>' +
          '<button class="btn btn-glass btn-sm" data-nav="today">' + esc(t('nav.today')) + '</button>' +
          '<button class="btn btn-glass btn-sm btn-icon" data-nav="next" aria-label="' + esc(t('nav.next')) + '">' + icon('chevron.right', 15) + '</button>' +
          // 현재 뷰(월/주/일)를 그대로 이미지로 내보낸다. 버튼 하나가 세 뷰를 다 맡는다.
          '<button class="btn btn-glass btn-sm" data-act="export" aria-label="' + esc(t('exp.title')) + '">' +
            esc(t('exp.btn')) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // -- month view -----------------------------------------------------------
  if (state.view === 'month') {
    const heads = dow().map((l, i) =>
      '<div style="text-align:center;padding:11px 0 9px;font-size:12px;font-weight:600;color:' +
      (i === 0 ? '#FF3B30' : i === 6 ? 'var(--tint)' : 'var(--label-secondary)') + '">' + l + '</div>').join('');

    const startOffset = new Date(state.cy, state.cm, 1).getDay();
    const dim = new Date(state.cy, state.cm + 1, 0).getDate();
    const weeks = Math.ceil((startOffset + dim) / 7);
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(state.cy, state.cm, 1 - startOffset + i);
      const ds = fmt(d);
      const inM = d.getMonth() === state.cm;
      const isToday = ds === today, isSel = ds === sel;
      const list = itemsOn(items, ds, SHOW_COMPLETED);
      const pills = list.slice(0, 3).map((it) => {
        const p = pill(it, ds);
        return '<div class="pill" ' + openAttr(p, ds) + ' style="cursor:pointer;background:' + p.bg + ';color:' + p.color +
          ';text-decoration:' + p.deco + ';opacity:' + p.op + '">' + esc(p.title) + '</div>';
      }).join('');
      const more = list.length > 3
        ? '<div style="font-size:10px;color:var(--label-tertiary);padding:0 6px">' +
          esc(t('cell.more', list.length - 3)) + '</div>' : '';
      cells += '<div class="cell" data-day="' + ds + '" style="background:' +
        (isSel ? 'color-mix(in srgb, var(--tint) 7%, transparent)' : 'transparent') + ';opacity:' + (inM ? 1 : 0.35) + '">' +
        '<div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
          'font-size:13px;margin:0 auto 4px;font-weight:' + (isToday || isSel ? 700 : 500) +
          ';background:' + (isToday ? 'var(--tint)' : 'transparent') +
          ';color:' + (isToday ? '#fff' : d.getDay() === 0 ? '#FF3B30' : d.getDay() === 6 ? 'var(--tint)' : 'var(--label)') + '">' +
          d.getDate() + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:2px">' + pills + more + '</div></div>';
    }
    html += '<div class="card" style="border:.5px solid var(--separator);overflow:hidden">' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr)">' + heads + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr)">' + cells + '</div></div>';
  }

  // -- week view ------------------------------------------------------------
  if (state.view === 'week') {
    // 주 시작은 일요일 고정이다. Intl 은 이름만 주고 배열 순서는 getDay() 색인.
    const wdow = dow();
    const ws = addDays(sel, -selD.getDay());
    let cols = '';
    for (let i = 0; i < 7; i++) {
      const ds = addDays(ws, i);
      const d = parse(ds);
      const isToday = ds === today, isSel = ds === sel;
      const list = itemsOn(items, ds, SHOW_COMPLETED).map((it) => {
        const p = pill(it, ds);
        return '<div ' + openAttr(p, ds) + ' style="cursor:pointer;padding:4px 7px;border-radius:6px;background:' +
          p.bg + ';opacity:' + p.op + '">' +
          '<div class="trunc" style="font-size:11px;font-weight:600;color:' + p.color + ';text-decoration:' + p.deco + '">' +
          esc(p.title) + '</div>' +
          '<div style="font-size:10px;font-weight:500;color:' + p.color + ';opacity:.75">' + esc(p.timeLabel) + '</div></div>';
      }).join('');
      cols += '<div style="min-height:320px;border-left:' + (i === 0 ? 'none' : '.5px solid var(--separator)') + '">' +
        '<div data-day="' + ds + '" style="cursor:pointer;text-align:center;padding:10px 4px 8px;border-bottom:.5px solid var(--separator)">' +
          '<div style="font-size:11px;font-weight:600;color:' +
            (i === 0 ? '#FF3B30' : i === 6 ? 'var(--tint)' : 'var(--label-secondary)') + '">' + esc(wdow[i]) + '</div>' +
          '<div style="width:28px;height:28px;margin:4px auto 0;border-radius:50%;display:flex;align-items:center;' +
            'justify-content:center;font-size:15px;font-weight:600;background:' +
            (isToday ? 'var(--tint)' : isSel ? 'var(--fill-tertiary)' : 'transparent') +
            ';color:' + (isToday ? '#fff' : 'var(--label)') + '">' + d.getDate() + '</div></div>' +
        '<div style="padding:6px 5px;display:flex;flex-direction:column;gap:4px">' + list + '</div></div>';
    }
    html += '<div class="card" style="border:.5px solid var(--separator);' +
      'overflow:hidden;display:grid;grid-template-columns:repeat(7,1fr)">' + cols + '</div>';
  }

  // -- day view -------------------------------------------------------------
  if (state.view === 'day') {
    const dayList = itemsOn(items, sel, SHOW_COMPLETED);
    const allDay = dayList.filter((it) => !it.time).map((it) => {
      const p = pill(it, sel);
      return '<div ' + openAttr(p, sel) + ' style="cursor:pointer;font-size:12px;font-weight:600;padding:5px 11px;' +
        'border-radius:999px;background:' + p.bg + ';color:' + p.color + ';text-decoration:' + p.deco +
        ';opacity:' + p.op + '">' + esc(p.title) + '</div>';
    }).join('');
    const allDayBlock = allDay
      ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + allDay + '</div>' : '';

    let hours = '';
    for (let h = HOUR_START; h < 24; h++) {
      hours += '<div style="display:flex;height:' + HOUR_H + 'px;gap:8px;align-items:flex-start">' +
        '<div style="width:42px;text-align:right;font-size:11px;color:var(--label-tertiary);transform:translateY(-6px)">' +
        pad(h) + ':00</div><div style="flex:1;border-top:.5px solid var(--separator)"></div></div>';
    }

    const n = new Date();
    let nowLine = '';
    if (sel === today && n.getHours() >= HOUR_START) {
      const top = (n.getHours() * 60 + n.getMinutes() - HOUR_START * 60) / 60 * HOUR_H;
      nowLine = '<div style="position:absolute;left:52px;right:0;height:2px;border-radius:1px;background:#FF3B30;z-index:2;top:' +
        top + 'px"><div style="position:absolute;left:-5px;top:-3px;width:8px;height:8px;border-radius:50%;background:#FF3B30"></div></div>';
    }

    const timed = dayList.filter((it) => it.time).map((it) => {
      const p = pill(it, sel);
      const hm = it.time.split(':').map(Number);
      const top = Math.max(0, (hm[0] * 60 + hm[1] - HOUR_START * 60) / 60 * HOUR_H);
      return '<div ' + openAttr(p, sel) + ' style="position:absolute;left:58px;right:6px;height:46px;cursor:pointer;' +
        'border-radius:9px;padding:5px 10px;background:' + p.bg + ';border-left:3px solid ' + p.color +
        ';top:' + top + 'px;opacity:' + p.op + '">' +
        '<div class="trunc" style="font-size:13px;font-weight:600;color:' + p.color + ';text-decoration:' + p.deco + '">' +
        esc(p.title) + '</div>' +
        '<div style="font-size:11px;color:' + p.color + ';opacity:.75">' + esc(p.timeLabel) + '</div></div>';
    }).join('');

    html += '<div class="card" style="border:.5px solid var(--separator);padding:16px 16px 20px">' + allDayBlock +
      '<div style="position:relative">' + hours + nowLine + timed + '</div></div>';
  }

  // -- selected day list ----------------------------------------------------
  const selAll = itemsOn(items, sel, true);
  const selShown = SHOW_COMPLETED ? selAll : selAll.filter((it) => !isDone(it, sel));
  const remaining = selAll.filter((it) => !isDone(it, sel)).length;
  const selectedTitle = (sel === today ? t('list.todayPrefix') : '') + dayTitle(selD);
  const remainLabel = selAll.length === 0 ? '' : remaining === 0 ? t('list.allDone') : t('list.remain', remaining);

  let listHtml;
  if (selShown.length) {
    listHtml = selShown.map((it, idx) => {
      const c = (PRI[it.pri] || PRI.none).c;
      const done = isDone(it, sel);
      const open = 'data-open="' + esc(it.id) + '" data-ds="' + sel + '"';
      return '<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-top:' +
        (idx === 0 ? 'none' : '.5px solid var(--separator)') + '">' +
        '<button data-toggle="' + esc(it.id) + '" aria-label="' + esc(t('list.check')) + '" aria-pressed="' + done + '" ' +
          'style="width:24px;height:24px;border-radius:50%;flex:none;cursor:pointer;padding:0;display:flex;' +
          'align-items:center;justify-content:center;border:2px solid ' + (done ? c : 'var(--label-quaternary)') +
          ';background:' + (done ? c : 'transparent') + ';transition:all .15s ease">' +
          (done ? icon('checkmark', 13, '#ffffff') : '') + '</button>' +
        '<div ' + open + ' style="flex:1;min-width:0;cursor:pointer">' +
          '<div class="row-title" style="text-decoration:' + (done ? 'line-through' : 'none') +
            ';opacity:' + (done ? 0.45 : 1) + '">' + esc(it.title) + '</div>' +
          (it.memo ? '<div class="trunc" style="font-size:13px;color:var(--label-secondary);margin-top:1px">' +
            esc(it.memo) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex:none">' +
          (it.repeat && it.repeat !== 'none'
            ? '<span style="font-size:11px;font-weight:600;color:var(--label-secondary);background:var(--fill-quaternary);' +
              'padding:3px 8px;border-radius:999px">' + esc(repLabel(it.repeat)) + '</span>' : '') +
          (it.time ? '<span style="font-size:13px;font-weight:500;color:var(--label-secondary);' +
            'font-variant-numeric:tabular-nums">' + esc(timeLabel(it.time)) + '</span>' : '') +
          '<span ' + open + ' style="cursor:pointer;color:var(--label-tertiary);display:flex">' +
            icon('chevron.right', 15) + '</span>' +
        '</div></div>';
    }).join('');
  } else {
    listHtml = '<div style="padding:34px 16px;text-align:center">' +
      '<div style="font-size:15px;font-weight:600;color:var(--label-secondary)">' + esc(t('list.empty')) + '</div>' +
      '<div style="font-size:13px;color:var(--label-tertiary);margin-top:3px">' + esc(t('list.emptyHint')) + '</div></div>';
  }

  html += '<div style="margin-top:22px">' +
    '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:0 4px 10px">' +
      '<h2 style="margin:0;font-size:20px;font-weight:700">' + esc(selectedTitle) + '</h2>' +
      '<span style="font-size:13px;font-weight:500;color:var(--label-secondary)">' + esc(remainLabel) + '</span></div>' +
    '<div class="card" style="border-radius:16px;border:.5px solid var(--separator);' +
      'overflow:hidden">' + listHtml + '</div></div>';

  html += '</div>'; // /page

  // -- floating add button --------------------------------------------------
  html += '<div data-raise="tint" style="position:fixed;right:24px;bottom:28px;z-index:60">' +
    '<button class="btn btn-prominent btn-lg btn-icon" data-act="open" aria-label="' + esc(t('item.add')) + '">' +
    icon('plus', 20) + '</button></div>';

  // -- form sheet -----------------------------------------------------------
  if (state.showForm) html += renderSheet();
  if (state.showAdmin && isAdmin) html += renderAdminSheet();
  if (state.showSettings) html += renderSettingsSheet();
  if (state.exp) html += renderExportSheet();
  if (state.jump) html += renderJumpSheet();

  document.getElementById('app').innerHTML = html;
}

// ---------------------------------------------------------------- 점프 시트
// 기존 바텀 시트들과 같은 구조 — background-color:var(--bg) 단색이고 .card 가 아니다.
// 버튼은 기존 .btn 을 그대로 쓴다 (새 CSS 없음).
function openJump() { state.jump = { y: state.cy }; render(); }
function closeJump() {
  state.jump = null;
  render();   // ★ sheetBusy() 로 밀려 있던 원격 스냅샷 변경을 여기서 반영한다
}
function applyJump(m) {
  const j = jumpTo(state.view, state.jump.y, m, state.selected);
  state.cy = j.cy; state.cm = j.cm; state.selected = j.selected;
  state.jump = null;
  render();
}

function renderJumpSheet() {
  const j = state.jump;
  const chip = (on, attr, label) =>
    '<button class="btn ' + (on ? 'btn-prominent' : 'btn-gray') + ' btn-sm" ' + attr +
    ' aria-pressed="' + on + '">' + esc(label) + '</button>';
  const heading = (s) => '<div style="font-size:13px;font-weight:700;color:var(--label-secondary);' +
    'margin:18px 4px 8px;letter-spacing:.2px">' + esc(s) + '</div>';

  const years = jumpYears(new Date().getFullYear(), state.cy).map((y) =>
    chip(y === j.y, 'data-jy="' + y + '"', yearLabel(y))).join('');
  const months = [];
  for (let m = 0; m < 12; m++) {
    months.push(chip(m === state.cm && j.y === state.cy, 'data-jm="' + m + '"', monthShort(m)));
  }

  return '<div data-act="closeJump" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" aria-label="' + esc(t('jump.title')) + '" style="pointer-events:auto;' +
      'width:min(560px,100vw);max-height:88vh;overflow:auto;background-color:var(--bg);' +
      'border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background-color:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(t('jump.title')) + '</h3>' +
        '<button data-act="closeJump" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;' +
          'width:30px;height:30px;border-radius:50%;background-color:var(--fill-tertiary);color:var(--label-secondary);' +
          'display:flex;align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +
      heading(t('jump.year')) +
      '<div style="display:flex;flex-wrap:wrap;gap:7px">' + years + '</div>' +
      heading(t('jump.month')) +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px">' + months.join('') + '</div>' +
    '</div></div>';
}
