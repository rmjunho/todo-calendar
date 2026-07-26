'use strict';
// 캘린더 이미지 내보내기 — Canvas 2D 로 직접 그린다. 외부 라이브러리 없음.
//
// 로드 순서: calendar.js 뒤 · todo.js 앞.
//   - 뒤: fmt/parse/addDays/itemsOn/isDone/PRI/state 를 그대로 쓴다.
//   - 앞: todo.js 는 끝에서 render() 로 앱을 띄운다. 그 뒤로 가면 첫 렌더 때
//         renderExportSheet 가 아직 없다.
// import/export 를 붙이지 말 것 — 전역 스코프 공유가 끊긴다.
//
// ★ 화면을 캡처하지 않는다. 출력 전용 고정 폭(1080px) 레이아웃을 따로 그린다.
//   화면은 폰 세로 폭이고 공유 이미지는 남의 메신저 안에서 축소된 채 읽힌다.

// ---------------------------------------------------------------- 색
// ★ getComputedStyle 로 CSS 변수를 읽지 않는다. 이유:
//   1) 캔버스는 파싱 못 하는 fillStyle 을 **예외 없이 무시**한다. 토큰이 언젠가
//      color-mix()/oklch() 로 바뀌면 에러 하나 없이 색만 틀린 이미지가 나간다.
//   2) 어차피 화면에 없는 색이 필요하다 — 화면의 pill 배경은
//      color-mix(… 16%, transparent) 이고, 캔버스는 불투명 카드 위에 rgba 로
//      직접 합성한다. 반투명 라벨도 마찬가지. getComputedStyle 을 써도 이
//      델타 테이블은 남으므로 소스가 둘이 된다.
//   3) 출력물은 화면이 아니다. 축소돼 읽히니 UI 보다 대비가 조금 높아야 맞고,
//      그건 화면 토큰과 **일부러** 달라야 한다.
// 값 출처: _ds/…/tokens/colors.css — 그쪽을 고치면 여기도 같이 고칠 것.
const EX_COLORS = {
  light: {
    page: '#F2F2F7', card: '#FFFFFF',
    label: '#000000', label2: '#6E6E73', label3: '#8E8E93',
    sep: '#D8D8DC', tint: '#007AFF', onTint: '#FFFFFF', sun: '#FF3B30',
    pillA: 0.16, doneA: 0.42
  },
  dark: {
    page: '#000000', card: '#1C1C1E',
    label: '#FFFFFF', label2: '#A0A0A6', label3: '#6E6E73',
    sep: '#38383A', tint: '#0A84FF', onTint: '#FFFFFF', sun: '#FF453A',
    pillA: 0.28, doneA: 0.40
  }
};
// applyTheme() 이 'system' 을 이미 light/dark 로 풀어 data-theme 에 걸어 뒀다 —
// 그 속성을 읽으면 system 분기가 공짜다.
const exColors = () => EX_COLORS[document.documentElement.getAttribute('data-theme')] || EX_COLORS.light;

const EX_FAMILY = '"Pretendard Variable", Pretendard, -apple-system, "Segoe UI", sans-serif';
const exFont = (weight, size) => weight + ' ' + size + 'px ' + EX_FAMILY;

// '#RRGGBB' + alpha → 'rgba(…)'. 캔버스 배경이 이미 불투명하므로 결과도 불투명하다.
function exAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// ---------------------------------------------------------------- 치수
const EX_W = 1080;
const EX_PAD = 30;
const EX_HEAD = 150;          // 제목 블록 (모든 뷰 공통)
const EX_FOOT = 64;           // 워터마크 줄
const EX_GRID = EX_W - EX_PAD * 2;

