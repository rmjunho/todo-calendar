'use strict';
// 공용 상수 · 유틸 · 반복 규칙 · 전역 state · 캘린더 렌더링.

// ---------------------------------------------------------------- constants
const PRI = {
  high: { c: '#FF3B30', label: '높음' },
  med:  { c: '#FF9500', label: '보통' },
  low:  { c: '#34C759', label: '낮음' },
  none: { c: '#8E8E93', label: '없음' }
};
const PRI_ORDER = { high: 0, med: 1, low: 2, none: 3 };
const REP = { none: '반복 안 함', daily: '매일', weekly: '매주', monthly: '매월' };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
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

function timeLabel(t) {
  if (!t) return '';
  const p = t.split(':').map(Number);
  const ap = p[0] < 12 ? '오전' : '오후';
  const hh = p[0] % 12 === 0 ? 12 : p[0] % 12;
  return ap + ' ' + hh + ':' + pad(p[1]);
}

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
  del: null           // 탈퇴 확인 { pin, error, busy }. null 이면 확인 단계 전
};

// ---------------------------------------------------------------- view model
function pill(it, ds) {
  const c = (PRI[it.pri] || PRI.none).c;
  const done = isDone(it, ds);
  return {
    id: it.id, title: it.title, color: c,
    bg: 'color-mix(in srgb, ' + c + ' 16%, transparent)',
    deco: done ? 'line-through' : 'none',
    op: done ? 0.5 : 1,
    timeLabel: it.time ? timeLabel(it.time) : '하루 종일'
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

  document.documentElement.setAttribute('data-theme',
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  // 인증 상태를 확인하기 전에 로그인 화면을 그리면 새로고침마다 한 번 번쩍인다.
  if (state.booting) {
    document.getElementById('app').innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'font-size:15px;font-weight:600;color:var(--label-secondary)">불러오는 중…</div>';
    return;
  }
  // 약관 모달은 로그인 화면 위에만 뜬다 — 여기서 return 하므로 아래 본문 렌더까지
  // 내려가지 않는다. 그래서 renderAuth() 뒤에 바로 이어 붙인다.
  if (!state.user) {
    document.getElementById('app').innerHTML = renderAuth() + (state.legal ? renderLegalSheet() : '');
    return;
  }

  // -- header ---------------------------------------------------------------
  const monthLabel = state.view === 'month'
    ? state.cy + '년 ' + (state.cm + 1) + '월'
    : selD.getFullYear() + '년 ' + (selD.getMonth() + 1) + '월';
  const todayLabel = '오늘 · ' + (todayD.getMonth() + 1) + '월 ' + todayD.getDate() + '일 (' + DOW[todayD.getDay()] + ')';

  const segments = [['month', '월'], ['week', '주'], ['day', '일']].map(([k, label]) => {
    const on = state.view === k;
    return '<button class="seg' + (on ? ' seg-on' : '') + '" data-view="' + k + '">' + label + '</button>';
  }).join('');

  const isAdmin = state.user.role === 'admin';
  const pending = pendingUsers().length;
  const accountBar = '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:14px">' +
    '<span style="font-size:13px;font-weight:600;color:var(--label-secondary);background:var(--fill-quaternary);' +
      'padding:6px 12px;border-radius:999px">' + esc(state.user.name) +
      (isAdmin ? ' · 관리자' : '') + '</span>' +
    (isAdmin ? '<button class="btn btn-gray btn-sm" data-act="admin">회원가입 신청' +
      (pending ? '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;' +
        'padding:0 5px;margin-left:2px;border-radius:999px;background:#FF3B30;color:#fff;font-size:11px;font-weight:700">' +
        pending + '</span>' : '') + '</button>' : '') +
    '<button class="btn btn-gray btn-sm" data-act="settings">설정</button>' +
    '<button class="btn btn-gray btn-sm" data-act="logout">로그아웃</button></div>';

  let html = '<div style="max-width:1024px;margin:0 auto;padding:28px 16px 130px">' + accountBar +
    '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px">' +
      '<div>' +
        '<div style="font-size:13px;font-weight:600;color:var(--tint)">' + esc(todayLabel) + '</div>' +
        '<h1 style="margin:2px 0 0;font-size:30px;font-weight:700;letter-spacing:.2px">' + esc(monthLabel) + '</h1>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<div class="seg-wrap">' + segments + '</div>' +
        '<div data-raise="glass" style="display:flex;gap:8px;align-items:center">' +
          '<button class="btn btn-glass btn-sm btn-icon" data-nav="prev" aria-label="이전">' + icon('chevron.left', 15) + '</button>' +
          '<button class="btn btn-glass btn-sm" data-nav="today">오늘</button>' +
          '<button class="btn btn-glass btn-sm btn-icon" data-nav="next" aria-label="다음">' + icon('chevron.right', 15) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // -- month view -----------------------------------------------------------
  if (state.view === 'month') {
    const heads = DOW.map((l, i) =>
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
        ? '<div style="font-size:10px;color:var(--label-tertiary);padding:0 6px">+' + (list.length - 3) + '개</div>' : '';
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
            (i === 0 ? '#FF3B30' : i === 6 ? 'var(--tint)' : 'var(--label-secondary)') + '">' + DOW[i] + '</div>' +
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
  const selectedTitle = (sel === today ? '오늘 · ' : '') +
    (selD.getMonth() + 1) + '월 ' + selD.getDate() + '일 ' + DOW[selD.getDay()] + '요일';
  const remainLabel = selAll.length === 0 ? '' : remaining === 0 ? '모두 완료!' : remaining + '개 남음';

  let listHtml;
  if (selShown.length) {
    listHtml = selShown.map((it, idx) => {
      const c = (PRI[it.pri] || PRI.none).c;
      const done = isDone(it, sel);
      const open = 'data-open="' + esc(it.id) + '" data-ds="' + sel + '"';
      return '<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-top:' +
        (idx === 0 ? 'none' : '.5px solid var(--separator)') + '">' +
        '<button data-toggle="' + esc(it.id) + '" aria-label="완료 체크" aria-pressed="' + done + '" ' +
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
              'padding:3px 8px;border-radius:999px">' + esc(REP[it.repeat] || '') + '</span>' : '') +
          (it.time ? '<span style="font-size:13px;font-weight:500;color:var(--label-secondary);' +
            'font-variant-numeric:tabular-nums">' + esc(timeLabel(it.time)) + '</span>' : '') +
          '<span ' + open + ' style="cursor:pointer;color:var(--label-tertiary);display:flex">' +
            icon('chevron.right', 15) + '</span>' +
        '</div></div>';
    }).join('');
  } else {
    listHtml = '<div style="padding:34px 16px;text-align:center">' +
      '<div style="font-size:15px;font-weight:600;color:var(--label-secondary)">할 일이 없습니다</div>' +
      '<div style="font-size:13px;color:var(--label-tertiary);margin-top:3px">오른쪽 아래 + 버튼으로 추가해 보세요</div></div>';
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
    '<button class="btn btn-prominent btn-lg btn-icon" data-act="open" aria-label="할 일 추가">' +
    icon('plus', 20) + '</button></div>';

  // -- form sheet -----------------------------------------------------------
  if (state.showForm) html += renderSheet();
  if (state.showAdmin && isAdmin) html += renderAdminSheet();
  if (state.showSettings) html += renderSettingsSheet();

  document.getElementById('app').innerHTML = html;
}
