'use strict';
// 공용 상수 · 유틸 · 반복 규칙 · 전역 state · 캘린더 렌더링.

// ---------------------------------------------------------------- constants
// 카테고리 색 팔레트. **여기 있는 값만** 저장된다.
//
// ⚠️ 자유 입력을 안 받는 이유는 취향이 아니다. 색은 pill()·일간 블록·폼 칩에서
//    style="background:…색…" 안으로 **esc() 없이** 들어간다 — esc() 는 HTML 이스케이프라
//    속성 안의 CSS 값을 못 막고, 큰따옴표 하나면 속성을 탈출한다. 캔버스 쪽은 더
//    조용하다: fillStyle 은 파싱 못 하는 값을 예외 없이 무시해서 색만 틀린 PNG 가 나간다.
//    집합으로 고정하면 둘 다 원리적으로 사라지고 규칙도 한 줄이다.
// ★ firestore.rules 의 catColor() 목록과 **같은 집합을 유지할 것**(validSettings 와 같은 성격).
// 노랑(#FFCC00)은 뺐다 — 흰 배경 위 글자색으로 쓰기엔 대비가 안 나온다.
const CAT_COLORS = ['#FF3B30', '#FF9500', '#34C759', '#00C7BE', '#30B0C7',
                    '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E'];
// 개수 상한 = 팔레트 크기. 규칙으로는 못 센다(Firestore 규칙에 집계가 없다) —
// 카운터 문서 + 트랜잭션은 개인용 앱에 과하다고 보고 화면에서만 막는다.
const CAT_MAX = CAT_COLORS.length;
const CAT_NAME_MAX = 20;

// 카테고리가 없거나(categoryId === '') **지워진 카테고리**를 가리킬 때의 폴백.
// ★ 카테고리 삭제는 할 일 문서를 건드리지 않는다 — 죽은 id 는 조용히 여기로 떨어진다.
//   days·endTime 이 없는 옛 항목을 다루는 방식과 같다(CONTEXT §3).
const CAT_NONE = { id: '', color: '#8E8E93' };

// 카테고리를 화면에 세우는 순서. ★ 이 함수 **하나**가 유일한 기준이다 — 필터 칩 줄,
// 관리 시트, 입력 시트의 카테고리 칩, 내보내기가 전부 같은 state.cats 배열을 그대로
// 쓰므로 정렬이 두 군데로 갈리면 화면마다 순서가 달라진다. 부르는 곳은 firebase.js
// 의 스냅샷과 todo.js 의 낙관적 업데이트 둘이다.
//
// order 가 없는 문서는 **뒤로** 보내고 이름순을 유지한다. order 를 도입하기 전에
// 만든 카테고리가 그렇다 — 없는 값을 0 으로 치면 옛 카테고리가 전부 맨 앞에
// 몰리면서 순서가 한 번 크게 튄다. 큰 수를 쓰되 Infinity 는 안 된다: Infinity 끼리
// 빼면 NaN 이라 비교가 무너져 정렬이 조용히 뒤죽박죽이 된다.
const CAT_ORDER_LAST = 1e9;
const catOrder = (c) => (typeof c.order === 'number' ? c.order : CAT_ORDER_LAST);
const sortCats = (list) => list.slice().sort((a, b) =>
  catOrder(a) - catOrder(b) || (a.name || '').localeCompare(b.name || ''));

// ★ 여기 있던 onColor(hex) 를 지웠다 — 원색 판 위에 올릴 글자색을 휘도로 골라 주던
//   함수인데, 여러 날 일정이 **색 밑줄 + 잉크 글자**로 바뀌면서(barHtml 참고)
//   "배경색에 맞춰 글자색을 고를" 자리가 아예 없어졌다. 화면·캔버스 양쪽 호출처가
//   같이 사라졌고, 그 함수만 검사하던 selftest 두 개도 함께 뺐다.
//   ⚠️ 카테고리 원색을 **판으로 채우는** 곳을 다시 만들면 흰 글자로 고정하지 말 것 —
//   팔레트의 밝은 쪽(#34C759·#00C7BE·#FF9500)에서 대비가 1.8~2.3:1 로 안 읽힌다.
//   그때는 git 이력에서 되살리거나 그 자리 기준으로 다시 재서 만들 것.
const catOf = (it) =>
  (it && it.categoryId && state.cats.find((c) => c.id === it.categoryId)) || CAT_NONE;
// 이름은 i18n 을 탄다 — '없음' 을 데이터로 들고 있으면 언어를 바꿔도 안 변한다.
const catName = (c) => (c.id ? c.name : t('cat.none'));
// 배열 순서가 곧 반복 메뉴의 순서다.
const REP_KEYS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

// ------------------------------------------------------------- 할 일 / 일정
// 같은 컬렉션(users/{uid}/todos)에 산다. 일정은 **달력에 그려야** 하는데 화면에
// 항목을 꺼내는 통로가 itemsOn() 하나뿐이라, 따로 두면 월·주·일·하단 목록·
// 내보내기 3곳에 두 번째 통로를 파야 한다. 목표(goals)를 따로 뺀 것과 반대 이유다.
//   kind: 'event' 없으면 'todo'  ·  span: 며칠 동안, 없으면 1
// ★ 규칙은 안 건드린다 — todos 는 카테고리·목표와 달리 필드를 잠가 두지 않았다.
const isEvent = (it) => !!it && it.kind === 'event';
// ★ 기간은 **일정만** 갖는다. 여러 날짜리 할 일을 허용하면 "5일짜리의 3일째에
//   체크하면 그 하루만 지워지는" 문제가 생기는데(doneDates 는 날짜를 그대로 담는다),
//   일정에는 완료 체크가 없어서 그 문제가 아예 성립하지 않는다. 그래서 isDone 은
//   한 글자도 안 바뀐다.
const spanOf = (it) => (isEvent(it) ? Math.max(1, Math.round(it.span) || 1) : 1);
// 반복 간격(일). span 이 이보다 길면 회차가 자기 자신과 겹친다 — 저장에서 막는다.
// 'none' 은 반복이 없으니 상한도 없다. monthly 는 제일 짧은 달(28), yearly 는 365.
const REP_GAP = { none: Infinity, daily: 1, weekly: 7, monthly: 28, yearly: 365 };
// 반복 이름. weekly 는 days 를 함께 넘기면 '매주 월·수·금' 이 된다 — days 가
// 없거나 비면 예전처럼 '매주' 하나로 끝난다(옛 항목이 그대로 읽히는 지점).
// 숫자 → 요일 이름 변환은 여기서만 한다. days 는 데이터, dow() 는 표시 전용이다.
function repLabel(k, days) {
  if (k !== 'weekly' || !Array.isArray(days) || !days.length) return t('rep.' + k);
  // 7개 전부면 이름을 다 늘어놓지 않는다 — 배지가 pill 이라 폭이 감당이 안 된다.
  if (days.length === 7) return t('rep.weeklyAll');
  const names = days.length === 1 ? dow('long') : dow();
  return t('rep.weeklyDays', days.map((i) => names[i]));
}
const SHOW_COMPLETED = true;

// 하단 탭 바의 달력 아이콘 넷은 **같은 몸통**(테두리 + 머리줄 + 고리 둘)에 속만 다르다.
// 몸통을 한 번만 적어 두면 넷의 획 굵기·모서리·비율이 어긋날 수가 없다 — 넷이 나란히
// 붙어 있어서 1px 만 달라도 눈에 띈다.
const CAL_BODY =
  '<rect x="3" y="4.5" width="18" height="16.5" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/>' +
  '<path d="M3 9.5h18M8 2.6v3.4M16 2.6v3.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';