const M_DOW = 56, M_ROW = 176;                        // 월: 요일 줄 · 주 한 줄
const W_DOW = 96, W_ITEM = 88, W_MIN = 1000, W_MAX = 1700;
// 메모가 있는 행은 항상 2줄 자리를 잡는다. 실제 줄 수는 measureText 로만 알 수
// 있는데(캔버스 필요), 레이아웃 함수는 캔버스 없이 시험 가능해야 하므로 고정한다.
const D_MIN = 700, D_MAX = 1800, D_ROW = 110, D_MEMO = 62, D_MEMO_LINE = 30;

// ---------------------------------------------------------------- 순수 함수
// 아래 다섯은 캔버스를 안 건드린다 — ?selftest 가 검증하는 지점이다.

// 폭에 맞춰 자른다. measure 를 인자로 받으므로 캔버스 없이도 시험할 수 있다.
function exEllipsize(s, maxWidth, measure) {
  if (measure(s) <= maxWidth) return s;
  let out = s;
  while (out && measure(out + '…') > maxWidth) out = out.slice(0, -1);
  return out ? out + '…' : '…';
}

// 한글은 공백이 없어 글자 단위로 끊고, 공백이 있으면(영문) 마지막 공백에서 끊는다.
// 마지막 줄은 남은 글자를 말줄임으로 삼킨다.
function exWrap(text, maxWidth, maxLines, measure) {
  const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!s || maxLines < 1) return [];
  const lines = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (measure(cur + ch) <= maxWidth) { cur += ch; continue; }
    if (!cur) { cur = ch; continue; }              // 한 글자도 안 들어가는 폭 방어
    if (lines.length === maxLines - 1) {
      lines.push(exEllipsize(cur + s.slice(i), maxWidth, measure));
      return lines;
    }
    const sp = cur.lastIndexOf(' ');
    if (sp > 0) { lines.push(cur.slice(0, sp)); cur = cur.slice(sp + 1) + ch; }
    else { lines.push(cur); cur = ch; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// 월 격자. 높이가 데이터가 아니라 달력 자체의 함수라 5주/6주에 따라 변한다.
function exMonthLayout(cy, cm) {
  const offset = new Date(cy, cm, 1).getDay();
  const dim = new Date(cy, cm + 1, 0).getDate();
  const weeks = Math.ceil((offset + dim) / 7);
  return {
    w: EX_W, h: EX_HEAD + M_DOW + weeks * M_ROW + EX_FOOT,
    weeks: weeks, offset: offset, dim: dim,
    cellW: EX_GRID / 7, cellH: M_ROW,
    gridTop: EX_HEAD + M_DOW
  };
}

// 주. 행 수가 달력이 아니라 **데이터**의 함수라 순수 가변은 위험하다 —
// 빈 주는 텅 비고 바쁜 주는 잘린다. 클램프 한 줄로 둘 다 막는다.
function exWeekLayout(maxItems) {
  const want = EX_HEAD + W_DOW + Math.max(0, maxItems) * W_ITEM + 24 + EX_FOOT;
  const h = Math.min(W_MAX, Math.max(W_MIN, want));
  const bodyH = h - EX_HEAD - W_DOW - EX_FOOT;
  return {
    w: EX_W, h: h, bodyTop: EX_HEAD + W_DOW, bodyH: bodyH,
    colW: EX_GRID / 7, fit: Math.max(1, Math.floor((bodyH - 24) / W_ITEM))
  };
}

// 일. 행마다 높이가 다르므로(메모 줄) 높이 배열을 받는다.
function exDayLayout(heights) {
  const cap = D_MAX - EX_HEAD - EX_FOOT - 24;
  let used = 0, shown = 0;
  for (let i = 0; i < heights.length; i++) {
    if (used + heights[i] > cap) break;
    used += heights[i]; shown++;
  }
  const hidden = heights.length - shown;
  if (hidden) used += 44;
  const h = Math.min(D_MAX, Math.max(D_MIN, EX_HEAD + used + 24 + EX_FOOT));
  return { w: EX_W, h: h, bodyTop: EX_HEAD, bodyH: h - EX_HEAD - EX_FOOT, shown: shown, hidden: hidden };
}

// 파일명. ISO 주차(2026-W30)는 쓰지 않는다 — 이 앱의 주는 **일요일 시작**이고
// ISO 는 월요일 시작이라 반드시 어긋난다. 주는 그 주 일요일 날짜로 적는다.
function exportFilename(view, ds, cy, cm) {
  if (view === 'month') return 'todo-calendar-month-' + cy + '-' + pad(cm + 1) + '.png';
  if (view === 'week') return 'todo-calendar-week-' + addDays(ds, -parse(ds).getDay()) + '.png';
  return 'todo-calendar-day-' + ds + '.png';
}

// ★ includeMemo 가 false 면 memo 키를 **아예 만들지 않는다**. 빈 문자열로 두면
//   나중에 누가 `row.memo != null` 로 검사할 때 개인 내용이 새는 길이 열린다.
function exRow(it, ds, includeMemo) {
  const r = {
    title: it.title || '',
    color: (PRI[it.pri] || PRI.none).c,
    time: it.time ? timeLabel(it.time) : t('item.allDay'),
    allDay: !it.time,
    done: isDone(it, ds)
  };
  const memo = (it.memo || '').trim();
  if (includeMemo && memo) r.memo = memo;
  return r;
}

const exRemainLabel = (n) => (n === 0 ? t('list.allDone') : t('list.remain', n));

// 그리기 전에 확정되는 데이터 모델. 캔버스는 이 객체만 보고 그린다.
function exportModel(view, items, sel, cy, cm, includeMemo) {
  const remain = (rows) => rows.filter((r) => !r.done).length;
  if (view === 'month') {
    const L = exMonthLayout(cy, cm);
    const days = [];
    let left = 0;
    for (let i = 0; i < L.weeks * 7; i++) {
      const d = new Date(cy, cm, 1 - L.offset + i);
      const ds = fmt(d);
      const rows = itemsOn(items, ds, SHOW_COMPLETED).map((it) => exRow(it, ds, includeMemo));
      if (d.getMonth() === cm) left += remain(rows);
      days.push({ ds: ds, day: d.getDate(), dow: d.getDay(), inMonth: d.getMonth() === cm, rows: rows });
    }
    return { view: view, layout: L, days: days, title: monthTitle(cy, cm), sub: exRemainLabel(left) };
  }
  if (view === 'week') {
    const ws = addDays(sel, -parse(sel).getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const ds = addDays(ws, i);
      days.push({
        ds: ds, day: parse(ds).getDate(), dow: i,
        rows: itemsOn(items, ds, SHOW_COMPLETED).map((it) => exRow(it, ds, includeMemo))
      });
    }
    const L = exWeekLayout(days.reduce((m, d) => Math.max(m, d.rows.length), 0));
    const start = parse(ws), end = parse(addDays(ws, 6));
    return {
      view: view, layout: L, days: days,
      title: monthTitle(start.getFullYear(), start.getMonth()),
      sub: dateLabel(start) + ' – ' + dateLabel(end)
    };
  }
  // day — 화면의 시간축을 옮기지 않는다. 6시~24시 눈금은 900px 을 먹고 정보는 0이다.
  const rows = itemsOn(items, sel, SHOW_COMPLETED).map((it) => exRow(it, sel, includeMemo));
  const L = exDayLayout(rows.map((r) => D_ROW + (r.memo ? D_MEMO : 0)));
  return { view: view, layout: L, rows: rows, title: dayTitle(parse(sel)), sub: exRemainLabel(remain(rows)) };
}

// ---------------------------------------------------------------- 그리기
function exRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.closePath();
}
function exLine(ctx, x1, y, x2, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x1, y, x2 - x1, 1);
}
// 한 줄 라벨. 잘릴 일이 없는 짧은 문자열 전용.
function exText(ctx, s, x, y, font, color, align) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}
// 폭에 맞춰 한 줄로 자르고, done 이면 취소선까지 긋는다.
function exClip(ctx, s, x, y, maxW, font, color, strike) {
  ctx.font = font;
  const out = exEllipsize(s, maxW, (v) => ctx.measureText(v).width);
  exText(ctx, out, x, y, font, color);
  if (strike) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillRect(x, Math.round(y) - 1, ctx.measureText(out).width, 2);
  }
}

