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
const catOf = (it) =>
  (it && it.categoryId && state.cats.find((c) => c.id === it.categoryId)) || CAT_NONE;
// 이름은 i18n 을 탄다 — '없음' 을 데이터로 들고 있으면 언어를 바꿔도 안 변한다.
const catName = (c) => (c.id ? c.name : t('cat.none'));
// 배열 순서가 곧 반복 메뉴의 순서다.
const REP_KEYS = ['none', 'daily', 'weekly', 'monthly'];
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
  // days 가 있으면 고른 요일들로, 없으면 시작일의 요일로 — 옛 항목에는 days 가
  // 없다. 이 폴백을 빼면 기존 반복 할 일이 전부 사라진다.
  // 빈 배열도 '없음'과 같이 다룬다: 저장은 막지만, 어쩌다 들어온 문서가 화면에서
  // 사라지는 것보다 옛 동작으로 도는 편이 안전하다.
  if (rep === 'weekly') {
    const days = Array.isArray(it.days) && it.days.length ? it.days : [a.getDay()];
    return days.includes(b.getDay());
  }
  if (rep === 'monthly') return a.getDate() === b.getDate();
  return false;
}
// Repeating tasks track completion per-date; one-off tasks use a single flag.
function isDone(it, ds) {
  return (it.repeat && it.repeat !== 'none') ? (it.doneDates || []).includes(ds) : !!it.done;
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

function sortItems(list) {
  return list.slice().sort((x, y) => {
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
function itemsOn(items, ds, showCompleted) {
  const f = state.filter;
  return sortItems(items.filter((it) => occursOn(it, ds) && (showCompleted || !isDone(it, ds))
    && (!f || (it.categoryId || '') === f)));
}

// ---------------------------------------------------------------- state
const now0 = new Date();
const state = {
  view: 'month',
  cy: now0.getFullYear(),
  cm: now0.getMonth(),
  selected: fmt(now0),
  items: [],
  cats: [],           // users/{uid}/categories 스냅샷. 이름순 정렬은 firebase.js 가 한다
  // null = 전체. 아니면 categoryId 문자열. ★ 저장하지 않는다 — 새로고침하면 풀린다.
  // 남겨 두면 다음에 열었을 때 "할 일이 다 사라졌다" 로 읽힌다.
  filter: null,
  showCats: false,    // 카테고리 관리 시트
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
// ★ showCats 도 여기 든다 — 카테고리 시트에는 이름 입력칸(uncontrolled)이 있어서
//   원격 스냅샷이 render() 를 돌리면 타이핑하던 캐럿이 날아간다. showSettings·
//   showAdmin 이 여기 없는 이유는 그쪽에 입력칸이 없기 때문이다.
const sheetBusy = () => state.showForm || !!state.exp || !!state.jump || state.showCats;

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
    timeLabel: it.time ? timeLabel(it.time) : t('item.allDay'),
    // ★ 라벨이 둘인 이유: 주간 격자 칸은 390px 화면에서 51px 밖에 안 돼 지금도 시간
    //   라벨이 두 줄로 접힌다(접기 기준 5의 근거 — 아래 주간 뷰 주석). 범위를 넣으면
    //   3~4줄이 되므로 **좁은 격자는 timeLabel, 넓은 곳은 range** 를 쓴다.
    //   endTime 이 없으면 둘은 같은 문자열이다.
    range: it.time ? timeRange(it.time, it.endTime || '') : t('item.allDay')
  };
}
// data-open carries the id + the date the row was rendered for, so editing a
// repeating task opens it on the occurrence the user actually tapped.
const openAttr = (p, ds) => 'data-open="' + esc(p.id) + '" data-ds="' + ds + '"';

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
    html += '<div class="seg-wrap" style="overflow-x:auto;max-width:100%;margin-bottom:16px">' +
      chip('', t('cat.all'), '') +
      state.cats.map((c) => chip(c.id, c.name, c.color)).join('') + '</div>';
  }

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
    // 7열은 minmax(0,1fr). 1fr(=minmax(auto,1fr))은 열이 자식의 min-content 보다
    // 작아지지 못해, nowrap 제목 하나가 나머지 요일을 화면 밖으로 밀어낸다.
    // 월간은 .cell{overflow:hidden} 덕에 지금도 안 깨지지만 같은 요구사항이니
    // 같은 방식으로 적어 둔다 — .cell 을 건드려도 안 터지게.
    html += '<div class="card" style="border:.5px solid var(--separator);overflow:hidden">' +
      '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">' + heads + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">' + cells + '</div></div>';
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
      // 월간(3개)과 같은 이유로 접는다 — 안 접으면 17개짜리 날이 칸을 713px 로 늘린다.
      // 5인 근거(실측): 칸 min-height 320 에 헤더 64 · 항목 33 · gap 4 · `+N개` 12 라
      // 넓은 화면은 5개=273(여유 47) · 6개=310(여유 10뿐) · 7개=347(초과)이고,
      // 390px 에서는 열이 51px 라 시간 라벨이 두 줄로 접혀 항목이 48 → 5개라도 348 이다.
      // 좁은 쪽에서 한 줄이 48px 이라 6으로 올리면 거기서 50px 을 더 먹는다.
      // ★ 항목 높이·글꼴·시간 라벨 형식을 바꾸면 이 5를 다시 재야 한다.
      const list = itemsOn(items, ds, SHOW_COMPLETED);
      const pills = list.slice(0, 5).map((it) => {
        const p = pill(it, ds);
        return '<div ' + openAttr(p, ds) + ' style="cursor:pointer;padding:4px 7px;border-radius:6px;background:' +
          p.bg + ';opacity:' + p.op + '">' +
          '<div class="trunc" style="font-size:11px;font-weight:600;color:' + p.color + ';text-decoration:' + p.deco + '">' +
          esc(p.title) + '</div>' +
          '<div style="font-size:10px;font-weight:500;color:' + p.color + ';opacity:.75">' + esc(p.timeLabel) + '</div></div>';
      }).join('');
      // ★ data-day 를 여기 직접 단다. 월간은 부모 .cell 이 들고 있어 `+N개` 가 공짜로
      //   날짜 선택이 되지만, 주간은 헤더에만 있어서 본문에 두면 눌러도 안 먹는다.
      //   동작은 월간과 같다 — 그 날을 고르고 하단 리스트만 바뀐다(뷰 전환 아님).
      const more = list.length > 5
        ? '<div data-day="' + ds + '" style="cursor:pointer;font-size:10px;color:var(--label-tertiary);padding:0 7px">' +
          esc(t('cell.more', list.length - 5)) + '</div>' : '';
      cols += '<div style="min-height:320px;border-left:' + (i === 0 ? 'none' : '.5px solid var(--separator)') + '">' +
        '<div data-day="' + ds + '" style="cursor:pointer;text-align:center;padding:10px 4px 8px;border-bottom:.5px solid var(--separator)">' +
          '<div style="font-size:11px;font-weight:600;color:' +
            (i === 0 ? '#FF3B30' : i === 6 ? 'var(--tint)' : 'var(--label-secondary)') + '">' + esc(wdow[i]) + '</div>' +
          '<div style="width:28px;height:28px;margin:4px auto 0;border-radius:50%;display:flex;align-items:center;' +
            'justify-content:center;font-size:15px;font-weight:600;background:' +
            (isToday ? 'var(--tint)' : isSel ? 'var(--fill-tertiary)' : 'transparent') +
            ';color:' + (isToday ? '#fff' : 'var(--label)') + '">' + d.getDate() + '</div></div>' +
        '<div style="padding:6px 5px;display:flex;flex-direction:column;gap:4px">' + pills + more + '</div></div>';
    }
    // ★ minmax(0,1fr) 이라야 한다. 1fr 이면 긴 제목(.trunc = nowrap)의 min-content 가
    //   그 열을 밀어내 목·금·토가 화면 밖으로 나가고, overflow:hidden 이라 스크롤도 안 된다.
    html += '<div class="card" style="border:.5px solid var(--separator);' +
      'overflow:hidden;display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">' + cols + '</div>';
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
    html += '<div class="card" style="border:.5px solid var(--separator);padding:16px 16px 20px">' + allDayBlock +
      axis + '</div>';
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
      const c = catOf(it).color;
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
              'padding:3px 8px;border-radius:999px">' + esc(repLabel(it.repeat, it.days)) + '</span>' : '') +
          (it.time ? '<span style="font-size:13px;font-weight:500;color:var(--label-secondary);' +
            'font-variant-numeric:tabular-nums">' + esc(timeRange(it.time, it.endTime || '')) + '</span>' : '') +
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
  if (state.showCats) html += renderCatSheet();
  if (state.exp) html += renderExportSheet();
  // 점프는 바텀 시트가 아니라 제목 아래 팝오버다 — 위 헤더 안에 이미 들어가 있다.
  // 백드롭만 여기서 덧붙인다 (팝오버보다 뒤에 와야 z-index 없이도 순서가 맞다).
  if (state.jump) html += '<div data-act="closeJump" style="position:fixed;inset:0;z-index:69"></div>';

  document.getElementById('app').innerHTML = html;
  applyJumpScroll();
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