// SF-Symbols-style glyphs, lifted verbatim from the design system's Icon.jsx
const GLYPHS = {
  // 년 = 한 해 전체를 가리키는 별. 월/주/일이 '얼마나 넓은 칸이냐'로 갈리는 데 반해
  // 년만 성격이 달라서(목표 전용 화면) 격자가 아니라 표식을 넣는다.
  'calendar.year': CAL_BODY +
    '<path d="M12 11.6l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="currentColor"/>',
  // 월 = 칸이 여럿, 주 = 한 줄, 일 = 한 칸. 채운 넓이가 곧 기간의 넓이다.
  'calendar.month': CAL_BODY +
    '<g fill="currentColor"><rect x="6.2" y="12" width="3" height="2.6" rx="1"/>' +
    '<rect x="10.5" y="12" width="3" height="2.6" rx="1"/><rect x="14.8" y="12" width="3" height="2.6" rx="1"/>' +
    '<rect x="6.2" y="16.2" width="3" height="2.6" rx="1"/><rect x="10.5" y="16.2" width="3" height="2.6" rx="1"/>' +
    '<rect x="14.8" y="16.2" width="3" height="2.6" rx="1"/></g>',
  'calendar.week': CAL_BODY + '<rect x="6.2" y="13.8" width="11.6" height="3.4" rx="1.7" fill="currentColor"/>',
  'calendar.day': CAL_BODY + '<rect x="9.6" y="12.6" width="4.8" height="5.8" rx="1.7" fill="currentColor"/>',
  'checkmark': '<path d="M5 12.5l4.2 4.3L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  'xmark': '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  'plus': '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  'chevron.left': '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  'chevron.right': '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  // 접힌 메모를 펼치는 표시. 접을 때는 아이콘을 하나 더 두지 않고 **돌려서** 쓴다.
  'chevron.down': '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  'chevron.up.chevron.down': '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10l4-4 4 4"/><path d="M8 14l4 4 4-4"/></g>',
  // 순서 손잡이. **누르면 그 자리에서 잡힌다**(줄 본문은 길게 눌러야 잡힌다) —
  // 자세한 건 todo.js 의 pointerdown 위임과 dragPaint 를 볼 것.
  'line.3.horizontal': '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 8h14"/><path d="M5 12h14"/><path d="M5 16h14"/></g>'
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
// b - a 의 일수. 서머타임으로 하루가 23·25시간이 되는 나라에서도 반올림이 흡수한다.
// 날짜가 비었거나 이상하면 NaN 이 나온다 — 부르는 쪽(spanOk)이 그걸로 저장을 막는다.
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

// timeLabel() 은 i18n.js 로 옮겼다 — 오전/오후는 로케일 문자열이라
// Intl.DateTimeFormat 이 준다. 여기 남은 fmt/parse 는 데이터 키 전용이다.

// ------------------------------------------------------------- recurrence
// ponytail: monthly recurrence matches on day-of-month, so a task on the 31st
// simply skips shorter months. Switch to a clamped "last day of month" rule if
// users report missed occurrences.
// 회차가 **시작하는** 날인가. span 을 안 본다 — 기간이 생기기 전의 occursOn 과
// 글자 하나까지 같은 함수이고, span 처리는 아래 occStart 가 이 위에 얹힌다.
function startsOn(it, ds) {
  if (ds < it.date) return false;
  const rep = it.repeat || 'none';
  if (rep === 'none') return it.date === ds;
  if (rep === 'daily') return true;
  const a = parse(it.date), b = parse(ds);
  // days 가 있으면 고른 요일들로, 없으면 시작일의 요일로 — 옛 항목에는 days 가
  // 없다. 이 폴백을 빼면 기존 반복 할 일이 전부 사라진다.
  // 빈 배열도 '없음'과 같이 다룬다: 저장은 막지만, 어쩌다 들어온 문서가 화면에서
  // 사라지는 것보다 옛 동작으로 도는 편이 안전하다.
  if (rep === 'weekly') {
    const days = Array.isArray(it.days) && it.days.length ? it.days : [a.getDay()];
    return days.includes(b.getDay());
  }
  if (rep === 'monthly') return a.getDate() === b.getDate();
  // 매년: 같은 달·같은 날. 2/29 는 윤년에만 뜬다 — monthly 가 31일에 하는 것과 같다.
  if (rep === 'yearly') return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  return false;
}

// 이 날을 덮고 있는 회차의 **시작일**. 없으면 null.
// span 일만큼 거슬러 올라가며 시작일 후보를 본다 — span ≤ 반복 간격(REP_GAP)이라
// 한 날을 덮는 회차는 최대 하나이므로 처음 찾은 것이 답이다.
// ★ 막대를 그릴 때도 이 함수를 쓴다(weekBars). "뜨는가"와 "어느 회차인가"를 한
//   함수로 답하게 해서 둘이 어긋날 자리를 없앴다.
function occStart(it, ds) {
  const n = spanOf(it);
  for (let k = 0; k < n; k++) {
    const s = addDays(ds, -k);
    if (s < it.date) return null;      // s 는 계속 작아진다 — 더 볼 것이 없다
    if (startsOn(it, s)) return s;
  }
  return null;
}
const occursOn = (it, ds) => !!occStart(it, ds);
// Repeating tasks track completion per-date; one-off tasks use a single flag.
// ★ 기간(span)은 여기 안 들어온다 — 기간은 일정만 갖고 일정에는 완료 체크가 없다.
//   그래서 doneDates 가 담는 날짜는 지금도 앞으로도 "체크한 그 날" 하나다.
function isDone(it, ds) {
  return (it.repeat && it.repeat !== 'none') ? (it.doneDates || []).includes(ds) : !!it.done;
}

// ------------------------------------------------------- 월·주 격자의 기간 막대
// 아래 둘은 DOM 을 모른다 — dayRange/dayLayout 과 같은 이유로 ?selftest 가 좌표를
// 직접 단언한다. 화면과 내보내기 캔버스가 **같은 계산**을 나눠 쓰는 자리이기도 하다.

// ws(그 주 일요일) 기준으로 이 일정이 차지하는 칸 구간들. 칸 색인은 0(일)~6(토).
// ★ 배열인 이유: 매주 반복 + 여러 요일이면 한 주에 회차가 둘 이상 들어온다
//   (예: 매주 월·목, 2일짜리 → 월화 / 목금). 하나만 돌려주면 뒤엣것이 사라진다.
// cutL/cutR 은 주 경계에서 잘렸다는 뜻이다 — 그 끝을 흐리게 그려 "계속된다"를 표시한다.
function weekBars(it, ws) {
  const we = addDays(ws, 6);
  const out = [];
  let i = 0;
  while (i < 7) {
    const s = occStart(it, addDays(ws, i));
    if (!s) { i++; continue; }
    const e = addDays(s, spanOf(it) - 1);
    // 칸 색인은 요일이다 — ws 가 일요일 고정이라 getDay() 가 그대로 열 번호가 된다.
    const to = e > we ? 6 : parse(e).getDay();
    out.push({ id: it.id, start: s, end: e,
      from: s < ws ? 0 : parse(s).getDay(), to: to, cutL: s < ws, cutR: e > we });
    i = to + 1;              // 이 회차가 덮은 칸은 건너뛴다
  }
  return out;
}

// 겹치는 막대를 층으로 나눈다. 시작 칸 오름차순(같으면 긴 것 먼저) → 끝난 층 재사용,
// 없으면 새 층. dayLayout 의 열 배정과 같은 탐욕 알고리즘이고, 여기는 1차원이라 더 쉽다.
function laneBars(segs) {
  const rows = segs.slice().sort((x, y) => (x.from - y.from) || (y.to - x.to));
  const ends = [];
  rows.forEach((r) => {
    let c = 0;
    while (c < ends.length && ends[c] >= r.from) c++;   // 그 층이 아직 이 칸을 쓰고 있다
    if (c === ends.length) ends.push(-1);
    ends[c] = r.to;
    r.lane = c;
  });
  return rows;
}

// 막대 층의 치수. 글자는 .pill 과 같아서(10.5px/600) 높이도 알약과 같은 17px 이다.
const BAR_H = 17, BAR_GAP = 2, BAR_ROW = BAR_H + BAR_GAP;
// 막대 층이 시작하는 y 는 **숫자로 안 적는다.** 칸 위쪽(테두리 .5 + 패딩 5 + 날짜 원
// 26 + 여백 4)을 더하면 35.5 지만, 브라우저는 .5px 테두리를 dpr 에 따라 0.5 로도 1 로도
// 잡는다 — dpr 1 에서 실측해 보니 실제 자리는 36 이었다(0.5px 어긋남).
// 그래서 **같은 모양의 빈 칸을 하나 그려서** 첫 줄 높이를 브라우저가 재게 한다.
// 이러면 배율·dpr 이 뭐든 칸의 계산과 막대 층의 계산이 어긋날 수가 없다.
const barSpacer =
  '<div aria-hidden="true" style="grid-column:1/8;grid-row:1;visibility:hidden;' +
    'border-top:.5px solid transparent;padding:5px 0 4px">' +
  // padding-bottom 4 로 준다 — 자식의 margin-bottom 은 부모 밖으로 새어(마진 상쇄)
  // 높이에 안 들어간다. 칸 쪽은 뒤에 형제가 있어서 그 4px 이 그대로 산다.
  '<div style="height:26px"></div></div>';
// 그리는 층의 최대 개수. 넘친 막대는 **버리지 않고** 그 날의 `+N개` 로 넘긴다.
// 상한이 없으면 겹치는 주의 높이가 그대로 늘어난다 — 그걸 막으려고 종류 필터를 만든 것이다.
// 주간이 더 깊은 이유는 그 화면이 한 주만 보여 주는 자리라서다(막대 띠가 칸 위에 따로 있다).
const MONTH_LANES = 3, WEEK_LANES = 6;
// 주간 칸이 접기 전에 보여 주는 항목 수. 근거는 렌더 쪽 주석(실측).
const WEEK_FIT = 7;

// 실제로 그려지는 층 수. shown 이 비면 0 — 그러면 막대 층 자체를 안 그린다.
const lanesOf = (shown) => (shown.length ? Math.max.apply(null, shown.map((r) => r.lane)) + 1 : 0);
// 상한을 넘긴 막대가 요일마다 몇 개인지. 이 값이 그 날의 `+N개` 에 더해진다.
function barOverflow(rows, cap) {
  const extra = [0, 0, 0, 0, 0, 0, 0];
  rows.forEach((r) => {
    if (r.lane >= cap) for (let i = r.from; i <= r.to; i++) extra[i]++;
  });
  return extra;
}

// 막대 하나. 주 경계에서 잘린 쪽은 모서리를 죽이고 여백을 없애 칸 끝까지 붙인다 —
// "여기서 끝난 것이 아니라 이어진다" 를 화살표 없이도 읽히게.
// ★ 하루짜리 일정(barOne)은 **판을 안 깐다 — 색 글자만.** 판은 "여기서 여기까지
//   이어진다" 는 뜻이라 하루짜리에까지 깔면 그 뜻이 흐려진다.
//   기준이 `from === to` 가 아니라 `start === end` 인 이유: 이틀짜리가 주 경계에서
//   잘리면 그 주에서는 한 칸만 차지하지만 **아직 안 끝났으므로** 판이 있어야 한다.
//   (start === end 면 그 회차 전체가 이 주 안에 있으므로 cutL/cutR 은 자동으로 거짓이다.)
const barOne = (b) => b.start === b.end;
function barHtml(b, it) {
  const p = pill(it, b.start);            // 색·취소선은 회차 **시작일** 기준이다
  const one = barOne(b);
  return '<div class="pill" ' + openAttr(p, b.start) +
    ' style="pointer-events:auto;cursor:pointer;align-self:start;line-height:13px;height:' + BAR_H +
    // 1번 줄은 자리 맞추기용이라(barSpacer) 층은 2번 줄부터다.
'px;grid-column:' + (b.from + 1) + '/' + (b.to + 2) + ';grid-row:' + (b.lane + 2) +
    ';margin-left:' + (b.cutL ? 0 : 3) + 'px;margin-right:' + (b.cutR ? 0 : 3) + 'px' +
    // ★ 여러 날 일정은 **색 밑줄 + 잉크 글자**다(사용자 요청). 예전에는 원색 판에
    //   onColor() 가 고른 글자색이었다. 할 일 알약(같은 색 16% 틴트)과는 이제
    //   '밑줄이냐 판이냐' 로 갈린다. 하루짜리는 그대로 **색 점** + 색 글자다.
    // ★ 밑줄을 border-bottom 이 **아니라** inset box-shadow 로 긋는다.
    //   box-sizing:border-box 라 테두리는 height:17px 안에서 글자 자리를 3px
    //   빼앗아 line-height:13px 이 잘린다(.pill 은 overflow:hidden 이다).
    //   box-shadow 는 레이아웃을 한 픽셀도 안 건드리므로 BAR_H·lane 계산·
    //   barSpacer 등식이 전부 그대로 남는다. border 로 바꾸지 말 것.
    // ★ 모서리는 0 이다 — 배경이 없어진 판에 둥근 모서리는 밑줄 끝만 휘게 한다.
    //   "이어진다"(cutL/cutR)는 이제 margin 0 이 밑줄을 칸 끝까지 붙여서 보여 준다.
    (one ? ';background-color:transparent;color:' + p.color
         : ';background-color:transparent;border-radius:0;color:var(--label)' +
           ';box-shadow:inset 0 -3px 0 ' + p.color) +
    ';text-decoration:' + p.deco + ';opacity:' + p.op + '">' +
    (one ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;' +
      'margin-right:5px;vertical-align:middle;background-color:' + p.color + '"></span>' : '') +
    esc(p.title) + '</div>';
}

// 일간 뷰가 그릴 모양으로 바꾼 **사본**. 원본은 안 건드린다.
//   첫날      = 시작 시각에 얇은 마커 (그 날 안에 끝나지 않으니 길이를 지어내지 않는다)
//   마지막 날 = 종료 시각에 얇은 마커
//   가운데 날 = 하루 종일 (시간축이 아니라 위쪽 칩 줄에 뜬다)
// ★ 새 개념을 안 만든다 — dayRange/dayLayout 은 '종료 없음 = 마커', '시각 없음 =
//   하루 종일' 을 이미 알고 있다. 그 규칙에 맞는 사본을 넘기는 것이 전부다.
// ★ 종류 필터는 여기 안 온다: 일간에서는 할 일과 일정이 늘 같이 보인다(kindFilter).
function dayShape(it, ds) {
  if (!isEvent(it) || spanOf(it) === 1) return it;
  const s = occStart(it, ds);
  if (ds === s) return Object.assign({}, it, { endTime: '' });
  if (ds === addDays(s, spanOf(it) - 1)) {
    return Object.assign({}, it, { time: it.endTime || '', endTime: '' });
  }
  return Object.assign({}, it, { time: '', endTime: '' });
}

// ------------------------------------------------------- 일간 뷰 (순수 함수)
// 아래 다섯 함수는 DOM 을 모른다 — 그래야 ?selftest 가 좌표를 직접 단언한다.
// 자정 넘김은 endOk(todo.js)가 저장에서 막으므로 end > start 를 전제로 둔다.
// 이틀에 걸치는 항목은 이 앱에 존재하지 않는다.

const DAY_MIN_HOURS = 3;              // 데이터가 아무리 짧아도 이만큼은 보여 준다
const HOUR_MIN_H = 40, HOUR_MAX_H = 72;
const AXIS_TARGET = 620;              // 목표 축 높이. pxPerHour 를 정할 때만 쓴다 —
                                      // 축 높이는 반드시 시간수 × pxPerHour 다(아래 참고)
const MARK_MIN = 30;                  // 종료 없는 항목이 겹침 계산에서만 차지하는 길이
const MARK_H = 20;                    // 그 항목의 화면 높이(고정). 길이를 지어내지 않는다
// 아주 짧은 일정도 제목 한 줄은 **온전히** 보이게. 주간 뷰 '5개' 와 같은 성격의 실측값이다.
//   한 줄 블록 = 패딩 5 + line-height(13px, normal) + 패딩 5
//   실측(13px/600 한 줄. line-height 를 지정하지 않으므로 글꼴 metrics 가 정한다):
//     Pretendard Variable (CDN 로드 성공)  15.2 → 25.2
//     system-ui / Segoe UI                 17.6 → 27.6
//     맑은 고딕 / 굴림                     15.2 / 14.4 → 25.2 / 24.4
//     Pretendard(정적) · serif ← 최악      19.2 → **29.2**
//   BLOCK_MIN_H = ceil(29.2) = 30   ← 폴백 글꼴에서도 제목이 안 잘리는 최소 정수
// ★ 28 이던 시절 폴백 글꼴에서 1.2px 이 블록 밖으로 샜다. 글꼴·글자 크기·패딩을 바꾸면
//   다시 잴 것. 이 값을 올리면 픽셀 겹침 판정(dayLayout)도 같이 넓어진다.
const BLOCK_MIN_H = 30;
// 제목+시간 두 줄이 들어가는 최소 높이: 패딩 5 + 13px×1.3(17) + 11px×1.3(15) + 패딩 5.
// ★ 글꼴 크기·line-height·패딩을 바꾸면 이 값을 다시 계산할 것.
const TWO_LINE_H = 42;

// ⚠️ **CSS 와 이중 소스다.** maxW·outerPad 는 render() 의 바깥 래퍼 인라인 스타일,
//    cardPad 는 일간 뷰 카드의 인라인 패딩에서 온 값이고 여기 숫자와 맞아야 한다.
//    axisW·gutter 만 아래 렌더가 이 상수로 직접 생성하므로 어긋날 수 없다.
//    **래퍼·카드 쪽 값을 고치면 여기도 같이 고칠 것** — 안 그러면 colW 만 조용히
//    틀려져서 좁은 화면의 표시 단계가 한 칸씩 밀린다(화면은 멀쩡해 보인다).
const DAY_PX = { maxW: 1024, outerPad: 16, cardPad: 16, axisW: 58, gutter: 6 };

// 'HH:MM' → 분. Date 를 안 만든다 — 타임존이 끼어들 자리를 두지 않는다.
const toMin = (hhmm) => { const p = hhmm.split(':').map(Number); return p[0] * 60 + p[1]; };
// 종료가 없으면 겹침 계산에서만 30분으로 친다. 화면 높이는 MARK_H 고정이다.
const itemEndMin = (it) => (it.endTime ? toMin(it.endTime) : toMin(it.time) + MARK_MIN);

// 그날 시간축의 범위와 배율. 시간 항목이 없으면 null → 축을 아예 안 그린다.
function dayRange(timed) {
  if (!timed.length) return null;
  let a = 1440, b = 0;
  timed.forEach((it) => { a = Math.min(a, toMin(it.time)); b = Math.max(b, itemEndMin(it)); });
  a = Math.floor(a / 60) * 60;                       // 정시로 내리고
  b = Math.min(1440, Math.ceil(b / 60) * 60);        // 정시로 올린다
  if (b - a < DAY_MIN_HOURS * 60) {                  // 최소 3시간 — 뒤로 늘리고
    b = a + DAY_MIN_HOURS * 60;
    if (b > 1440) { b = 1440; a = b - DAY_MIN_HOURS * 60; }   // 24시에 닿으면 앞으로
  }
  const hours = (b - a) / 60;
  const pxPerHour = Math.max(HOUR_MIN_H, Math.min(HOUR_MAX_H, Math.round(AXIS_TARGET / hours)));
  // ★ 높이는 **반올림된** pxPerHour 에서만 나온다. AXIS_TARGET 을 그대로 쓰면
  //   마지막 눈금선이 축 밖으로 나간다(12시간이면 620 vs 624).
  return { startMin: a, endMin: b, hours: hours, pxPerHour: pxPerHour, h: hours * pxPerHour };
}

// 겹침 → 열 배정. 시작 오름차순(같으면 긴 것 먼저, 그래도 같으면 입력 순서) →
// 겹침 그룹 → 그룹 안에서 "마지막 종료 ≤ 현재 시작"인 열 재사용, 없으면 새 열.
// 폭은 그룹 전체의 열 수로 균등 분할한다.
function dayLayout(timed, range) {
  const rows = timed.map((it, i) => ({ it: it, i: i, s: toMin(it.time), e: itemEndMin(it) }))
    .sort((x, y) => (x.s - y.s) || (y.e - x.e) || (x.i - y.i));
  const out = [];
  let group = [], colEnds = [], groupEnd = -1;
  const flush = () => {
    group.forEach((g) => { g.cols = colEnds.length; });
    group = []; colEnds = []; groupEnd = -1;
  };
  rows.forEach((r) => {
    const marker = !r.it.endTime;
    const height = marker ? MARK_H
      : Math.max(BLOCK_MIN_H, Math.round((r.e - r.s) * range.pxPerHour / 60));
    // ★ 겹침은 시간이 아니라 **픽셀**로 본다 — 렌더 높이와 판정을 한 좌표계에 두기 위해서다.
    //   BLOCK_MIN_H·MARK_H 가 짧은 항목의 높이를 부풀리므로, 시간으로만 보면 40px/h 축의
    //   10:00–10:20 과 10:25–10:45 가 "안 겹친다"며 같은 열에 놓인 뒤 화면에서 서로를 덮는다
    //   (실제로 밟았다: 11px 포갬). 뒤 블록이 앞을 덮으면 정보가 0 이라 열을 쪼개는 쪽이 낫다.
    //   ⚠️ **그래서 판정이 pxPerHour 에 의존한다** — 같은 항목들이라도 축 범위가 바뀌면
    //   열 배정이 달라질 수 있다. 버그가 아니라 의도된 선택이다(종료 없는 항목을 겹침
    //   계산에서만 MARK_MIN 으로 치는 것과 같은 방식). 대가: 40px/h 에서는 한 항목이
    //   최소 45분(30px)을 점유해 짧은 항목이 몰린 시간대가 열을 더 쪼갠다.
    const eOcc = Math.max(r.e, r.s + height * 60 / range.pxPerHour);
    if (r.s >= groupEnd) flush();          // 그룹의 어느 것과도 안 겹친다 → 새 그룹
    let c = 0;
    while (c < colEnds.length && colEnds[c] > r.s) c++;
    if (c === colEnds.length) colEnds.push(0);
    colEnds[c] = eOcc;
    groupEnd = Math.max(groupEnd, eOcc);
    const o = {
      id: r.it.id, col: c, cols: 0,
      top: Math.round((r.s - range.startMin) * range.pxPerHour / 60),
      height: height,
      marker: marker
    };
    group.push(o); out.push(o);
  });
  flush();
  return out;
}

// 열 하나의 폭. 측정(offsetWidth)을 하지 않는다 — 2패스가 되면 render() 뒤에
// 후처리 훅이 생기고, @container 는 selftest 가 문자열로 단언하지 못한다.
const dayColW = (vw, cols) =>
  (Math.min(vw, DAY_PX.maxW) - DAY_PX.outerPad * 2 - DAY_PX.cardPad * 2
    - DAY_PX.axisW - DAY_PX.gutter) / cols;

// 좁아지면 숨기지 않고 **단계적으로 버린다**(+N 접기 없음).
// 임계값은 열 개수가 아니라 폭 px 이라 넓은 화면에서는 4열이어도 full 이 유지된다.
// 글자가 실제로 쓰는 폭은 colW - 21 이다(왼쪽 강조선 3 + 오른쪽 구분선 2 + 패딩 8×2).
// 실측(Pretendard, document.fonts.ready 이후 span.getBoundingClientRect):
//   '오후 12:30 – 오후 12:30' 11px/500 = 110.05  ← ko 가 최장 (en 은 104.44)
//   '가나…'                  13px/600 =  33.11
//   T_FULL  = ceil(110.05) + 21 = 132   시간 범위가 **잘리지 않는** 최소 폭
//   T_TITLE = ceil(33.11)  + 21 =  55   이 아래는 '…' 만 남아 정보가 0
// ★ 글꼴·글자 크기·패딩·구분선을 바꾸면 다시 잴 것 — 주간 뷰의 '5개' 와 같은 성격이다.
//   열 폭은 (vw-16×2-16×2-58-6)/cols 다. 실기기 폭별 2열 결과:
//     360(갤럭시 다수) 116 · 384 128 · 390 131 → 전부 title (132 에 못 미친다)
//     412 142 · 1024 448 → full
//   ★ 폰에서 겹치면 시간 라벨을 버리는 것이 정상 동작이다. 축 폭을 2px 깎아 390 만
//     full 로 넘긴 적이 있는데, 360 은 그래도 못 넘어서 이득 없이 축만 좁아졌다.
//   시간 라벨은 .trunc(nowrap+말줄임)라 폰트가 늦게 와 폭이 커져도 두 줄이 되지 않는다
//   — height >= TWO_LINE_H 전제가 깨지지 않게 하는 장치다.
const T_FULL = 132, T_TITLE = 55;
const blockTier = (colW, h) =>
  (colW >= T_FULL && h >= TWO_LINE_H) ? 'full' : (colW >= T_TITLE ? 'title' : 'bar');

// 균등 분할은 % 로 적는다 — calc() 를 쓰면 selftest 가 style 문자열로 못 본다.
// 소수 4자리에서 끊어 '33.3333%' 처럼 값이 항상 같은 모양으로 나오게 한다.
const pct = (v) => (Math.round(v * 1e4) / 1e4) + '%';

// 손으로 정한 순서. sortCats 의 order 와 같은 규칙이다 — 번호가 있으면 그 순서로,
// 없으면 **뒤로** 보내고 자기들끼리는 원래(시각·제목) 차례를 지킨다. 옛 항목에는
// 번호가 없으므로 필수로 만들면 안 된다.
// ⚠️ 번호는 **항목마다 하나**다(날짜별이 아니다). 반복·여러 날 항목은 여러 날에
//   나타나지만 문서는 하나라, 한 날에서 바꾼 순서가 그 항목이 나오는 모든 날에
//   똑같이 적용된다. 날짜별로 두려면 항목마다 날짜→번호 맵을 들어야 해서 문서가
//   계속 자란다 — 개인용 앱에는 과하다고 보고 안 했다(사용자와 합의).
const ITEM_ORDER_LAST = Number.MAX_SAFE_INTEGER;
const ordOf = (it) => (typeof it.order === 'number' ? it.order : ITEM_ORDER_LAST);

function sortItems(list) {
  return list.slice().sort((x, y) => {
    // ★ 손으로 정한 순서가 **제일 먼저**다(사용자 요청: 달력 칸까지 반영).
    //   이 함수가 월 칸·주 열·아래 목록·내보내기가 다 지나는 통로라 여기 한 줄이면
    //   전부 따라온다. 같이 따라오는 것이 하나 더 있다 — weekEventBars 가 이 순서로
    //   막대 **층**을 배정하므로, 일정 순서를 바꾸면 달력의 막대가 위아래로 움직인다.
    const ox = ordOf(x), oy = ordOf(y);
    if (ox !== oy) return ox - oy;
    const tx = x.time || '', ty = y.time || '';
    // 시간이 같으면 제목순. localeCompare 를 쓰지 않는다 — 정렬은 화면에 보이는
    // 순서라 표시처럼 보이지만, ?selftest 가 lang='en' 에서 정렬이 한 글자도 안
    // 변하는지 본다(Intl 경계, CONTEXT §5). 코드 단위 비교는 로케일을 안 탄다.
    if (tx === ty) { const a = x.title || '', b = y.title || ''; return a < b ? -1 : a > b ? 1 : 0; }
    if (!tx) return -1;
    if (!ty) return 1;
    return tx < ty ? -1 : 1;
  });
}
// ★ 필터를 인자로 안 받고 state.filter 를 직접 읽는다.
//   화면에 할 일을 꺼내는 통로가 이 함수 하나뿐이다 — 월(cells)·주(cols)·일(dayList)·
//   하단 목록·내보내기(export.js 3곳)가 전부 여기를 지난다. 인자로 넘기면 호출부
//   6곳을 다 고쳐야 하고, **하나만 빠뜨리면 그 화면에서 필터가 조용히 안 먹는다**
//   (내보내기가 제일 놓치기 쉽다). 순수함을 잃는 대신 그 실수를 원천적으로 없앴다.
// 필터가 걸리면 일간 뷰 시간축 범위(dayRange)도 따라 좁아진다 — 의도된 동작이다.
// ★ 종류 필터(할 일 / 일정)는 **일간·연간 뷰에서 안 본다.** 하루치는 양이 적어서
//   나눌 이유가 없고, 시간축은 원래 둘을 함께 놓는 자리다("일간에서는 둘 다 같이").
//   값을 지우지 않고 여기서만 무시하는 이유: 지우면 월간으로 돌아왔을 때 고른 것이
//   풀려 있다. 내보내기도 이 함수를 지나므로 이미지가 화면과 자동으로 같아진다.
const kindFilter = () => (state.view === 'day' || state.view === 'year' ? null : state.kind);

// 날짜와 무관한 조건(카테고리·종류)만 뽑아 둔다. itemsOn 과 막대 층(weekEventBars)이
// **같은 함수**를 지나야 한다 — 알약은 걸러지는데 막대는 안 걸러지는 일이 없게.
function passes(it) {
  const f = state.filter, k = kindFilter();
  return (!f || (it.categoryId || '') === f)
    && (!k || (it.kind === 'event' ? 'event' : 'todo') === k);
}

function itemsOn(items, ds, showCompleted) {
  return sortItems(items.filter((it) =>
    occursOn(it, ds) && (showCompleted || !isDone(it, ds)) && passes(it)));
}

// 월·주 격자의 **칸**에 들어가는 것 = 일정을 뺀 나머지. 일정은 칸이 아니라 막대 층이
// 그린다(한 항목이 여러 칸에 걸치므로). 하단 목록·일간 뷰·연간 뷰는 이걸 안 쓴다 —
// 거기서는 둘이 같이 보여야 한다.
const cellItems = (items, ds) => itemsOn(items, ds, SHOW_COMPLETED).filter((it) => !isEvent(it));

// 일정을 앞으로 모은다. 각 묶음 **안의** 차례는 sortItems 가 준 시각 순 그대로다.
// ★ 쓰는 곳은 둘뿐이다 — 화면 아래 목록과 일간 이미지. 종류가 바뀌는 자리에 굵은
//   선을 **하나만** 긋기 위해 묶는 것이고(사용자 요청), 시각 순으로 두면 09시 할 일이
//   14시 일정 위로 올라와 두 종류가 섞여서 그을 자리가 아예 안 생긴다.
// ⚠️ 이걸 sortItems 나 itemsOn 안으로 옮기지 말 것. 그 둘은 월·주 칸의 알약과 막대
//   층까지 지나는 통로라, 거기서 순서를 바꾸면 달력 격자가 통째로 흔들린다.
const eventsFirst = (list) => list.filter(isEvent).concat(list.filter((it) => !isEvent(it)));

// 아래 목록의 **둘째 줄** — [카테고리(그 색)] · [메모] [펼침].
// ★ 카테고리가 없는 항목에는 이름을 안 붙인다. 폴백 이름이 '없음' 이라, 붙이면 분류
//   안 한 줄마다 "없음 · …" 이 떠서 정보가 아니라 잡음이 된다.
// ★ 메모는 flex 칸이고 min-width:0 이라야 .trunc 가 먹는다 — 이게 없으면 flex 항목의
//   최소 폭이 글자 길이라 줄이 말줄임 대신 **가로로 밀린다**.
function subLine(it) {
  const cat = catOf(it);
  if (!cat.id && !it.memo) return '';
  const on = !!state.memoOpen[it.id];
  // 접었을 때 보일 **첫 줄**. 빈 줄로 시작하는 메모가 빈칸으로 보이지 않게 내용이
  // 있는 첫 줄을 고른다. more = 그 줄 말고 더 있나 — 첫 줄이 짧아 안 잘려도
  // 뒷줄이 있으면 펼침 버튼이 떠야 한다(syncMemoBtns 가 이 표시를 읽는다).
  const head = ((it.memo || '').split('\n').find((l) => l.trim()) || '').trim();
  const more = (it.memo || '').trim() !== head;
  return '<div style="display:flex;align-items:flex-start;font-size:13px;' +
      'color:var(--label-secondary);margin-top:1px;min-width:0">' +
    (cat.id ? '<span style="flex:none;font-weight:600;color:' + cat.color + '">' +
      esc(catName(cat)) + '</span>' : '') +
    (cat.id && it.memo ? '<span aria-hidden="true" style="flex:none;color:var(--label-quaternary);' +
      'padding:0 5px">·</span>' : '') +
    (it.memo
      ? '<span data-memotext="' + esc(it.id) + '"' + (more ? ' data-memomore' : '') +
          // ★ 접히면 **첫 줄만**, 펼치면 줄바꿈까지 그대로다(사용자 요청).
          //   pre-wrap 이라야 메모에 든 \n 이 진짜 줄바꿈으로 선다 — 기본값에서는
          //   HTML 이 공백 하나로 뭉개서 여러 줄 메모가 한 문단처럼 이어져 보인다.
          (on ? ' style="flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere"'
              : ' class="trunc" style="flex:1;min-width:0"') +
          '>' + esc(on ? it.memo.trim() : head) + '</span>' +
        // ★ 펼침 버튼은 **잘린 줄에만** 보인다(syncMemoBtns 가 그린 뒤 재서 켠다).
        //   여기서는 늘 hidden 으로 낸다 — 반대로 두면 짧은 메모에서도 한 번 번쩍인다.
        //   접는 화살표는 따로 안 만들고 같은 아이콘을 180도 돌려 쓴다.
        '<button data-memo="' + esc(it.id) + '" hidden aria-expanded="' + on + '" ' +
          'aria-label="' + esc(t(on ? 'list.memoLess' : 'list.memoMore')) + '" ' +
          'style="flex:none;border:none;background:none;cursor:pointer;padding:0 0 0 6px;' +
          'color:var(--label-tertiary);display:flex;align-items:center">' +
          '<span style="display:flex' + (on ? ';rotate:180deg' : '') + '">' +
          icon('chevron.down', 13) + '</span></button>'
      : '') +
    '</div>';
}

// 메모가 실제로 잘렸는지는 **그린 뒤에만** 알 수 있다 — CSS 로는 못 묻는다. 안 잘린
// 줄에 펼침 버튼을 두면 눌러도 아무 일이 없어 고장으로 읽히므로, 여기서 재서 켠다.
// 펼쳐 둔 줄은 재지 않는다 — 다 보여서 안 넘치지만 **접을 버튼은 있어야** 한다.
// "다음 줄로 넘어갈 만큼" 의 기준. 1~2px 은 반올림 오차라, 그걸로 버튼을 띄우면
// 넉넉히 들어가는 줄에도 화살표가 붙어 **무조건 보이는 것처럼** 읽힌다.
const MEMO_CLIP_SLOP = 4;

function syncMemoBtns() {
  document.querySelectorAll('[data-memo]').forEach((b) => {
    const txt = b.previousElementSibling;
    // 뒷줄이 있으면(data-memomore) 재 볼 것도 없이 뜬다 — 첫 줄이 짧아 안 잘려도
    // 감춰 둔 줄이 있다는 뜻이다. 한 줄짜리 메모는 **정말로 넘칠 때만** 뜬다.
    b.hidden = !txt || !(state.memoOpen[b.dataset.memo] || txt.dataset.memomore !== undefined
      || txt.scrollWidth - txt.clientWidth > MEMO_CLIP_SLOP);
  });
  // ★ 폰트가 늦게 오면 방금 잰 값이 거짓이 된다. 대체 글꼴이 더 넓어서(실측: 같은
  //   메모가 211px → 248px) 웹폰트 전에는 "넘쳤다" 로 나오는데, 폰트가 온 뒤엔 넉넉히
  //   들어가는데도 판정만 굳어 있다. CDN 폰트가 늦는 폰에서 특히 잦다 — 한 번 더 잰다.
  //   ⚠️ status 를 먼저 볼 것. ready 는 이미 끝났어도 resolve 되므로 무조건 걸면
  //     자기 자신을 끝없이 다시 부른다.
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(syncMemoBtns);
}
// 화면을 돌리거나 창을 줄이면 메모 칸 폭이 바뀐다 — 다시 안 재면 판정이 낡는다.
// ★ 클릭·입력 위임에 얹을 수 없는 **창 단위** 사건이라 여기서 직접 듣는다.
window.addEventListener('resize', syncMemoBtns);

// ws 주의 일정 막대들 — 층 배정까지 끝난 것. 정렬을 먼저 하는 이유는 층이 매번 같은
// 자리에 오게 하기 위해서다(스냅샷이 오는 순서에 층이 흔들리면 막대가 위아래로 튄다).
function weekEventBars(items, ws) {
  const segs = [];
  sortItems(items.filter((it) => isEvent(it) && passes(it)))
    .forEach((it) => weekBars(it, ws).forEach((b) => segs.push(b)));
  return laneBars(segs);
}

// ------------------------------------------------------------------- 목표
// 목표는 **할 일과 다른 컬렉션**이다 (users/{uid}/goals). 날짜 하나가 아니라 기간이라
// occursOn 의 '한 항목 = 한 날' 전제에 안 맞는다 — 섞으면 월·주·일 렌더 경로가 전부
// 목표를 걸러내야 하고, 한 곳만 빠뜨리면 목표가 365일 전부에 뜬다.
//   { title, scope:'year'|'month', y, m:0-11|null, d:1-31|null, categoryId, memo, done }
// scope 'year' = '올해 안에'(기한 없음), 'month' = 그 달까지(d 가 있으면 그 날짜까지).
//
// 정렬 키. 이른 마감이 먼저, 기한 없는 '올해 안에' 는 맨 뒤다.
// d 가 없으면 그 달의 아무 날보다 뒤(99)로 둔다 — 같은 달이면 날짜를 정한 쪽이 먼저다.
const goalKey = (g) => (g.scope === 'month' ? (g.m || 0) * 100 + (g.d || 99) : 999999);
// ★ itemsOn 과 같은 이유로 state.filter 를 직접 읽는다 — 목록과 12칸 요약이 같은
//   통로를 지나야 필터가 한쪽에서만 조용히 빠지지 않는다.
function goalsIn(y) {
  const f = state.filter;
  return state.goals
    .filter((g) => g.y === y && (!f || (g.categoryId || '') === f))
    .sort((a, b) => {
      const ka = goalKey(a), kb = goalKey(b);
      if (ka !== kb) return ka - kb;
      // sortItems 와 같은 이유로 localeCompare 를 안 쓴다 (Intl 경계, CONTEXT §5).
      const x = a.title || '', z = b.title || '';
      return x < z ? -1 : x > z ? 1 : 0;
    });
}
// 마감 배지. Intl 이 만든 월·일 이름에 조사만 붙인다 — 저장값으로 되돌아가지 않는다.
const goalDue = (g) => (g.scope !== 'month' ? t('goal.dueYear')
  : t('goal.by', g.d ? monthDay(new Date(g.y, g.m, g.d)) : monthShort(g.m)));

// ---------------------------------------------------------------- state
const now0 = new Date();
const state = {
  // 'year' | 'month' | 'week' | 'day'. 첫 화면은 설정값이다 (i18n.js 의 SETTINGS.view,
  // 기본 'month'). i18n.js 가 먼저 로드돼 loadSettings() 를 이미 돌렸으므로 여기서
  // 바로 읽을 수 있다. 로그인하면 원격 값이 이긴다 — firebase.js 가 덮어쓴다.
  view: SETTINGS.view,
  cy: now0.getFullYear(),
  cm: now0.getMonth(),
  selected: fmt(now0),
  items: [],
  cats: [],           // users/{uid}/categories 스냅샷. 세우는 순서는 sortCats() 하나가 정한다
  goals: [],          // users/{uid}/goals 스냅샷. 정렬은 goalsIn() 이 그릴 때 한다
  // 목표 시트. null 이면 닫힘 — exp·jump 와 같은 방식이라 여는 플래그가 따로 없다.
  // { id, title, scope, y, m, hasDay, d, categoryId, memo }. id 가 '' 면 새 목표.
  goalDraft: null,
  // null = 전체. 아니면 categoryId 문자열. ★ 저장하지 않는다 — 새로고침하면 풀린다.
  // 남겨 두면 다음에 열었을 때 "할 일이 다 사라졌다" 로 읽힌다.
  filter: null,
  // 종류 필터. null = 전체, 'todo' = 할 일만, 'event' = 일정만.
  // ★ 월간·주간에서만 쓴다 (kindFilter 참고). filter 와 같이 저장하지 않는다.
  kind: null,
  showCats: false,    // 카테고리 관리 시트
  catDraft: null,     // 그 안의 편집기 { id, name, color }. null 이면 목록 모드
  // 관리 목록에서 길게 눌러 끄는 중. { id, from, to, y0, rowH, on, timer }
  // ★ 끄는 동안에는 render() 를 안 부른다 — #app 을 갈아엎으면 손가락이 잡고 있던
  //   줄이 사라진다(로그인 화면에서 키보드가 닫히던 것과 같은 원리). 대신 줄의
  //   transform 만 직접 민다. 놓을 때 한 번만 그린다.
  // 아래 목록에서 펼쳐 둔 메모 { [itemId]: 1 }. 화면 전용이라 저장하지 않는다.
  // ★ DOM 이 아니라 여기 있어야 한다 — render() 가 #app 을 통째로 다시 만들어서
  //   펼친 표시를 요소에 두면 다음 render() 에 조용히 접힌다.
  memoOpen: {},
  drag: null,
  showForm: false,
  editingId: null,
  form: null,
  repeatOpen: false,
  // Firestore 읽기는 전부 비동기다 — 여기서 계정을 동기로 채울 수 없다.
  // firebase.js(모듈)가 인증 상태를 알려줄 때까지 booting 화면을 보여준다.
  users: [],          // 관리자로 로그인했을 때만 채워지는 users 컬렉션 스냅샷
  // 로그인한 계정 **또는 손님**. 손님은 { guest:true, uid:'' } 다 — null 이 아니다.
  // ★ 이 값을 "로그인했다" 는 뜻으로 읽으면 안 된다. 계정이 있어야만 되는 자리는
  //   반드시 isGuest() 로 한 번 더 갈라야 한다(설정 시트의 계정·탈퇴 줄이 그렇다).
  user: null,
  auth: blankAuth(),
  // 로그인 화면을 **일부러** 띄운 상태. 손님이 설정에서 "로그인" 을 눌렀거나,
  // 로그인이 실패해 사유를 보여 줘야 할 때 true 다. false 면 손님 화면이 그대로 뜬다.
  // ★ 한 번 켜지면 로그인 성공이나 사용자가 닫을 때까지 유지한다 — 중간에 끼는
  //   applyLoggedOut() 이 사유 문구를 덮어 버리지 않게 하려는 것이다.
  showLogin: false,
  booting: true,
  showAdmin: false,
  admQ: '',           // 관리자 패널 검색어 (uncontrolled 입력칸의 값)
  admSort: 'joined',  // 'joined' = 최근 가입 먼저 | 'name'
  legal: null,        // null | 'terms' | 'privacy' — 회원가입 화면의 약관 전문 모달
  showSettings: false,
  del: null,          // 탈퇴 확인 { pin, error, busy }. null 이면 확인 단계 전
  exp: null,          // 이미지 미리보기 { memo, detail, busy, url, file, canShare, err }
  jump: null          // 년·월 점프 { y } — y 는 고른 년, 월을 누르면 확정된다
};

// 시트가 열려 있으면 원격 스냅샷 렌더를 미룬다 — render() 가 #app 을 통째로
// 갈아엎어서 시트가 튀기 때문이다. 미리보기·점프 시트도 같은 보호가 필요하다.
// 미룬 변경은 closeForm()/closeExport()/closeJump() 의 render() 가 반영한다.
// ★ showCats 도 여기 든다 — 카테고리 시트에는 이름 입력칸(uncontrolled)이 있어서
//   원격 스냅샷이 render() 를 돌리면 타이핑하던 캐럿이 날아간다. showSettings·
//   showAdmin 이 여기 없는 이유는 그쪽에 입력칸이 없기 때문이다.
// ★ goalDraft 도 여기 든다 — 목표 시트에 제목·메모 입력칸(uncontrolled)이 있다.
// ★ showAdmin 도 여기 든다 — 관리자 패널에 검색칸(uncontrolled)이 생겼다. 대신
//   users 스냅샷이 오면 syncAdmSheet() 가 목록만 갈아 끼워서 화면은 계속 최신이다.
const sheetBusy = () =>
  state.showForm || !!state.exp || !!state.jump || state.showCats || !!state.goalDraft || state.showAdmin;

// ---------------------------------------------------------------- 손님 저장소
// 로그인하지 않아도 앱을 그대로 쓴다. 손님의 할 일은 **서버에 안 간다** — 이
// 브라우저에만 남는다. window.fb 의 쓰기 함수들이 isGuest() 로 여기로 갈린다.
//
// ★ 키 하나에 세 컬렉션을 통째로 담는다. 낱개 키로 나누면 용량이 찼을 때
//   "할 일만 저장되고 카테고리는 안 된" 반쪽 상태가 생긴다.
// ★ 문서 모양은 Firestore 와 **같게 유지할 것**. 나중에 계정으로 올릴 때
//   그대로 실어 보내야 하고, 화면 코드가 두 저장소를 구분하지 않기 때문이다.
const GUEST_KEY = 'tc.guest.v1';
const isGuest = () => !!(state.user && state.user.guest);

function guestRead() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(GUEST_KEY)); } catch (e) { raw = null; }
  const d = raw && typeof raw === 'object' ? raw : {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  return { items: arr(d.items), cats: arr(d.cats), goals: arr(d.goals) };
}