function exHeader(ctx, C, m) {
  exText(ctx, m.title, EX_PAD, 68, exFont(700, 46), C.label);
  exText(ctx, m.sub, EX_PAD, 116, exFont(600, 26), C.label2);
}
function exFooter(ctx, C, h) {
  const y = h - EX_FOOT / 2;
  exText(ctx, t('exp.brand'), EX_PAD, y, exFont(600, 22), C.label3);
  exText(ctx, dateLabel(new Date()), EX_W - EX_PAD, y, exFont(500, 22), C.label3, 'right');
}
// 요일 색은 화면과 같은 규칙 — 일요일 빨강, 토요일 tint, 나머지는 보조 라벨.
const exDowColor = (C, i) => (i === 0 ? C.sun : i === 6 ? C.tint : C.label2);

function exDrawMonth(ctx, C, m) {
  const L = m.layout;
  const today = fmt(new Date());
  exRect(ctx, EX_PAD, EX_HEAD, EX_GRID, M_DOW + L.weeks * M_ROW, 24);
  ctx.fillStyle = C.card;
  ctx.fill();

  const names = dow();
  for (let i = 0; i < 7; i++) {
    exText(ctx, names[i], EX_PAD + L.cellW * (i + 0.5), EX_HEAD + M_DOW / 2,
      exFont(600, 24), exDowColor(C, i), 'center');
  }

  for (let i = 0; i < m.days.length; i++) {
    const d = m.days[i];
    const col = i % 7;
    const x = EX_PAD + col * L.cellW, y = L.gridTop + Math.floor(i / 7) * M_ROW;
    if (col === 0) exLine(ctx, EX_PAD, y, EX_PAD + EX_GRID, C.sep);
    ctx.save();
    if (!d.inMonth) ctx.globalAlpha = 0.35;

    const isToday = d.ds === today;
    const cx = x + L.cellW / 2, cy = y + 30;
    if (isToday) {
      ctx.beginPath();
      ctx.arc(cx, cy, 19, 0, Math.PI * 2);
      ctx.fillStyle = C.tint;
      ctx.fill();
    }
    exText(ctx, String(d.day), cx, cy, exFont(isToday ? 700 : 600, 24),
      isToday ? C.onTint : d.dow === 0 ? C.sun : d.dow === 6 ? C.tint : C.label, 'center');

    const shown = d.rows.slice(0, 3);
    for (let k = 0; k < shown.length; k++) {
      const r = shown[k];
      const py = y + 52 + k * 34;
      exRect(ctx, x + 5, py, L.cellW - 10, 30, 7);
      ctx.fillStyle = exAlpha(r.color, C.pillA);
      ctx.fill();
      ctx.save();
      if (r.done) ctx.globalAlpha *= C.doneA;
      exClip(ctx, r.title, x + 12, py + 15, L.cellW - 24, exFont(600, 19), r.color, r.done);
      ctx.restore();
    }
    if (d.rows.length > 3) {
      exText(ctx, t('cell.more', d.rows.length - 3), x + 12, y + 166, exFont(600, 19), C.label3);
    }
    ctx.restore();
  }
}

function exDrawWeek(ctx, C, m) {
  const L = m.layout;
  const today = fmt(new Date());
  const cardH = L.h - EX_HEAD - EX_FOOT;
  exRect(ctx, EX_PAD, EX_HEAD, EX_GRID, cardH, 24);
  ctx.fillStyle = C.card;
  ctx.fill();

  const names = dow();
  for (let i = 0; i < 7; i++) {
    const d = m.days[i];
    const x = EX_PAD + i * L.colW, cx = x + L.colW / 2;
    if (i > 0) { ctx.fillStyle = C.sep; ctx.fillRect(x, EX_HEAD + 12, 1, cardH - 24); }
    exText(ctx, names[i], cx, EX_HEAD + 30, exFont(600, 22), exDowColor(C, i), 'center');
    const isToday = d.ds === today;
    if (isToday) {
      ctx.beginPath();
      ctx.arc(cx, EX_HEAD + 66, 22, 0, Math.PI * 2);
      ctx.fillStyle = C.tint;
      ctx.fill();
    }
    exText(ctx, String(d.day), cx, EX_HEAD + 66, exFont(700, 28), isToday ? C.onTint : C.label, 'center');

    const shown = d.rows.slice(0, L.fit);
    for (let k = 0; k < shown.length; k++) {
      const r = shown[k];
      const y = L.bodyTop + 12 + k * W_ITEM;
      exRect(ctx, x + 5, y, L.colW - 10, W_ITEM - 8, 9);
      ctx.fillStyle = exAlpha(r.color, C.pillA);
      ctx.fill();
      ctx.save();
      if (r.done) ctx.globalAlpha *= C.doneA;
      exClip(ctx, r.title, x + 13, y + 26, L.colW - 26, exFont(600, 22), r.color, r.done);
      exClip(ctx, r.time, x + 13, y + 56, L.colW - 26, exFont(500, 19), exAlpha(r.color, 0.75));
      ctx.restore();
    }
    if (d.rows.length > L.fit) {
      exText(ctx, t('cell.more', d.rows.length - L.fit), x + 13,
        L.bodyTop + 12 + L.fit * W_ITEM + 14, exFont(600, 19), C.label3);
    }
  }
  exLine(ctx, EX_PAD, L.bodyTop, EX_PAD + EX_GRID, C.sep);
}