function guestLoad() {
  const d = guestRead();
  state.items = d.items;
  state.cats = sortCats(d.cats);
  state.goals = d.goals;
}

const guestCount = () => { const d = guestRead(); return d.items.length + d.cats.length + d.goals.length; };
const guestClear = () => { try { localStorage.removeItem(GUEST_KEY); } catch (e) { /* 지울 수 없으면 그냥 둔다 */ } };

// 계정으로 올릴 문서를 만든다. **id 는 그대로 쓴다** — 할 일이 가리키는 categoryId 가
// 올라간 카테고리와 같은 id 여야 색이 유지된다. 새로 뽑으면 전부 '없음' 으로 떨어진다.
// ★ 보안 규칙이 카테고리는 keys().hasOnly(['name','color','order']), 목표는 여덟 키를
//   본다. id 를 몸통에 섞어 보내면 **묶음 전체가 거부된다** — 그래서 여기서 뺀다.
function guestDocs() {
  const d = guestRead();
  const body = (o) => { const b = Object.assign({}, o); delete b.id; return b; };
  return {
    cats: d.cats.map((c) => ({ id: c.id, body: { name: c.name, color: c.color, order: c.order } })),
    goals: d.goals.map((g) => ({ id: g.id, body: body(g) })),
    items: d.items.map((it) => ({ id: it.id, body: body(it) }))
  };
}