function exDrawDay(ctx, C, m) {
  const L = m.layout;
  exRect(ctx, EX_PAD, EX_HEAD, EX_GRID, L.h - EX_HEAD - EX_FOOT, 24);
  ctx.fillStyle = C.card;
  ctx.fill();

  if (!m.rows.length) {
    exText(ctx, t('list.empty'), EX_W / 2, EX_HEAD + L.bodyH / 2, exFont(600, 30), C.label2, 'center');
    return;
  }

  const x = EX_PAD + 26, w = EX_GRID - 52;
  let y = EX_HEAD + 24;
  for (let i = 0; i < L.shown; i++) {
    const r = m.rows[i];
    const rh = D_ROW + (r.memo ? D_MEMO : 0);
    if (i > 0) exLine(ctx, x, y, x + w, C.sep);
    ctx.save();
    if (r.done) ctx.globalAlpha = C.doneA;

    exRect(ctx, x, y + 24, 6, rh - 44, 3);
    ctx.fillStyle = r.color;
    ctx.fill();

    exClip(ctx, r.title, x + 24, y + 44, w - 230, exFont(600, 30), C.label, r.done);
    exText(ctx, r.time, x + w, y + 44, exFont(600, 25), r.allDay ? C.label3 : C.label2, 'right');
    if (r.memo) {
      // 메모만 여러 줄로 흐른다. 한글은 공백이 없어 글자 단위로 끊긴다.
      ctx.font = exFont(500, 24);
      const memoLines = exWrap(r.memo, w - 30, 2, (v) => ctx.measureText(v).width);
      for (let k = 0; k < memoLines.length; k++) {
        exText(ctx, memoLines[k], x + 24, y + 80 + k * D_MEMO_LINE, exFont(500, 24), C.label3);
      }
    }
    ctx.restore();
    y += rh;
  }
  if (L.hidden) exText(ctx, t('cell.more', L.hidden), x + 24, y + 22, exFont(600, 24), C.label3);
}