// 손님으로 들어간다. 세션이 없을 때 로그인 화면 대신 여기로 온다.
// ★ name 을 비워 둔다 — '손님' 은 번역 문자열이라 여기 박아 두면 언어를 바꿔도
//   안 따라온다. 화면에 쓸 때 t('guest.name') 을 부른다.
function enterGuest() {
  state.user = { uid: '', guest: true, name: '', email: '', role: 'user', status: 'approved' };
  state.users = [];
  guestLoad();
}

function guestWrite() {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(
      { items: state.items, cats: state.cats, goals: state.goals }));
    return true;
  } catch (e) {
    // 조용히 넘기지 않는다 — 사파리 시크릿 모드·용량 초과에서 저장이 안 되는데
    // 화면만 멀쩡하면 사용자는 다 지워진 다음에야 알게 된다.
    if (window.fb) fb.fail(t('err.save'), e);
    return false;
  }
}

// 여러 번 이어서 부를 수 있다(카테고리 순서는 한 번에 열 개를 쓴다) — 렌더는
// 한 번으로 모은다. 시트가 열려 있으면 미루는 것은 원격 스냅샷과 같은 규칙이다.
let guestPaint = null;
function guestDone() {
  guestWrite();
  if (!guestPaint) {
    guestPaint = setTimeout(() => { guestPaint = null; if (!sheetBusy()) render(); }, 0);
  }
  return Promise.resolve();
}

// Firestore 쪽 쓰기 함수와 **같은 뜻**으로 맞춘 손님 갈래.
// saveTodo 가 merge 인 것, setToggle 이 반복이면 날짜 배열을 건드리는 것까지 같다.
const guest = {
  newId: () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  saveTodo(id, data) {
    const at = state.items.findIndex((x) => x.id === id);
    const merged = Object.assign({}, at < 0 ? null : state.items[at], data, { id });
    state.items = at < 0 ? state.items.concat(merged)
      : state.items.slice(0, at).concat(merged, state.items.slice(at + 1));
    return guestDone();
  },
  removeTodo(id) {
    state.items = state.items.filter((x) => x.id !== id);
    return guestDone();
  },
  setToggle(id, ds, repeating, on) {
    state.items = state.items.map((x) => {
      if (x.id !== id) return x;
      if (!repeating) return Object.assign({}, x, { done: on });
      const cur = Array.isArray(x.doneDates) ? x.doneDates : [];
      return Object.assign({}, x, {
        doneDates: on ? (cur.indexOf(ds) < 0 ? cur.concat(ds) : cur) : cur.filter((s) => s !== ds)
      });
    });
    return guestDone();
  },
  saveCat(id, name, color, order) {
    const rest = state.cats.filter((c) => c.id !== id);
    state.cats = sortCats(rest.concat({ id, name, color, order }));
    return guestDone();
  },
  removeCat(id) {
    state.cats = state.cats.filter((c) => c.id !== id);
    return guestDone();
  },
  saveGoal(id, data) {
    const rest = state.goals.filter((g) => g.id !== id);
    state.goals = rest.concat(Object.assign({}, data, { id }));
    return guestDone();
  },
  removeGoal(id) {
    state.goals = state.goals.filter((g) => g.id !== id);
    return guestDone();
  },
  setGoalDone(id, on) {
    state.goals = state.goals.map((g) => (g.id === id ? Object.assign({}, g, { done: on }) : g));
    return guestDone();
  }
};

// 마지막으로 **그려진** 뷰. 진입 애니메이션을 뷰가 실제로 바뀐 렌더에만 걸기 위한 것이다.
// ★ render() 는 탭 말고도 돈다 — 체크 한 번, 1분마다(일간 시계), 원격 스냅샷,
//   창 크기 변경, darkMQ. 무조건 걸면 할 일 하나 체크할 때마다 화면이 깜빡인다.
// ★ state 에 안 넣는다. 이건 앱의 상태가 아니라 **직전 그림의 흔적**이고,
//   selftest 가 state 를 되돌릴 때 같이 되돌아가면 의미가 없다.
let lastView = null;

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
  const c = catOf(it).color;
  const done = isDone(it, ds);
  return {
    id: it.id, title: it.title, color: c,
    bg: 'color-mix(in srgb, ' + c + ' 16%, transparent)',
    deco: done ? 'line-through' : 'none',
    op: done ? 0.5 : 1,
    // 편집으로 열 날짜 = 그 **회차의 시작일**. 5일짜리 일정의 3일째를 눌렀다고
    // 시작 날짜가 3일째로 옮겨가면 안 된다. 기간이 없는 항목은 ds 와 같은 값이라
    // 지금까지의 동작이 한 글자도 안 바뀐다.
    openDs: occStart(it, ds) || ds,
    // ★ 예전에는 시작만 적는 `timeLabel` 도 같이 들고 있었다 — 좁은 격자용이었다.
    //   주간 칸에서 시간 라벨을 아예 뺐으므로(사용자 요청) 쓰는 곳이 없어 지웠다.
    //   되살릴 일이 생기면 `timeLabel(it.time)` 한 줄이고, 그때 WEEK_FIT 를 다시 잴 것.
    //   여기 남은 range 는 **넓은 곳 전용**이다 — 일간 뷰 블록이 쓴다.
    range: it.time ? timeRange(it.time, it.endTime || '') : t('item.allDay')
  };
}
// data-open carries the id + the date the row was rendered for, so editing a
// repeating task opens it on the occurrence the user actually tapped.
const openAttr = (p, ds) => 'data-open="' + esc(p.id) + '" data-ds="' + (p.openDs || ds) + '"';