// 데이터 모델 → 캔버스. 여기서 나가는 것은 canvas 하나뿐이다.
function drawExport(view, items, sel, cy, cm, includeMemo) {
  const C = exColors();
  const m = exportModel(view, items, sel, cy, cm, includeMemo);
  const canvas = document.createElement('canvas');
  canvas.width = m.layout.w;
  canvas.height = m.layout.h;
  const ctx = canvas.getContext('2d');
  // 캔버스는 투명하게 시작한다. 페이지 색으로 한 번 덮어야 이후의 rgba 합성이
  // 전부 불투명한 결과를 낸다 — 그래야 PNG 가 남의 메신저 배경을 타지 않는다.
  ctx.fillStyle = C.page;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  exHeader(ctx, C, m);
  if (view === 'month') exDrawMonth(ctx, C, m);
  else if (view === 'week') exDrawWeek(ctx, C, m);
  else exDrawDay(ctx, C, m);
  exFooter(ctx, C, canvas.height);
  return canvas;
}

// ---------------------------------------------------------------- 흐름
// ★ 2단이다. 시트를 여는 동안 Blob 까지 다 만들고, [공유]/[저장] 은 **새 제스처**로
//   받는다. navigator.share() 는 사용자 제스처 처리 중에만 허용되는데
//   canvas.toBlob() 이 비동기라 클릭→그리기→await→share() 로 짜면 활성화가
//   만료돼 폰에서만 NotAllowedError 로 죽는다(데스크톱 크롬은 빨라서 통과한다).
function openExport() {
  state.exp = { memo: true, busy: true, url: '', file: null, canShare: false, err: '' };
  render();
  buildExport();
}

function toggleExportMemo() {
  const old = state.exp;
  if (!old || old.busy) return;
  if (old.url) URL.revokeObjectURL(old.url);
  // 새 객체로 갈아 끼운다 — 진행 중이던 빌드가 자기 것이 아님을 알아채고 빠진다.
  state.exp = { memo: !old.memo, busy: true, url: '', file: null, canShare: false, err: '' };
  render();
  buildExport();
}

function closeExport() {
  if (state.exp && state.exp.url) URL.revokeObjectURL(state.exp.url);
  state.exp = null;
  // ★ 반드시 render(). sheetBusy() 가드 때문에 미리보기 중에는 원격 스냅샷
  //   렌더가 밀려 있다 — 다른 기기에서 추가한 할 일이 여기서 화면에 들어온다.
  render();
}

async function buildExport() {
  const e = state.exp;
  try {
    // Pretendard 는 CDN 폰트다. 안 기다리면 첫 내보내기만 시스템 폰트로 나간다.
    // 두 번째부터는 이미 resolve 돼 있어 공짜다.
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = drawExport(state.view, state.items, state.selected, state.cy, state.cm, e.memo);
    const blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob returned null'))), 'image/png'));
    if (state.exp !== e) return;      // 그 사이 닫혔거나 토글로 다시 시작했다
    e.file = new File([blob], exportFilename(state.view, state.selected, state.cy, state.cm),
      { type: 'image/png' });
    e.url = URL.createObjectURL(blob);
    // ★ navigator.share 존재 여부로 판단하지 않는다. 실제 File 을 넣어 물어본다.
    //   넘기는 객체에는 files 만 담는다 — title/text/url 을 섞으면 안드로이드에서
    //   false 가 나오는 조합이 있다.
    e.canShare = !!(navigator.canShare && navigator.canShare({ files: [e.file] }));
    e.busy = false;
  } catch (err) {
    if (state.exp !== e) return;
    e.busy = false;
    e.err = t('exp.fail');
    console.warn('export failed', err);
  }
  render();
}