// ---------------------------------------------------------------- render
function render() {
  // ★ innerHTML 을 갈아엎기 전에 팝오버의 스크롤 위치를 챙긴다. 여기서 하는 이유는
  //   render() 가 탭 말고도 불리기 때문이다 — darkMQ 의 change 리스너가 대표적이고
  //   (안드로이드 자동 다크 모드가 고르는 도중에 터진다), sheetBusy() 가 막는 것은
  //   원격 스냅샷뿐이다. 진입부에 두면 앞으로 생길 경로까지 공짜로 덮인다.
  saveJumpScroll();

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
  // ★ 손님도 state.user 가 차 있으므로 !state.user 만으로는 로그인 화면이 안 뜬다.
  //   showLogin 이 켜져 있을 때만 띄운다 — 손님이 설정에서 눌렀거나, 로그인이
  //   실패해 사유를 보여 줘야 하는 경우다.
  if (!state.user || state.showLogin) {
    document.getElementById('app').innerHTML = renderAuth() + (state.legal ? renderLegalSheet() : '');
    return;
  }

  // -- header ---------------------------------------------------------------
  // 월·요일 이름은 Intl 이 만든다. 여기 들어오는 값은 전부 화면용이다.
  // 연간 뷰의 축은 state.cy 하나다 — 월간처럼 selected 를 안 본다.
  const monthLabel = state.view === 'year' ? yearLabel(state.cy)
    : state.view === 'month' ? monthTitle(state.cy, state.cm)
    : monthTitle(selD.getFullYear(), selD.getMonth());
  const todayLabel = t('hdr.today', shortDay(todayD));

  // 하단 탭 바 넷. 아이콘 + 라벨 두 줄이다.
  // ★ svg 를 aria-hidden 으로 감싼다 — icon() 이 role="img" aria-label="calendar.month"
  //   를 달고 나오는데, 바로 옆에 '월' 이라는 글자가 이미 있어서 안 감추면 스크린
  //   리더가 "calendar.month, 월" 로 두 번 읽는다.
  const segments = ['year', 'month', 'week', 'day'].map((k) => {
    const on = state.view === k;
    return '<button class="seg' + (on ? ' seg-on' : '') + '" data-view="' + k +
      '" aria-pressed="' + on + '">' +
      '<span aria-hidden="true" style="display:flex">' + icon('calendar.' + k, 21) + '</span>' +
      '<span>' + esc(t('view.' + k)) + '</span></button>';
  }).join('');

  // ★ 손님은 role 이 'user' 로 채워져 있을 뿐 계정이 아니다 — isGuest() 로 먼저
  //   자른다. 안 자르면 손님에게 로그아웃 버튼이 보인다.
  const guestMode = isGuest();
  const isAdmin = !guestMode && state.user.role === 'admin';
  const pending = pendingUsers().length;
  const accountBar = '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:14px">' +
    // 손님에게는 이름표를 안 단다 — 붙일 이름이 없고, 옆의 '로그인' 버튼이
    // 로그인하지 않은 상태라는 걸 이미 말한다.
    (guestMode ? ''
      : '<span style="font-size:13px;font-weight:600;color:var(--label-secondary);background:var(--fill-quaternary);' +
        'padding:6px 12px;border-radius:999px">' + esc(state.user.name) +
        (isAdmin ? ' · ' + esc(t('hdr.admin')) : '') + '</span>') +
    (isAdmin ? '<button class="btn btn-gray btn-sm" data-act="admin">' + esc(t('hdr.signups')) +
      (pending ? '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;' +
        'padding:0 5px;margin-left:2px;border-radius:999px;background:#FF3B30;color:#fff;font-size:11px;font-weight:700">' +
        pending + '</span>' : '') + '</button>' : '') +
    '<button class="btn btn-gray btn-sm" data-act="settings">' + esc(t('hdr.settings')) + '</button>' +
    (guestMode
      ? '<button class="btn btn-gray btn-sm" data-act="openLogin" style="color:var(--tint);font-weight:700">' +
        esc(t('guest.login')) + '</button>'
      : '<button class="btn btn-gray btn-sm" data-act="logout">' + esc(t('hdr.logout')) + '</button>') + '</div>';

  let html = '<div style="max-width:1024px;margin:0 auto;padding:28px 16px 130px">' + accountBar +
    '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px">' +
      // 제목을 누르면 년·월 팝오버가 열린다. < > 로 한 칸씩 걸어가지 않아도 된다.
      // ★ position:relative 래퍼 — 팝오버가 top:100% 로 제목 바로 아래에 붙는다.
      //   화면이 좁아 헤더가 줄바꿈돼도 팝오버는 제목을 따라간다.
      '<div style="position:relative">' +
      '<button data-act="jump" aria-label="' + esc(t('jump.title')) + '" aria-expanded="' + !!state.jump +
        '" style="border:none;padding:0;margin:0;background:none;color:inherit;font:inherit;' +
        'text-align:left;cursor:pointer;display:block">' +
        '<div style="font-size:13px;font-weight:600;color:var(--tint)">' + esc(todayLabel) + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<h1 style="margin:2px 0 0;font-size:30px;font-weight:700;letter-spacing:.2px">' + esc(monthLabel) + '</h1>' +
          icon('chevron.up.chevron.down', 17, 'var(--label-tertiary)') +
        '</div>' +
      '</button>' + (state.jump ? renderJumpPopover() : '') + '</div>' +
      // ★ 년/월/주/일 선택은 여기 없다 — 화면 아래 떠 있는 캡슐 바로 옮겼다.
      //   엄지가 닿는 자리이기도 하고, 좁은 화면에서 헤더가 두 줄로 접히던 것도
      //   같이 사라진다. 아래 'floating tab bar' 블록이 같은 segments 를 쓴다.
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<div data-raise="glass" style="display:flex;gap:8px;align-items:center">' +
          '<button class="btn btn-glass btn-sm btn-icon" data-nav="prev" aria-label="' + esc(t('nav.prev')) + '">' + icon('chevron.left', 15) + '</button>' +
          '<button class="btn btn-glass btn-sm" data-nav="today">' + esc(t('nav.today')) + '</button>' +
          '<button class="btn btn-glass btn-sm btn-icon" data-nav="next" aria-label="' + esc(t('nav.next')) + '">' + icon('chevron.right', 15) + '</button>' +
          // 현재 뷰(월/주/일)를 그대로 이미지로 내보낸다. 버튼 하나가 세 뷰를 다 맡는다.
          // ★ 연간 뷰에서는 안 그린다 — export.js 의 drawExport 는 month/week/day 세
          //   갈래뿐이라 'year' 가 들어오면 주간 격자를 그린다(조용히 틀린 이미지).
          //   연간 내보내기를 붙일 때 이 조건을 지울 것.
          (state.view === 'year' ? '' :
            '<button class="btn btn-glass btn-sm" data-act="export" aria-label="' + esc(t('exp.title')) + '">' +
            esc(t('exp.btn')) + '</button>') +
        '</div>' +
      '</div>' +
    '</div>';

  // -- kind filter (할 일 / 일정) --------------------------------------------
  // 월간·주간에서만 그린다. 일간은 시간축에 둘을 같이 놓는 자리고, 연간은 목표만 그려서
  // 나눌 것이 없다 — kindFilter() 가 그 둘에서 state.kind 를 무시하므로 화면과 일치한다.
  // 칸 높이를 늘리는 대신 이 줄로 나눠 보는 것이 기간 일정의 밀림에 대한 답이다.
  // 3개 고정이라 flex:1 로 균등 분할한다(카테고리 줄은 최대 11개라 가로로 흘린다).
  if (state.view === 'month' || state.view === 'week') {
    const kchip = (v, label) => {
      const on = (state.kind || '') === v;
      return '<button class="seg' + (on ? ' seg-on' : '') + '" data-kind="' + v +
        '" aria-pressed="' + on + '" style="flex:1;min-width:0">' + esc(label) + '</button>';
    };
    html += '<div class="seg-wrap" style="margin-bottom:10px">' +
      kchip('', t('kind.all')) + kchip('todo', t('kind.todo')) + kchip('event', t('kind.event')) + '</div>';
  }

  // -- category filter ------------------------------------------------------
  // 카테고리가 하나도 없으면 줄 자체를 안 그린다 — '전체' 칩만 있는 줄은 정보가 0이다.
  // .seg-wrap / .seg 를 그대로 재사용한다 (새 CSS 규칙 0개 — 요일 선택 줄과 같은 방식).
  // 칩이 최대 11개(전체 + 팔레트 10)라 폰에서는 한 줄에 안 들어간다 → 가로로 흘린다.
  if (state.cats.length) {
    const chip = (id, label, color) => {
      const on = (state.filter || '') === id;
      return '<button class="seg' + (on ? ' seg-on' : '') + '" data-filter="' + esc(id) + '">' +
        (color ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;' +
          'margin-right:5px;background-color:' + color + '"></span>' : '') + esc(label) + '</button>';
    };
    // ★ width:max-content — 칩이 몇 개든 **딱 그만큼만** 차지한다. 이게 없으면 칩이
    //   두어 개일 때 캡슐 오른쪽이 회색으로 길게 비어, 바로 위 종류 줄(3칩이 폭을
    //   나눠 갖는다)과 나란히 놓였을 때 아래 줄만 덜 그려진 것처럼 보인다.
    //   max-width:100% 가 캡슐을 화면 안에 가두고, 넘치면 overflow-x 가 흘린다 —
    //   칩 11개(전체 + 팔레트 10)일 때의 동작은 그대로다.
    html += '<div class="seg-wrap no-scrollbar" style="width:max-content;overflow-x:auto;max-width:100%;margin-bottom:16px">' +
      chip('', t('cat.all'), '') +
      state.cats.map((c) => chip(c.id, c.name, c.color)).join('') + '</div>';
  }

  // -- view body ------------------------------------------------------------
  // 뷰 넷의 출력은 html 이 아니라 body 에 모은다 — 뷰가 바뀐 렌더에서만 진입
  // 애니메이션을 걸려면 그 조각만 따로 감쌀 수 있어야 한다(위 lastView 주석).
  // 아래 '선택한 날' 목록은 일부러 밖에 둔다: 뷰를 바꿔도 고른 날은 그대로라
  // 같이 움직이면 안 바뀐 것이 바뀐 것처럼 보인다.
  const viewChanged = lastView !== state.view;
  lastView = state.view;
  let body = '';

  // -- year view ------------------------------------------------------------
  // 목표만 그린다. 일일 할 일은 여기 안 들어온다 — 365일치를 한 화면에 올리면
  // 정작 "올해 안에 무엇을 이룰 것인가" 가 묻힌다. 아래 선택한 날 목록도 건너뛴다.
  if (state.view === 'year') {
    const gl = goalsIn(state.cy);
    const gLeft = gl.filter((g) => !g.done).length;
    const gRemain = gl.length === 0 ? '' : gLeft === 0 ? t('goal.allDone') : t('goal.remain', gLeft);

    // 줄 모양은 아래 '선택한 날' 목록과 같다 — 체크 · 제목/메모 · 배지 · 화살표.
    // 새 CSS 규칙 없이 .row-title / .trunc / .card 를 그대로 쓴다.
    const goalRows = gl.length ? gl.map((g, i) => {
      const c = catOf(g).color;
      const done = !!g.done;
      const open = 'data-goal="' + esc(g.id) + '"';
      return '<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-top:' +
        (i === 0 ? 'none' : '.5px solid var(--separator)') + '">' +
        '<button data-gtoggle="' + esc(g.id) + '" aria-label="' + esc(t('goal.check')) + '" aria-pressed="' + done + '" ' +
          'style="width:24px;height:24px;border-radius:50%;flex:none;cursor:pointer;padding:0;display:flex;' +
          'align-items:center;justify-content:center;border:2px solid ' + (done ? c : 'var(--label-quaternary)') +
          ';background-color:' + (done ? c : 'transparent') + ';transition:all .15s ease">' +
          (done ? icon('checkmark', 13, '#ffffff') : '') + '</button>' +
        '<div ' + open + ' style="flex:1;min-width:0;cursor:pointer">' +
          '<div class="row-title" style="text-decoration:' + (done ? 'line-through' : 'none') +
            ';opacity:' + (done ? 0.45 : 1) + '">' + esc(g.title) + '</div>' +
          (g.memo ? '<div class="trunc" style="font-size:13px;color:var(--label-secondary);margin-top:1px">' +
            esc(g.memo) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex:none">' +
          '<span style="font-size:11px;font-weight:600;color:' + c + ';padding:3px 8px;border-radius:999px;' +
            'background-color:color-mix(in srgb, ' + c + ' 16%, transparent)">' + esc(goalDue(g)) + '</span>' +
          '<span ' + open + ' style="cursor:pointer;color:var(--label-tertiary);display:flex">' +
            icon('chevron.right', 15) + '</span>' +
        '</div></div>';
    }).join('')
      : '<div style="padding:34px 16px;text-align:center">' +
        '<div style="font-size:15px;font-weight:600;color:var(--label-secondary)">' + esc(t('goal.empty')) + '</div>' +
        '<div style="font-size:13px;color:var(--label-tertiary);margin-top:3px">' + esc(t('goal.emptyHint')) + '</div></div>';

    // 12칸 요약. **그 달 목표만** 센다 — 일일 할 일은 한 개도 안 들어간다.
    // 완료한 목표도 센다: "그 달 전체 목표" 가 개수의 뜻이다.
    // ★ 눌러도 뷰만 월간으로 바뀐다. 목표는 월간 달력에 안 나오므로 여기서
    //   가는 곳은 그 달의 **할 일** 화면이다 — 목표는 이 목록에서만 본다.
    let months = '';
    for (let i = 0; i < 12; i++) {
      const n = gl.filter((g) => g.scope === 'month' && g.m === i).length;
      months += '<button data-ym="' + i + '" style="border:none;cursor:pointer;font-family:inherit;' +
        'padding:14px 6px;border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:3px;' +
        'background-color:' + (n ? 'color-mix(in srgb, var(--tint) 9%, transparent)' : 'var(--fill-quaternary)') + '">' +
        '<span class="trunc" style="max-width:100%;font-size:13px;font-weight:600;color:var(--label)">' +
          esc(monthShort(i)) + '</span>' +
        '<span style="font-size:12px;font-weight:600;color:' + (n ? 'var(--tint)' : 'var(--label-tertiary)') + '">' +
          esc(n ? t('goal.count', n) : '–') + '</span></button>';
    }

    body += '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:0 4px 10px">' +
        '<h2 style="margin:0;font-size:20px;font-weight:700">' + esc(t('goal.title')) + '</h2>' +
        '<span style="font-size:13px;font-weight:500;color:var(--label-secondary)">' + esc(gRemain) + '</span></div>' +
      '<div class="card" style="border-radius:16px;border:.5px solid var(--separator);overflow:hidden">' +
        goalRows + '</div>' +
      '<div style="margin:22px 4px 10px;font-size:20px;font-weight:700">' + esc(t('goal.months')) + '</div>' +
      // minmax(0,1fr) — 월 이름이 긴 로케일에서도 4열이 화면 밖으로 안 밀린다.
      '<div class="card" style="border:.5px solid var(--separator);padding:12px;display:grid;' +
        'grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">' + months + '</div>';
  }

  // -- month view -----------------------------------------------------------
  if (state.view === 'month') {
    const heads = dow().map((l, i) =>
      '<div style="text-align:center;padding:11px 0 9px;font-size:12px;font-weight:600;color:' +
      (i === 0 ? '#FF3B30' : i === 6 ? 'var(--tint)' : 'var(--label-secondary)') + '">' + l + '</div>').join('');

    const startOffset = new Date(state.cy, state.cm, 1).getDay();
    const dim = new Date(state.cy, state.cm + 1, 0).getDate();
    const weeks = Math.ceil((startOffset + dim) / 7);
    // ★ 42칸 한 격자가 아니라 **주마다 한 덩어리**다. 기간 일정 막대가 여러 칸에 걸치는데,
    //   한 격자로는 그 위에 겹칠 층을 붙일 자리가 없다(칸은 .cell{overflow:hidden}).
    //   주 덩어리 = position:relative 안에 [7칸 격자] + [그 위에 겹치는 막대 층].
    const byId = {};
    items.forEach((it) => { byId[it.id] = it; });

    let grid = '';
    for (let w = 0; w < weeks; w++) {
      const ws = fmt(new Date(state.cy, state.cm, 1 - startOffset + w * 7));
      const rows = weekEventBars(items, ws);
      const shown = rows.filter((r) => r.lane < MONTH_LANES);
      const lanes = lanesOf(shown);
      const extra = barOverflow(rows, MONTH_LANES);

      let cells = '';
      for (let i = 0; i < 7; i++) {
        const d = new Date(state.cy, state.cm, 1 - startOffset + w * 7 + i);
        const ds = fmt(d);
        const inM = d.getMonth() === state.cm;
        const isToday = ds === today, isSel = ds === sel;
        const list = cellItems(items, ds);
        const pills = list.slice(0, 3).map((it) => {
          const p = pill(it, ds);
          return '<div class="pill" ' + openAttr(p, ds) + ' style="cursor:pointer;background:' + p.bg + ';color:' + p.color +
            ';text-decoration:' + p.deco + ';opacity:' + p.op + '">' + esc(p.title) + '</div>';
        }).join('');
        const hid = Math.max(0, list.length - 3) + extra[i];
        const more = hid
          ? '<div style="font-size:10px;color:var(--label-tertiary);padding:0 6px">' +
            esc(t('cell.more', hid)) + '</div>' : '';
        // ★ 막대 자리를 칸 안에 **실제 높이로** 비운다. 한 주의 7칸이 같은 값을 비우므로
        //   알약 시작 줄이 안 어긋나고, 막대 층의 높이(lanes×BAR_ROW)와도 정확히 같다.
        //   일정이 없는 주는 lanes=0 → 이 div 자체가 없어 예전 화면과 픽셀까지 같다.
        cells += '<div class="cell" data-day="' + ds + '" style="background:' +
          (isSel ? 'color-mix(in srgb, var(--tint) 7%, transparent)' : 'transparent') + ';opacity:' + (inM ? 1 : 0.35) + '">' +
          '<div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
            // ★ 오른쪽 정렬이다(사용자 요청, **월간 뷰만**). 주간 뷰의 날짜는 머리
            //   줄 한가운데라 그대로 두었다. auto 를 왼쪽 마진에 몰아 오른쪽으로 민다.
            //   높이(26)와 아래 여백(4)은 안 건드렸다 — barSpacer 가 그 둘을 그대로
            //   베껴 막대 층의 시작 y 를 맞춘다. 정렬만 바뀌고 자리 계산은 그대로다.
            'font-size:13px;margin:0 0 4px auto;font-weight:' + (isToday || isSel ? 700 : 500) +
            ';background:' + (isToday ? 'var(--tint)' : 'transparent') +
            ';color:' + (isToday ? '#fff' : d.getDay() === 0 ? '#FF3B30' : d.getDay() === 6 ? 'var(--tint)' : 'var(--label)') + '">' +
            d.getDate() + '</div>' +
          (lanes ? '<div data-barspace style="height:' + (lanes * BAR_ROW) + 'px"></div>' : '') +
          '<div style="display:flex;flex-direction:column;gap:2px">' + pills + more + '</div></div>';
      }

      // 막대 층. pointer-events 를 끄고 막대만 다시 켠다 — 막대 사이 빈 자리를 누르면
      // 아래 칸이 눌려야 한다(날짜 선택). 안 그러면 층이 칸의 절반을 덮어 먹는다.
      const bars = lanes ? '<div data-bars="' + ws + '" style="position:absolute;left:0;right:0;top:0;' +
        'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:auto repeat(' +
        lanes + ',' + BAR_ROW + 'px);pointer-events:none">' + barSpacer +
        shown.map((r) => barHtml(r, byId[r.id])).join('') + '</div>' : '';
      grid += '<div style="position:relative">' +
        '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">' + cells + '</div>' +
        bars + '</div>';
    }
    // 7열은 minmax(0,1fr). 1fr(=minmax(auto,1fr))은 열이 자식의 min-content 보다
    // 작아지지 못해, nowrap 제목 하나가 나머지 요일을 화면 밖으로 밀어낸다.
    // 월간은 .cell{overflow:hidden} 덕에 지금도 안 깨지지만 같은 요구사항이니
    // 같은 방식으로 적어 둔다 — .cell 을 건드려도 안 터지게.
    body += '<div class="card" style="border:.5px solid var(--separator);overflow:hidden">' +
      '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">' + heads + '</div>' +
      grid + '</div>';
  }

  // -- week view ------------------------------------------------------------
  if (state.view === 'week') {
    // 주 시작은 일요일 고정이다. Intl 은 이름만 주고 배열 순서는 getDay() 색인.
    const wdow = dow();
    const ws = addDays(sel, -selD.getDay());
    // ★ 열 하나가 [머리 + 본문] 을 통째로 들던 것을 [머리 줄] · [막대 띠] · [본문 줄]
    //   셋으로 갈랐다 — 기간 막대는 열을 가로지르므로 열 안에 넣을 수가 없다.
    //   막대가 없으면 띠 자체를 안 그려서 예전과 같은 화면이 된다.
    const byId = {};
    items.forEach((it) => { byId[it.id] = it; });
    const wrows = weekEventBars(items, ws);
    const wshown = wrows.filter((r) => r.lane < WEEK_LANES);
    const wlanes = lanesOf(wshown);
    const wextra = barOverflow(wrows, WEEK_LANES);

    let heads = '', cols = '';
    for (let i = 0; i < 7; i++) {
      const ds = addDays(ws, i);
      const d = parse(ds);
      const isToday = ds === today, isSel = ds === sel;
      const edge = i === 0 ? 'none' : '.5px solid var(--separator)';
      // 월간(3개)과 같은 이유로 접는다 — 안 접으면 17개짜리 날이 칸을 713px 로 늘린다.
      // ★ 시간 라벨을 뺐다(사용자 요청). 폰에서 열이 51px 라 '하루 종일' 이 두 줄로
      //   접혀 항목 하나가 48px 을 먹었고, 그 줄이 정보를 준 만큼 자리를 안 갚았다.
      //   → 항목이 한 줄이 되면서 접기 기준을 5에서 다시 쟀다.
      // WEEK_FIT=7 의 근거(실측, 360px · 본문 min-height 256 − padding 12 = **244** 가 한도):
      //   항목 한 줄 = padding 4+4 + 11px 글자 한 줄. line-height 를 안 걸어서 글꼴이 정한다.
      //     ko/en 기본 글꼴  항목 21 · `+N개` 12 → 7개 187 · 8개 212
      //     serif 폴백(ko)   항목 24 · `+N개` 15 → 7개 211 · 8개 239
      //     serif 폴백(en) ← 최악. **`+N개` 가 46.6px 열에서 두 줄로 접혀 30**
      //                      항목 24 → 7개 **226** · 8개 **254(초과)**
      //   → 세 조합 전부 통과하는 최대가 7이다. 8은 최악 조합에서만 10px 넘친다.
      // ★ 글꼴·글자 크기·패딩을 바꾸거나 라벨을 되살리면 이 7을 **다시 잴 것**.
      const list = cellItems(items, ds);
      const pills = list.slice(0, WEEK_FIT).map((it) => {
        const p = pill(it, ds);
        return '<div ' + openAttr(p, ds) + ' style="cursor:pointer;padding:4px 7px;border-radius:6px;background:' +
          p.bg + ';opacity:' + p.op + '">' +
          '<div class="trunc" style="font-size:11px;font-weight:600;color:' + p.color + ';text-decoration:' + p.deco + '">' +
          esc(p.title) + '</div></div>';
      }).join('');
      // ★ data-day 를 여기 직접 단다. 월간은 부모 .cell 이 들고 있어 `+N개` 가 공짜로
      //   날짜 선택이 되지만, 주간은 헤더에만 있어서 본문에 두면 눌러도 안 먹는다.
      //   동작은 월간과 같다 — 그 날을 고르고 하단 리스트만 바뀐다(뷰 전환 아님).
      const hid = Math.max(0, list.length - WEEK_FIT) + wextra[i];
      const more = hid
        ? '<div data-day="' + ds + '" style="cursor:pointer;font-size:10px;color:var(--label-tertiary);padding:0 7px">' +
          esc(t('cell.more', hid)) + '</div>' : '';
      heads += '<div data-day="' + ds + '" style="cursor:pointer;text-align:center;padding:10px 4px 8px;' +
          'border-left:' + edge + ';border-bottom:.5px solid var(--separator)">' +
          '<div style="font-size:11px;font-weight:600;color:' +
            (i === 0 ? '#FF3B30' : i === 6 ? 'var(--tint)' : 'var(--label-secondary)') + '">' + esc(wdow[i]) + '</div>' +
          '<div style="width:28px;height:28px;margin:4px auto 0;border-radius:50%;display:flex;align-items:center;' +
            'justify-content:center;font-size:15px;font-weight:600;background:' +
            (isToday ? 'var(--tint)' : isSel ? 'var(--fill-tertiary)' : 'transparent') +
            ';color:' + (isToday ? '#fff' : 'var(--label)') + '">' + d.getDate() + '</div></div>';
      // min-height 는 예전 320(머리+본문)에서 머리 몫을 뺀 값이다. 머리 줄이 밖으로
      // 나갔으니 여기 320 을 그대로 두면 열이 통째로 64px 길어진다.
      // ★ 64 는 실측이다 — 위 머리 줄의 padding 10+8 · 라벨 11px/600 한 줄 · 여백 4 · 원 28.
      //   글꼴이나 저 숫자들을 바꾸면 다시 재서 이 256 을 고칠 것('5개' 근거가 여기 걸려 있다).
      cols += '<div style="min-height:256px;border-left:' + edge +
        ';padding:6px 5px;display:flex;flex-direction:column;gap:4px">' + pills + more + '</div>';
    }
    // 막대 띠. 열 위에 가로로 눕는 별도 줄이다 — 하루짜리 일정도 여기 뜬다.
    // ★ 첫 줄이 0 인 이유: barHtml 이 월간의 자리 맞추기 줄(barSpacer) 때문에 2번
    //   줄부터 쓴다. 여기는 맞출 것이 없으니 그 줄을 0 으로 접는다 — 막대 한 조각을
    //   두 화면이 **같은 함수**로 그리게 하려고 치르는 값이다.
    const wbars = wlanes ? '<div data-bars="' + ws + '" style="display:grid;padding:5px 0;' +
      'grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:0 repeat(' + wlanes + ',' + BAR_ROW +
      'px);border-bottom:.5px solid var(--separator)">' +
      wshown.map((r) => barHtml(r, byId[r.id])).join('') + '</div>' : '';
    // ★ minmax(0,1fr) 이라야 한다. 1fr 이면 긴 제목(.trunc = nowrap)의 min-content 가
    //   그 열을 밀어내 목·금·토가 화면 밖으로 나가고, overflow:hidden 이라 스크롤도 안 된다.
    const g7 = '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">';
    body += '<div class="card" style="border:.5px solid var(--separator);overflow:hidden">' +
      g7 + heads + '</div>' + wbars + g7 + cols + '</div></div>';
  }

  // -- day view -------------------------------------------------------------
  if (state.view === 'day') {
    // 여러 날 일정은 그 날이 회차의 어디냐에 따라 모양이 다르다 — dayShape() 참고.
    const dayList = itemsOn(items, sel, SHOW_COMPLETED).map((it) => dayShape(it, sel));
    const allDay = dayList.filter((it) => !it.time).map((it) => {
      const p = pill(it, sel);
      return '<div ' + openAttr(p, sel) + ' style="cursor:pointer;font-size:12px;font-weight:600;padding:5px 11px;' +
        'border-radius:999px;background:' + p.bg + ';color:' + p.color + ';text-decoration:' + p.deco +
        ';opacity:' + p.op + '">' + esc(p.title) + '</div>';
    }).join('');
    const allDayBlock = allDay
      ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + allDay + '</div>' : '';

    // 시간축은 데이터가 정한다 — 그날 가장 이른 시각 ~ 가장 늦은 시각.
    // 시간 항목이 하나도 없으면 축 자체를 안 그린다(6시~24시 눈금은 정보가 0이다).
    const timedItems = dayList.filter((it) => it.time);
    const range = dayRange(timedItems);

    let axis = '';
    if (range) {
      // 눈금은 흐름이 아니라 절대 배치다 — 블록과 같은 좌표계를 쓰고, selftest 가
      // 마지막 눈금의 top 을 읽어 축 높이와 맞는지 볼 수 있다.
      let ticks = '';
      for (let h = range.startMin / 60; h < range.endMin / 60; h++) {
        ticks += '<div data-hr="' + h + '" style="position:absolute;left:0;right:0;display:flex;gap:8px;' +
          'align-items:flex-start;top:' + ((h - range.startMin / 60) * range.pxPerHour) + 'px">' +
          // 눈금 라벨은 늘 'HH:00' 5글자다(로케일을 안 탄다). 공백이 없어 두 줄이 될 수는
          // 없지만 CDN 폰트가 늦어 시스템 폰트로 그려지면 42px 을 넘칠 수 있다 — .trunc 로
          // 축 폭 안에 가둔다. 최악이 '두 줄'이 아니라 '말줄임'이어야 한다.
          '<div class="trunc" style="width:42px;text-align:right;font-size:11px;color:var(--label-tertiary);transform:translateY(-6px)">' +
          pad(h) + ':00</div><div style="flex:1;border-top:.5px solid var(--separator)"></div></div>';
      }

      // 현재 시각 선은 **보고 있는 날이 오늘이고** 지금이 축 범위 안일 때만.
      // 범위가 유동이라 어제를 볼 때뿐 아니라 09~12시 축에 14:00 이 새는 것도 막는다.
      const n = new Date();
      const nowMin = n.getHours() * 60 + n.getMinutes();
      let nowLine = '';
      if (sel === today && nowMin >= range.startMin && nowMin <= range.endMin) {
        const top = (nowMin - range.startMin) * range.pxPerHour / 60;
        nowLine = '<div data-now style="position:absolute;left:' + (DAY_PX.axisW - 6) +
          'px;right:0;height:2px;border-radius:1px;background-color:#FF3B30;z-index:2;top:' + top + 'px">' +
          '<div style="position:absolute;left:-5px;top:-3px;width:8px;height:8px;border-radius:50%;' +
          'background-color:#FF3B30"></div></div>';
      }

      const placed = dayLayout(timedItems, range);
      const byId = {};
      timedItems.forEach((it) => { byId[it.id] = it; });
      const vw = document.documentElement.clientWidth;

      const blocks = placed.map((b) => {
        const it = byId[b.id];
        const p = pill(it, sel);
        const tier = blockTier(dayColW(vw, b.cols), b.height);
        // 폭 계산에는 손대지 않는다(calc 로 gap 을 빼면 selftest 의 문자열 단언이 깨진다).
        // 인접한 열은 카드 배경색 2px 로 가른다 — .card 가 var(--bg) 라 **같은 토큰**이고,
        // 블록 배경이 반투명이라 그 자리만 카드색이 드러나 밝은/어두운 양쪽에서 맞는다.
        // 겹치지 않는 날(cols===1)과 마지막 열에는 안 붙인다 — 기존 화면이 그대로다.
        const gap = (b.cols > 1 && b.col < b.cols - 1) ? ';border-right:2px solid var(--bg)' : '';
        // overflow:hidden 은 취향이 아니라 안전장치다 — 높이는 BLOCK_MIN_H/MARK_H 로 고정인데
        // 글자 높이는 글꼴이 정한다(line-height 를 안 건다). CDN 이 늦어 폴백으로 그려지면
        // 한 줄이 29.2px 까지 커지므로, 최악에도 블록 **밖**으로는 절대 안 나가게 잘라 둔다.
        const pos = 'position:absolute;overflow:hidden;left:' + pct(b.col * 100 / b.cols) + ';width:' + pct(100 / b.cols) +
          ';top:' + b.top + 'px;height:' + b.height + 'px;cursor:pointer;opacity:' + p.op + gap;

        // 종료가 없는 항목은 블록이 아니라 얇은 마커다 — 없는 길이를 지어내지 않는다.
        if (b.marker) {
          return '<div ' + openAttr(p, sel) + ' data-block="' + esc(b.id) + '" style="' + pos +
            ';border-top:2px solid ' + p.color + ';padding:3px 6px 0">' +
            '<div class="trunc" style="font-size:11px;font-weight:600;color:' + p.color +
            ';text-decoration:' + p.deco + '">' + esc(p.title) + '</div></div>';
        }
        const body = tier === 'bar'
          ? '<div class="trunc" style="font-size:10px;font-weight:600;color:' + p.color +
            ';text-decoration:' + p.deco + '">' + esc(p.title) + '</div>'
          : '<div class="trunc" style="font-size:13px;font-weight:600;color:' + p.color +
            ';text-decoration:' + p.deco + '">' + esc(p.title) + '</div>' +
            (tier === 'full' ? '<div class="trunc" style="font-size:11px;color:' + p.color +
              ';opacity:.75">' + esc(p.range) + '</div>' : '');
        return '<div ' + openAttr(p, sel) + ' data-block="' + esc(b.id) + '" style="' + pos +
          // 좌우 패딩 8 은 위 T_FULL 산식(inset 21)의 일부다 — 같이 고칠 것.
          ';border-radius:9px;padding:5px ' + (tier === 'bar' ? 4 : 8) + 'px;background-color:' + p.bg +
          ';border-left:3px solid ' + p.color + '">' + body + '</div>';
      }).join('');

      axis = '<div style="position:relative;height:' + range.h + 'px">' + ticks + nowLine +
        '<div style="position:absolute;left:' + DAY_PX.axisW + 'px;right:' + DAY_PX.gutter +
        'px;top:0;bottom:0">' + blocks + '</div></div>';
    } else {
      axis = '<div style="padding:22px 0;text-align:center;font-size:14px;color:var(--label-tertiary)">' +
        esc(t('day.noTimed')) + '</div>';
    }

    // ⚠️ 이 카드의 padding 16 은 DAY_PX.cardPad 와 같은 값이어야 한다(위 주석).
    body += '<div class="card" style="border:.5px solid var(--separator);padding:16px 16px 20px">' + allDayBlock +
      axis + '</div>';
  }

  // 감싸는 div 는 **늘** 있다. 애니메이션이 붙을 때만 생기게 하면 DOM 모양이 렌더마다
  // 달라져서, 그 위치를 짚는 selftest·CSS 가 어느 쪽 기준인지 알 수 없게 된다.
  html += '<div' + (viewChanged ? ' class="view-in"' : '') + '>' + body + '</div>';

  // -- selected day list ----------------------------------------------------
  const selAll = itemsOn(items, sel, true);
  // ★ 여기서만 일정 → 할 일로 묶는다(eventsFirst 주석 참고). 아래 남은 개수·제목은
  //   차례를 안 보므로 영향이 없고, 바뀌는 것은 그려지는 줄의 순서뿐이다.
  const selShown = eventsFirst(SHOW_COMPLETED ? selAll : selAll.filter((it) => !isDone(it, sel)));
  // ★ 남은 개수는 **할 일만** 센다. 일정에는 완료 체크가 없어서(=영원히 안 끝난다)
  //   같이 세면 일정만 있는 날이 "2개 남음" 으로 굳는다. 일정뿐인 날은 라벨이 없다.
  const selTodos = selAll.filter((it) => !isEvent(it));
  const remaining = selTodos.filter((it) => !isDone(it, sel)).length;
  const selectedTitle = (sel === today ? t('list.todayPrefix') : '') + dayTitle(selD);
  const remainLabel = selTodos.length === 0 ? '' : remaining === 0 ? t('list.allDone') : t('list.remain', remaining);

  let listHtml;
  if (selShown.length) {
    // 종류가 바뀌는 줄. 굵은 선은 **여기 한 곳**에만 간다.
    // ★ 한쪽 종류만 있는 날은 findIndex 가 -1(할 일 없음) 또는 0(일정 없음)이라
    //   어느 줄과도 안 맞는다 — 0 은 아래에서 첫 줄 규칙('none')이 먼저 가져간다.
    const splitAt = selShown.findIndex((it) => !isEvent(it));
    // 두 무리의 크기. 손잡이를 그릴지 정하는 데만 쓴다 — 끌기는 제 무리 안에서만
    // 되므로, 무리에 줄이 하나뿐이면 손잡이가 있어도 갈 곳이 없다.
    const evCount = splitAt < 0 ? selShown.length : splitAt;
    listHtml = selShown.map((it, idx) => {
      const c = catOf(it).color;
      const done = isDone(it, sel);
      const evt = isEvent(it);
      const groupSize = evt ? evCount : selShown.length - evCount;
      // 여러 날 일정의 가운데를 눌러도 시작 날짜가 그리로 옮겨가면 안 된다 (pill.openDs).
      const open = 'data-open="' + esc(it.id) + '" data-ds="' + (occStart(it, sel) || sel) + '"';
      // ★ data-itemdrag / data-itemkind 는 순서 끌기가 읽는다(todo.js 의 itemDragCfg).
      //   kind 가 필요한 이유는 **경계** 때문이다 — 같은 종류가 이어지는 구간 밖으로는
      //   못 나간다. user-select:none 이 없으면 길게 누르는 400ms 동안 안드로이드가
      //   글자를 선택하고 복사 메뉴를 띄워서 끌기가 시작도 못 한다(카테고리와 같다).
      return '<div data-itemdrag="' + esc(it.id) + '" data-itemkind="' + (evt ? 'event' : 'todo') +
        '" style="display:flex;align-items:center;gap:12px;padding:13px 16px;' +
        'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;border-top:' +
        (idx === 0 ? 'none' : idx === splitAt ? '3px solid var(--separator)'
          : '.5px solid var(--separator)') + '">' +
        // ★ 일정에는 체크 버튼을 안 그린다 — 완료라는 개념이 없다. 대신 같은 24px
        //   자리에 네모 점을 둬서 줄이 안 어긋나고, 동그라미가 아니라서 "눌러도
        //   안 되는 것" 이 모양으로 읽힌다.
        (evt
          ? '<span aria-hidden="true" style="width:24px;height:24px;flex:none;display:flex;' +
            'align-items:center;justify-content:center">' +
            '<span style="width:12px;height:12px;border-radius:4px;background-color:' + c + '"></span></span>'
          : '<button data-toggle="' + esc(it.id) + '" aria-label="' + esc(t('list.check')) + '" aria-pressed="' + done + '" ' +
            'style="width:24px;height:24px;border-radius:50%;flex:none;cursor:pointer;padding:0;display:flex;' +
            'align-items:center;justify-content:center;border:2px solid ' + (done ? c : 'var(--label-quaternary)') +
            ';background:' + (done ? c : 'transparent') + ';transition:all .15s ease">' +
            (done ? icon('checkmark', 13, '#ffffff') : '') + '</button>') +
        '<div ' + open + ' style="flex:1;min-width:0;cursor:pointer">' +
          '<div class="row-title" style="text-decoration:' + (done ? 'line-through' : 'none') +
            ';opacity:' + (done ? 0.45 : 1) + '">' + esc(it.title) + '</div>' +
          subLine(it) +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex:none">' +
          // 여러 날 배지. 시각 라벨만 있으면 '09:00–18:00' 이 하루 안의 범위로 읽힌다.
          (spanOf(it) > 1
            ? '<span style="font-size:11px;font-weight:600;color:' + c + ';padding:3px 8px;border-radius:999px;' +
              'background-color:color-mix(in srgb, ' + c + ' 16%, transparent)">' +
              esc(t('form.spanDays', spanOf(it))) + '</span>' : '') +
          (it.repeat && it.repeat !== 'none'
            ? '<span style="font-size:11px;font-weight:600;color:var(--label-secondary);background:var(--fill-quaternary);' +
              'padding:3px 8px;border-radius:999px">' + esc(repLabel(it.repeat, it.days)) + '</span>' : '') +
          (it.time ? '<span style="font-size:13px;font-weight:500;color:var(--label-secondary);' +
            'font-variant-numeric:tabular-nums">' + esc(timeRange(it.time, it.endTime || '')) + '</span>' : '') +
          // 순서 손잡이. 카테고리 목록과 **같은 규칙**이다 — 누르면 즉시 잡히고, 위아래
          // padding 과 같은 크기의 음수 margin 이 짝이라 누르는 띠만 넓히고 줄 높이는
          // 안 움직인다. touch-action:none 이 없으면 폰에서 손잡이 위에서 시작한 손짓을
          // 브라우저가 스크롤로 먼저 채 간다.
          // ★ 제 무리에 혼자면 안 그린다 — 끌 데가 없는 손잡이는 눌러도 아무 일이 없어
          //   고장으로 읽힌다(일정과 할 일 무리는 서로 못 넘는다).
          (groupSize > 1
            ? '<span data-draghandle aria-hidden="true" style="color:var(--label-quaternary);' +
              'display:flex;cursor:grab;touch-action:none;padding:10px 0;margin:-10px 0">' +
              icon('line.3.horizontal', 15) + '</span>' : '') +
          '<span ' + open + ' style="cursor:pointer;color:var(--label-tertiary);display:flex">' +
            icon('chevron.right', 15) + '</span>' +
        '</div></div>';
    }).join('');
  } else {
    listHtml = '<div style="padding:34px 16px;text-align:center">' +
      '<div style="font-size:15px;font-weight:600;color:var(--label-secondary)">' + esc(t('list.empty')) + '</div>' +
      '<div style="font-size:13px;color:var(--label-tertiary);margin-top:3px">' + esc(t('list.emptyHint')) + '</div></div>';
  }

  // ★ 연간 뷰에는 이 목록을 안 붙인다 — 그 화면은 목표 전용이고 일일 할 일이
  //   한 개도 들어가지 않는다(위 year view 주석). 위 계산은 그대로 두는 게 싸다.
  if (state.view !== 'year') html += '<div style="margin-top:22px">' +
    '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:0 4px 10px">' +
      '<h2 style="margin:0;font-size:20px;font-weight:700">' + esc(selectedTitle) + '</h2>' +
      '<span style="font-size:13px;font-weight:500;color:var(--label-secondary)">' + esc(remainLabel) + '</span></div>' +
    '<div class="card" style="border-radius:16px;border:.5px solid var(--separator);' +
      'overflow:hidden">' + listHtml + '</div></div>';

  // -- 말씀 한 구절 ----------------------------------------------------------
  // 본문의 **맨 마지막**이다 — 아래 떠 있는 캡슐 바 바로 위에 놓인다(page 의
  // padding-bottom 130px 이 그 자리를 비워 둔다).
  // ★ 네 화면 모두에 그린다. 어느 뷰의 부속이 아니라 화면을 닫는 문장이다.
  // ★ 본문과 출처의 회색을 한 단계 다르게 둔다. 같은 톤이면 출처가 본문처럼 읽힌다.
  // ★ 언어가 엇갈려 있다(한국어 화면 = 영문 본문). i18n.js 의 주석을 볼 것 — 의도된 것이다.
  html += '<div data-verse style="text-align:center;margin:26px 0 0;padding:0 8px">' +
    // ★ text-wrap:balance — 줄 길이를 고르게 나눈다. 없으면 폰에서 마지막 줄만
    //   짧게 남아(301/321/212px, 실측) 문장이 흘러내린 것처럼 보인다.
    //   글꼴·크기·색은 건드리지 않는다. 줄 나누기만 바꾼다.
    '<p style="margin:0 auto;max-width:620px;font-size:13px;line-height:1.8;' +
      'text-wrap:balance;color:var(--label-secondary)">' +
      t('verse.text').split('\n').map(esc).join('<br>') + '</p>' +
    '<div style="margin-top:6px;font-size:12px;font-weight:600;letter-spacing:.3px;' +
      'color:var(--label-tertiary)">' + esc(t('verse.ref')) + '</div></div>';

  html += '</div>'; // /page

  // -- floating tab bar + add button ----------------------------------------
  // ★ 연간 뷰에서는 **목표**를 추가한다. 그 화면에 할 일을 넣으면 어느 날짜에
  //   붙는지 알 수 없고(연간 뷰에는 선택한 날이 없다), 넣어도 화면에 안 보인다.
  const addYear = state.view === 'year';
  // + 는 캡슐 **밖**의 원이다. 안에 넣으면 '다섯 번째 뷰'처럼 보인다.
  // ★ pointer-events 를 바깥 래퍼에서 끄고 두 조각에서만 켠다 — 래퍼는 가운데
  //   정렬을 위해 화면 폭을 다 차지하므로, 안 끄면 하단 띠 전체가 탭을 먹어
  //   그 자리에 있는 할 일 줄이 안 눌린다.
  // ★ min-width:0 + overflow-x:auto — en 처럼 라벨이 길어져 캡슐이 좁은 화면에
  //   안 들어가면 캡슐 **안에서** 가로로 흐른다(페이지는 안 밀린다).
  html += '<div style="position:fixed;left:0;right:0;bottom:22px;z-index:60;display:flex;' +
    'justify-content:center;align-items:center;gap:12px;padding:0 10px;pointer-events:none">' +
    '<div class="tabbar' + (viewChanged ? ' tabbar-anim' : '') +
      '" style="pointer-events:auto;min-width:0;overflow-x:auto">' + segments + '</div>' +
    '<span data-raise="tint" style="pointer-events:auto;display:flex;flex:none">' +
      '<button class="btn btn-prominent btn-lg btn-icon" data-act="' + (addYear ? 'goalNew' : 'open') +
      '" aria-label="' + esc(t(addYear ? 'goal.add' : 'item.add')) + '">' +
      icon('plus', 20) + '</button></span></div>';

  // -- form sheet -----------------------------------------------------------
  if (state.showForm) html += renderSheet();
  if (state.showAdmin && isAdmin) html += renderAdminSheet();
  if (state.showSettings) html += renderSettingsSheet();
  if (state.showCats) html += renderCatSheet();
  if (state.goalDraft) html += renderGoalSheet();
  if (state.exp) html += renderExportSheet();
  // 점프는 바텀 시트가 아니라 제목 아래 팝오버다 — 위 헤더 안에 이미 들어가 있다.
  // 백드롭만 여기서 덧붙인다 (팝오버보다 뒤에 와야 z-index 없이도 순서가 맞다).
  if (state.jump) html += '<div data-act="closeJump" style="position:fixed;inset:0;z-index:69"></div>';

  document.getElementById('app').innerHTML = html;
  applyJumpScroll();
  // ★ 반드시 innerHTML 뒤다 — 재려면 줄이 이미 문서에 붙어 있어야 한다.
  syncMemoBtns();
}

// ---------------------------------------------------------------- 점프 팝오버
// 제목 아래에 붙는 두 열 스크롤 피커. 바텀 시트가 아니다 — 21+12개를 전부 펼치면
// 화면 절반을 먹고 정작 자주 쓰는 현재 연도가 묻힌다.
//
// ★ 스크롤은 선택이 아니다. 항목을 **탭해야** 임시 선택이 바뀌고, [이동] 을 눌러야
//   달력이 움직인다. 가운데 오는 항목이 자동 선택되는 휠 방식은 오조작이 잦다.
const J_ITEM = 44;          // 한 칸 높이. iOS 최소 터치 타깃이자 .btn-md 와 같다
const J_VISIBLE = 5;        // 보이는 칸 수. 홀수라 선택 항목 위아래로 2칸씩 남는다
const J_COL = J_ITEM * J_VISIBLE;

function openJump() {
  // ★ 임시 선택이다. 확정 전까지 state.cy/cm 을 건드리지 않는다.
  state.jump = { y: state.cy, m: state.cm, sy: null, sm: null };
  render();
}
function closeJump() {
  state.jump = null;   // 고르던 값은 버린다
  render();            // ★ sheetBusy() 로 밀려 있던 원격 스냅샷 변경을 여기서 반영
}
function applyJump() {
  const j = state.jump;
  const r = jumpTo(state.view, j.y, j.m, state.selected);
  state.cy = r.cy; state.cm = r.cm; state.selected = r.selected;
  state.jump = null;
  render();
}
// [오늘] — data-nav="today" 와 같은 일을 하고 팝오버까지 닫는다.
function jumpNow() {
  const n = new Date();
  state.cy = n.getFullYear(); state.cm = n.getMonth(); state.selected = fmt(n);
  state.jump = null;
  render();
}

// render() 가 #app 을 통째로 갈아엎으므로 스크롤은 매번 0 으로 리셋된다.
// 진입부에서 저장하고, innerHTML 을 쓴 뒤 되돌린다.
function saveJumpScroll() {
  const j = state.jump;
  if (!j) return;
  const cy = document.getElementById('jcolY'), cm = document.getElementById('jcolM');
  if (cy) j.sy = cy.scrollTop;
  if (cm) j.sm = cm.scrollTop;
}
// 처음 열릴 때는 저장된 값이 없다 — 선택 항목이 5칸 중 3번째에 오도록 계산한다.
// 스크롤 맨 위에서 열리면 2016년부터 보여서 의미가 없다.
const jumpOffset = (idx) => Math.max(0, (idx - Math.floor(J_VISIBLE / 2)) * J_ITEM);
function applyJumpScroll() {
  const j = state.jump;
  if (!j) return;
  const cy = document.getElementById('jcolY'), cm = document.getElementById('jcolM');
  if (cy) cy.scrollTop = j.sy == null ? jumpOffset(jumpYears(new Date().getFullYear(), state.cy).indexOf(j.y)) : j.sy;
  if (cm) cm.scrollTop = j.sm == null ? jumpOffset(j.m) : j.sm;
}

function renderJumpPopover() {
  const j = state.jump;
  const col = (id, rows) =>
    '<div id="' + id + '" style="flex:1;height:' + J_COL + 'px;overflow-y:auto;' +
    '-webkit-overflow-scrolling:touch;scrollbar-width:thin">' + rows + '</div>';
  const row = (on, attr, label) =>
    '<button ' + attr + ' aria-pressed="' + on + '" style="display:block;width:100%;height:' + J_ITEM +
    'px;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:' + (on ? 700 : 500) +
    ';border-radius:9px;padding:0;background-color:' + (on ? 'var(--tint)' : 'transparent') +
    ';color:' + (on ? 'var(--on-tint)' : 'var(--label)') + '">' + esc(label) + '</button>';
  const head = (s) => '<div style="flex:1;font-size:12px;font-weight:700;color:var(--label-tertiary);' +
    'text-align:center;padding-bottom:6px">' + esc(s) + '</div>';

  const years = jumpYears(new Date().getFullYear(), state.cy)
    .map((y) => row(y === j.y, 'data-jy="' + y + '"', yearLabel(y))).join('');
  let months = '';
  for (let m = 0; m < 12; m++) months += row(m === j.m, 'data-jm="' + m + '"', monthShort(m));

  return '<div role="dialog" aria-label="' + esc(t('jump.title')) + '" style="position:absolute;top:100%;' +
    'left:0;margin-top:8px;z-index:70;width:min(320px,calc(100vw - 32px));background-color:var(--bg);' +
    'border-radius:16px;box-shadow:var(--shadow-3);padding:10px;' +
    'animation:iosMenuIn var(--duration-fast) var(--ease-decelerate)">' +
    '<div style="display:flex;gap:6px">' + head(t('jump.year')) + head(t('jump.month')) + '</div>' +
    '<div style="display:flex;gap:6px">' + col('jcolY', years) + col('jcolM', months) + '</div>' +
    '<div style="display:flex;gap:8px;margin-top:10px;border-top:.5px solid var(--separator);padding-top:10px">' +
      '<button class="btn btn-gray btn-sm" data-act="jumpToday" style="flex:1">' + esc(t('nav.today')) + '</button>' +
      '<span data-raise="tint" style="flex:1;display:flex">' +
        '<button class="btn btn-prominent btn-sm" data-act="jumpGo" style="flex:1">' + esc(t('jump.go')) + '</button>' +
      '</span>' +
    '</div></div>';
}