function shareImage() {
  const e = state.exp;
  if (!e || !e.file) return;
  // ★ 이 핸들러 안에서 await 하지 말 것. Blob 은 시트를 열 때 이미 완성돼 있다.
  navigator.share({ files: [e.file] }).catch((err) => {
    if (err && err.name === 'AbortError') return;   // 사용자가 공유 시트를 닫은 것
    e.err = t('exp.shareFail');
    render();
  });
}

function saveImage() {
  const e = state.exp;
  if (!e || !e.url) return;
  const a = document.createElement('a');
  a.href = e.url;
  a.download = e.file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 여기서 revokeObjectURL 하지 않는다 — 같은 URL 을 미리보기 <img> 가 쓰고 있다.
  // closeExport() 와 toggleExportMemo() 가 책임진다.
}

// ---------------------------------------------------------------- 미리보기 시트
// 기존 바텀 시트 4개(입력·설정·회원 관리·약관)와 같은 구조. .card 가 아니라
// background-color:var(--bg) 단색이라 sheen 이 없다.
function renderExportSheet() {
  const e = state.exp;
  const placeholder = (msg) =>
    '<div style="height:220px;display:flex;align-items:center;justify-content:center;font-size:15px;' +
    'font-weight:600;color:var(--label-secondary)">' + esc(msg) + '</div>';
  const preview = e.busy ? placeholder(t('exp.building'))
    : e.url ? '<img src="' + e.url + '" alt="' + esc(t('exp.alt')) + '" style="display:block;width:100%;' +
      'max-height:46vh;object-fit:contain;object-position:top;border-radius:12px">'
    : placeholder(t('exp.fail'));

  return '<div data-act="closeExport" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" aria-label="' + esc(t('exp.title')) + '" style="pointer-events:auto;' +
      'width:min(560px,100vw);max-height:88vh;overflow:auto;background-color:var(--bg);' +
      'border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background-color:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(t('exp.title')) + '</h3>' +
        '<button data-act="closeExport" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;' +
          'width:30px;height:30px;border-radius:50%;background-color:var(--fill-tertiary);color:var(--label-secondary);' +
          'display:flex;align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +

      '<div style="background-color:var(--fill-quaternary);border-radius:14px;padding:8px;overflow:hidden">' +
        preview + '</div>' +

      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:0 4px">' +
        '<div><div style="font-size:15px;font-weight:600">' + esc(t('exp.memo')) + '</div>' +
        '<div style="font-size:12px;line-height:1.5;color:var(--label-tertiary);margin-top:2px">' +
          esc(t('exp.hint')) + '</div></div>' +
        '<button class="sw" role="switch" data-act="expMemo" aria-checked="' + e.memo + '" aria-label="' +
          esc(t('exp.memo')) + '"' + (e.busy ? ' disabled' : '') + '><span></span></button></div>' +

      (e.err ? '<div role="alert" style="margin-top:14px;font-size:13px;font-weight:600;color:#FF3B30;' +
        'background-color:color-mix(in srgb, #FF3B30 12%, transparent);padding:10px 12px;border-radius:10px">' +
        esc(e.err) + '</div>' : '') +

      '<div style="display:flex;gap:10px;margin-top:18px">' +
        '<button class="btn btn-gray btn-md" data-act="closeExport" style="flex:1">' + esc(t('a.close')) + '</button>' +
        '<button class="btn btn-gray btn-md" data-act="expSave" style="flex:1"' + (e.url ? '' : ' disabled') + '>' +
          esc(t('exp.save')) + '</button>' +
        // ★ canShare 가 false 면 버튼 자체를 안 그린다. 저장만 남는다.
        (e.canShare ? '<span data-raise="tint" style="flex:1;display:flex">' +
          '<button class="btn btn-prominent btn-md" data-act="expShare" style="flex:1">' +
          esc(t('exp.share')) + '</button></span>' : '') +
      '</div>' +
    '</div></div>';
}
