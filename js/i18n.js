'use strict';
// 화면 설정(테마·언어)의 단일 출처 + 문자열 테이블.
//
// 클래식 스크립트다. import/export 를 붙이지 말 것 — legal/auth/calendar/todo 와
// 같은 전역 스코프를 쓰고, firebase.js 모듈은 전역 렉시컬 바인딩으로 여기를 읽는다.
// 로드 순서는 legal.js 와 같은 계층, 그중에서도 맨 앞이다 (아래 applyTheme 이유).
//
// ★ 날짜 데이터 키는 여기 없다. fmt()/parse()(calendar.js)가 만드는
//   'YYYY-MM-DD' 로컬 문자열이 저장·비교·반복 판정의 유일한 형식이고,
//   이 파일의 Intl 은 전부 화면 표시 전용이다. 둘을 섞으면 타임존 경계에서
//   할 일이 하루씩 밀린다.

// ---------------------------------------------------------------- 설정 값
const SETTINGS_KEY = 'todo-cal-settings-v1';
const THEMES = ['light', 'dark', 'system'];
const LANGS = ['ko', 'en'];
// 앱을 열었을 때 처음 뜨는 화면. ★ firestore.rules 의 validSettings() 와 **같은
// 집합을 유지할 것** — 어긋나면 화면은 멀쩡한데 저장만 조용히 거부된다.
// 배열 순서가 곧 설정 시트의 버튼 순서이자 하단 탭 바의 순서다.
const VIEWS = ['year', 'month', 'week', 'day'];

// 이 객체가 단일 소스다. state 에 넣지 않는 이유는 terms/privacy/delete-account
// 페이지에 state 가 없기 때문 — 그 세 페이지도 같은 값을 읽어야 한다.
const SETTINGS = { theme: 'system', lang: 'ko', view: 'month' };

const okTheme = (v) => THEMES.indexOf(v) >= 0;
const okLang = (v) => LANGS.indexOf(v) >= 0;
const okView = (v) => VIEWS.indexOf(v) >= 0;

// localStorage 는 로그인 전 임시 저장소이자, Firestore 를 읽을 수 없는 정적
// 페이지들이 설정을 알아내는 유일한 창구다. 로그인 후에도 계속 미러로 쓴다.
function loadSettings() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) { raw = null; }
  if (raw && okTheme(raw.theme)) SETTINGS.theme = raw.theme;
  if (raw && okLang(raw.lang)) SETTINGS.lang = raw.lang;
  if (raw && okView(raw.view)) SETTINGS.view = raw.view;
}

// 검증을 통과한 키만 반영한다. 서버 값이든 사용자 클릭이든 같은 문을 지난다.
function setSettings(patch) {
  const p = patch || {};
  if (okTheme(p.theme)) SETTINGS.theme = p.theme;
  if (okLang(p.lang)) SETTINGS.lang = p.lang;
  if (okView(p.view)) SETTINGS.view = p.view;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* 사파리 시크릿 등 */ }
  applyTheme();
}

// 로그인 시 원격 값과 로컬 값을 합친다.
// 있는 키는 Firestore 가 이기고, 빠진 키는 로컬 값이 그대로 남는다.
// 돌려주는 값이 false 면 원격에 빠진 키가 있다는 뜻 — 호출부가 승격 저장한다.
// (로그인 화면에서 고른 언어가 첫 로그인 때 사라지지 않게 하는 장치다.)
function adoptSettings(remote) {
  const r = remote || {};
  setSettings({
    theme: okTheme(r.theme) ? r.theme : SETTINGS.theme,
    lang: okLang(r.lang) ? r.lang : SETTINGS.lang,
    view: okView(r.view) ? r.view : SETTINGS.view
  });
  // ★ view 를 여기 넣었으므로, settings.view 가 없는 **기존 계정은 전부** false 를
  //   받아 다음 로그인에 한 번 승격 저장된다. 의도한 동작이다(옛 계정의 theme/lang
  //   승격과 같은 경로). 규칙이 아직 view 를 모르면 그 쓰기만 거부되고 로그인은
  //   막히지 않는다 — 호출부가 console.warn 으로만 처리한다.
  return okTheme(r.theme) && okLang(r.lang) && okView(r.view);
}

// ---------------------------------------------------------------- 테마 적용
const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');

// data-theme 한 속성이 _ds/tokens/{colors,effects}.css 와 css/style.css 의
// 다크 블록을 한꺼번에 켠다. 그래서 테마 전환에 새 CSS 가 필요 없다.
function applyTheme() {
  document.documentElement.setAttribute('data-theme',
    SETTINGS.theme === 'system' ? (darkMQ.matches ? 'dark' : 'light') : SETTINGS.theme);
}

// 로드 즉시 한 번. 첫 render() 를 기다리면 그 사이 흰 화면이 번쩍인다.
loadSettings();
applyTheme();

// ---------------------------------------------------------------- 날짜 표시
// 요일·월 이름은 하드코딩하지 않는다. 아래 함수들만 Intl 을 쓰고, 결과는
// 전부 화면에만 들어간다 — 저장되는 값으로 되돌아가는 경로가 없다.
const curLang = () => SETTINGS.lang;
const locale = () => (SETTINGS.lang === 'en' ? 'en-US' : 'ko-KR');

// 셀마다 포매터를 새로 만들면 월 뷰 42칸에서 낭비가 크다.
const _dtf = {};
function dtf(opts) {
  const k = SETTINGS.lang + '|' + JSON.stringify(opts);
  return _dtf[k] || (_dtf[k] = new Intl.DateTimeFormat(locale(), opts));
}

// ★ 2024-01-07 은 일요일이다. Date.getDay() 색인(0=일)에 그대로 맞추려고
//   이 날짜를 기준으로 뽑는다. new Date('2024-01-07') 은 UTC 파싱이라 시간대에
//   따라 하루 밀리므로 반드시 (y, m, d) 생성자를 쓸 것.
//   주 시작 요일은 로케일과 무관하게 일요일 고정이다 — calendar.js 의
//   startOffset 계산이 그 전제로 짜여 있다. Intl 은 이름만 준다.
function dow(style) {
  const f = dtf({ weekday: style || 'short' });
  const out = [];
  for (let i = 0; i < 7; i++) out.push(f.format(new Date(2024, 0, 7 + i)));
  return out;
}

// 'HH:MM' → 로케일 시각. ko '오후 2:30' / en '2:30 PM'
// 인자 이름을 t 로 두지 말 것 — 아래 문자열 함수 t() 를 가린다.
function timeLabel(hhmm) {
  if (!hhmm) return '';
  const p = hhmm.split(':').map(Number);
  return dtf({ hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, p[0], p[1]));
}
// 시작–종료. ko '오전 7:00 – 오전 8:00' / en '7:00 AM – 8:00 AM'
// ★ 종료가 비면 timeLabel() 과 **문자 하나까지 같다** — endTime 이 없는 옛 항목의
//   표시가 안 바뀌게 하는 지점이다. 오전/오후·AM/PM 은 timeLabel 이 이미 붙이므로
//   여기가 하는 일은 두 라벨을 en dash 로 잇는 것뿐이고, 그래서 ko/en 양쪽에
//   따로 손볼 것이 없다. 자정 넘김은 입력에서 막으므로 여기서 볼 일이 없다.
const timeRange = (a, b) => (b ? timeLabel(a) + ' – ' + timeLabel(b) : timeLabel(a));
// 달력 머리말. ko '2026년 7월' / en 'July 2026'
const monthTitle = (y, m) => dtf({ year: 'numeric', month: 'long' }).format(new Date(y, m, 1));
// 선택한 날. ko '7월 25일 토요일' / en 'Saturday, July 25'
const dayTitle = (d) => dtf({ month: 'long', day: 'numeric', weekday: 'long' }).format(d);
// 월·일만. ko '7월 25일' / en 'Jul 25' — 목표 마감 배지와 shortDay 가 같이 쓴다.
const monthDay = (d) => dtf({ month: 'short', day: 'numeric' }).format(d);
// 짧은 날. ko '7월 25일 (토)' / en 'Jul 25 (Sat)'
const shortDay = (d) => monthDay(d) + ' (' + dtf({ weekday: 'short' }).format(d) + ')';
// 가입일 같은 순수 날짜. 표시 전용이라 fmt() 를 쓰지 않는다.
const dateLabel = (d) => dtf({ year: 'numeric', month: 'short', day: 'numeric' }).format(d);
// 년·월 점프 피커용. ko '7월' · '2026년' / en 'Jul' · '2026'.
// 월 번호는 0-11 이고, 돌려주는 문자열은 화면에만 들어간다 — 고르고 나면
// calendar.js 의 jumpTo() 가 숫자와 fmt() 문자열로만 상태를 바꾼다.
const monthShort = (m) => dtf({ month: 'short' }).format(new Date(2024, m, 1));
const yearLabel = (y) => dtf({ year: 'numeric' }).format(new Date(y, 0, 1));

// ---------------------------------------------------------------- 문자열
// 값이 함수면 인자를 받아 문장을 만든다 (개수·이름 같은 자리 채우기).
// 키가 없으면 한국어로, 한국어에도 없으면 키 자체를 돌려준다 — 화면이 비지 않고
// 빠진 키가 눈에 띈다.
const STR = {
  ko: {
    'app.loading': '불러오는 중…',
    'app.tagline': '개인 할 일 캘린더',
    'app.offline': '서버에 연결하지 못했습니다. 네트워크를 확인하고 새로고침해 주세요.',
    'a.close': '닫기',

    // 헤더 · 달력
    'hdr.admin': '관리자',
    'hdr.signups': '관리자',
    'hdr.settings': '설정',
    'hdr.logout': '로그아웃',
    // 손님 모드 — 로그인하지 않고 쓰는 상태
    'guest.name': '손님',
    'guest.login': '로그인',
    'guest.hint': '로그인하지 않고 쓰는 중입니다. 할 일은 이 브라우저에만 저장되고, 방문 기록을 지우면 사라집니다.',
    'auth.guestGo': '로그인 없이 계속하기',
    'guest.askUpload': (n) => '이 기기에 손님으로 저장해 둔 ' + n + '개를 지금 계정으로 올릴까요?',
    'guest.uploadDone': (n) => n + '개를 계정으로 옮겼습니다.',
    'hdr.today': (s) => '오늘 · ' + s,
    'nav.prev': '이전',
    'nav.next': '다음',
    'nav.today': '오늘',
    'view.year': '년',
    'view.month': '월',
    'view.week': '주',
    'view.day': '일',
    'cell.more': (n) => '+' + n + '개',
    'list.todayPrefix': '오늘 · ',
    'list.allDone': '모두 완료!',
    'list.remain': (n) => n + '개 남음',
    'list.empty': '할 일이 없습니다',
    'list.emptyHint': '오른쪽 아래 + 버튼으로 추가해 보세요',
    'list.check': '완료 체크',
    'item.allDay': '하루 종일',
    'day.noTimed': '시간이 정해진 할 일이 없습니다',
    'item.add': '할 일 추가',

    // 이미지 내보내기
    'exp.btn': '이미지',
    'exp.title': '이미지로 내보내기',
    'exp.memo': '메모 포함',
    'exp.hint': '메모에 개인적인 내용이 있으면 끄고 내보내세요',
    'exp.share': '공유',
    'exp.save': '저장',
    'exp.building': '이미지 만드는 중…',
    'exp.fail': '이미지를 만들지 못했습니다',
    'exp.shareFail': '공유하지 못했습니다',
    'exp.alt': '내보낼 캘린더 이미지 미리보기',
    'exp.brand': '할 일 캘린더',
    'exp.detail': '상세 목록 포함',
    'exp.detailHint': '격자 아래에 제목이 안 잘린 목록을 붙입니다',
    'exp.grid': '캘린더 포함',
    'exp.gridHint': '월·주 표를 이미지에 넣습니다',

    // 년·월 점프
    'jump.title': '날짜 이동',
    'jump.year': '년',
    'jump.month': '월',
    'jump.go': '이동',

    // 카테고리. '없음' 을 데이터가 아니라 여기 두는 이유는 언어를 바꾸면 같이
    // 바뀌어야 하기 때문이다 — 사용자가 만든 카테고리 이름은 번역하지 않는다.
    'cat.none': '없음',
    'cat.all': '전체',
    'cat.title': '카테고리',
    'cat.manage': '카테고리 관리',
    'cat.add': '카테고리 추가',
    'cat.edit': '카테고리 편집',
    'cat.name': '이름',
    'cat.color': '색',
    'cat.namePh': '카테고리 이름',
    'cat.empty': '아직 카테고리가 없습니다',
    'cat.emptyHint': '이름과 색을 정해 만들어 보세요',
    'cat.dupe': '같은 이름의 카테고리가 있습니다',
    'cat.reorder': '길게 눌러 끌면 순서를 바꿀 수 있습니다',
    'cat.max': (n) => '카테고리는 최대 ' + n + '개까지 만들 수 있습니다',
    // ★ 삭제해도 할 일은 안 지워진다는 걸 문장에서 분명히 한다 — 되돌릴 수 없는
    //   조작이라 개수를 눈으로 보여 주는 것이 유일한 방어선이다.
    'cat.delConfirm': (n) => n === 0
      ? '이 카테고리를 지울까요?'
      : '이 카테고리를 지웁니다. 할 일 ' + n + '개는 지워지지 않고 ‘없음’ 으로 바뀝니다.',
    // 목표(버킷리스트). 할 일과 다른 컬렉션이라 문자열도 form.* 과 섞지 않는다 —
    // 목표는 날짜 하나가 아니라 기간이라서 라벨이 '언제'가 아니라 '언제까지'다.
    'goal.title': '올해 목표',
    'goal.add': '목표 추가',
    'goal.new': '새로운 목표',
    'goal.edit': '목표 편집',
    'goal.titlePh': '올해 안에 무엇을 이루고 싶나요?',
    'goal.due': '기한',
    'goal.dueYear': '올해 안에',
    'goal.dueMonth': '월까지',
    'goal.dueDay': '날짜까지',
    // 인자는 monthShort()/monthDay() 가 만든 로케일 문자열이다 — 여기서 하는 일은
    // 조사를 붙이는 것뿐이라 ko/en 이 서로 다른 모양이어도 된다.
    'goal.by': (s) => s + '까지',
    'goal.empty': '아직 목표가 없습니다',
    'goal.emptyHint': '오른쪽 아래 + 버튼으로 올해 이루고 싶은 것을 적어 보세요',
    'goal.remain': (n) => n + '개 남음',
    'goal.allDone': '모두 완료!',
    'goal.check': '완료 체크',
    'goal.months': '월별 목표',
    // 12칸 요약의 개수. **그 달 목표만** 센다 — 일일 할 일은 여기 안 들어간다.
    'goal.count': (n) => n + '개',

    // 할 일 / 일정. 일정은 여러 날에 걸치고 완료 체크가 없다.
    'kind.todo': '할 일',
    'kind.event': '일정',
    'kind.all': '전체',
    'kind.addEvent': '일정 추가',
    'form.kind': '종류',
    'form.span': '기간',
    'form.spanToggle': '여러 날',
    'form.spanEnd': '종료 날짜',
    'form.spanBefore': '종료 날짜가 시작 날짜보다 빠릅니다',
    'form.spanDays': (n) => n + '일간',
    'form.spanOne': '하루',
    // 회차가 자기 자신과 겹치는 것을 막는다 — 매주 8일짜리는 다음 회차와 포개진다.
    'form.spanTooLong': (n) => '반복 주기보다 짧아야 합니다 (최대 ' + n + '일)',
    'form.evTimeHint': '시작 시각은 첫날, 종료 시각은 마지막 날에 붙습니다',
    'rep.none': '반복 안 함', 'rep.daily': '매일', 'rep.weekly': '매주', 'rep.monthly': '매월',
    'rep.yearly': '매년',
    // 요일 이름은 dow() 가 준다 — 여기서 정하는 건 잇는 방식뿐이다.
    'rep.weeklyDays': (n) => '매주 ' + n.join('·'),
    'rep.weeklyAll': '매주 (매일)',

    // 입력 시트
    'form.new': '새로운 할 일',
    'form.edit': '할 일 편집',
    'form.title': '제목',
    'form.titlePh': '무엇을 해야 하나요?',
    'form.date': '날짜',
    'form.time': '시간',
    'form.timeToggle': '시간 지정',
    'form.timeStart': '시작',
    'form.timeEnd': '종료',
    'form.endBeforeStart': '종료 시간은 시작 시간보다 늦어야 합니다',
    'form.cat': '카테고리',
    'form.repeat': '반복',
    'form.days': '반복 요일',
    'form.daysEmpty': '요일을 하나 이상 골라 주세요',
    'form.memo': '메모',
    'form.memoPh': '메모를 남겨 보세요 (선택)',
    'form.delete': '삭제',
    'form.cancel': '취소',
    'form.save': '저장',

    // 로그인 · 회원가입
    'auth.login': '로그인',
    'auth.signup': '회원가입',
    'auth.submit': '가입하기',
    'auth.busy': '잠시만요…',
    'auth.name': '이름',
    'auth.namePh': '이름을 입력하세요',
    'auth.email': '이메일',
    'auth.emailHint': 'PIN을 잊었을 때 재설정 메일을 받는 주소입니다.',
    'auth.pin': 'PIN 번호',
    'auth.pinDigits': ' (숫자 6자리)',
    'auth.pin2': 'PIN 번호 확인',
    'auth.remember': '자동 로그인',
    'auth.rememberHint': '다음에 열 때 로그인 화면을 건너뜁니다',
    'auth.afterSignup': '관리자가 신청을 수락하면 로그인할 수 있습니다.',
    'auth.needName': '이름을 입력해 주세요.',
    'auth.needEmail': '이메일 주소를 정확히 입력해 주세요.',
    'auth.pinRule': 'PIN은 숫자 6자리입니다.',
    'auth.pinRuleSignup': 'PIN은 숫자 6자리로 입력해 주세요.',
    'auth.pinMismatch': 'PIN이 서로 다릅니다.',
    'auth.signupDone': '회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.',

    // 약관 동의
    'ag.all': '전체 동의하기',
    'ag.allHint': '선택 항목을 포함해 모두 동의합니다.',
    'ag.terms': '이용약관 동의',
    'ag.privacy': '개인정보 수집·이용 동의',
    'ag.required': '필수',
    'ag.optional': '선택',
    'ag.doc': '전문 보기',
    'ag.ageTitle': '나이 확인',
    'ag.over14': '만 14세 이상입니다',
    'ag.under14No': '만 14세 미만은 회원가입을 할 수 없습니다. 대신 로그인 없이 그대로 쓸 수 있어요 — 개인정보를 받지 않고, 할 일은 이 기기에만 저장됩니다.',
    'ag.marketing': '서비스 알림·업데이트 수신',
    'ag.needTerms': '이용약관에 동의해 주세요.',
    'ag.needPrivacy': '개인정보 수집·이용에 동의해 주세요.',
    'ag.needAge': '나이 확인 항목을 선택해 주세요.',
    'legal.newWindow': '새 창에서 열기',
    'legal.terms': '이용약관',
    'legal.privacy': '개인정보 처리방침',

    // 설정 시트
    'set.title': '설정',
    'set.account': '계정',
    'set.role': '권한',
    'set.roleAdmin': '관리자',
    'set.roleUser': '일반 회원',
    'set.display': '화면',
    'set.theme': '테마',
    'set.themeLight': '밝은',
    'set.themeDark': '어두운',
    'set.themeSystem': '기기 설정',
    'set.lang': '언어',
    // 지금 보고 있는 화면이 아니라 **다음에 열 때** 처음 뜨는 화면이다.
    'set.view': '첫 화면',
    'set.danger': '위험 구역',
    'set.adminNoDelete': '관리자 계정은 여기에서 삭제할 수 없습니다. 다른 관리자에게 요청하거나, ' +
      'Firebase 콘솔에서 직접 처리하세요.',
    'set.delConfirm': '계정과 할 일이 <strong>영구 삭제</strong>되며 되돌릴 수 없습니다.<br>' +
      '계속하려면 PIN 6자리를 다시 입력하세요.',
    'set.delCancel': '취소',
    'set.delGo': '영구 삭제',
    'set.delBusy': '삭제 중…',
    'set.delOpen': '계정 삭제',
    'set.delHint': '계정과 모든 할 일이 영구 삭제됩니다. 되돌릴 수 없습니다.',
    'set.delDone': (n) => '계정과 할 일 ' + n + '개를 모두 삭제했습니다. 그동안 감사했습니다.',
    'set.delFail': '삭제에 실패했습니다.',

    // 관리자 시트
    'adm.title': '관리자 패널',
    'adm.statAll': '전체 계정',
    'adm.statNew': '최근 7일 가입',
    'adm.statBlocked': '정지된 계정',
    'adm.search': '이름 · 이메일 검색',
    'adm.sortJoined': '가입순',
    'adm.sortName': '이름순',
    'adm.noMatch': '검색 결과가 없습니다',
    'adm.block': '정지',
    'adm.unblock': '해제',
    'adm.agreeNone': '약관 동의 기록 없음',
    'adm.agreeVer': (v) => '약관 ' + v,
    'adm.agreeMktOn': '마케팅 동의',
    'adm.agreeMktOff': '마케팅 미동의',
    'adm.pending': '회원가입 신청',
    'adm.all': '전체 회원',
    'adm.noPending': '대기 중인 신청이 없습니다',
    'adm.noUsers': '회원이 없습니다',
    'adm.reject': '거절',
    'adm.approve': '수락',
    'adm.resetPin': 'PIN 재설정 메일',
    'adm.delete': '완전 삭제',
    'adm.joined': (d) => d + ' 신청',
    'adm.migrate': '데이터 이전',
    'adm.migrateHint': '이 기기의 localStorage에 남아 있는 할 일을 내 계정으로 한 번 올립니다.',
    'adm.migrateBtn': 'localStorage → Firestore 업로드',
    'adm.stPending': '승인 대기', 'adm.stApproved': '승인됨', 'adm.stRejected': '거절됨',
    'adm.ageOver14': '만 14세 이상',
    'adm.ageUnder14': '만 14세 미만 · 보호자 동의',
    'adm.ageNone': '약관 미동의',
    'adm.askReset': (n, e) => n + ' 님의 이메일(' + e + ')로 PIN 재설정 메일을 보낼까요?',
    'adm.resetSent': '재설정 메일을 보냈습니다.',
    'adm.askDelete': (n) => n + '님의 계정과 모든 할 일이 영구 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.',
    'adm.deleteDone': (n, c) => n + '님의 계정과 할 일 ' + c + '개를 삭제했습니다.\n\n' +
      'Firebase 콘솔 Authentication에서 계정도 지워주세요.',
    'adm.askMigrate': '다른 기기에서 누르면 데이터가 덮어써집니다.\n\n' +
      '이 기기의 localStorage에 남아 있는 할 일을 Firestore로 올릴까요?',
    'adm.migrateDone': (n) => n + '개를 업로드했습니다.',
    'adm.migrateNone': '올릴 데이터가 없습니다.',

    // 오류
    'err.login': '이름 또는 PIN이 올바르지 않습니다.',
    'err.nameTaken': '이미 사용 중인 이름입니다.',
    'err.emailUsed': '이미 가입된 이메일 주소입니다.',
    'err.emailBad': '이메일 주소 형식이 올바르지 않습니다.',
    'err.weakPin': 'PIN은 숫자 6자리여야 합니다.',
    'err.needAgree': '필수 약관에 동의해야 가입할 수 있습니다.',
    'err.signup': (c) => '가입에 실패했습니다. (' + c + ')',
    'err.noProfile': '계정 정보를 찾을 수 없습니다.',
    'err.pending': '관리자 승인을 기다리는 중입니다.',
    'err.rejected': '가입 신청이 거절된 계정입니다.',
    'err.needLogin': '로그인이 필요합니다.',
    'err.badPin': 'PIN이 올바르지 않습니다.',
    'err.loadProfile': '계정 정보를 불러오지 못했습니다',
    'err.loadTodos': '할 일을 불러오지 못했습니다',
    'err.loadUsers': '회원 목록을 불러오지 못했습니다',
    'err.save': '저장에 실패했습니다',
    'err.settings': '설정을 저장하지 못했습니다',
    'err.logout': '로그아웃에 실패했습니다',
    'err.status': '상태 변경에 실패했습니다',
    'err.mail': '메일 발송에 실패했습니다',
    'err.delete': '삭제에 실패했습니다',
    'err.upload': '업로드에 실패했습니다'
  },

  en: {
    'app.loading': 'Loading…',
    'app.tagline': 'Personal to-do calendar',
    'app.offline': 'Could not reach the server. Check your connection and reload.',
    'a.close': 'Close',

    'hdr.admin': 'Admin',
    'hdr.signups': 'Admin',
    'hdr.settings': 'Settings',
    'hdr.logout': 'Sign out',
    'guest.name': 'Guest',
    'guest.login': 'Sign in',
    'guest.hint': 'You are using the app without an account. To-dos stay in this browser only and are lost if you clear site data.',
    'auth.guestGo': 'Continue without an account',
    'guest.askUpload': (n) => 'Move the ' + n + ' item(s) you saved as a guest on this device into your account?',
    'guest.uploadDone': (n) => 'Moved ' + n + ' item(s) into your account.',
    'hdr.today': (s) => 'Today · ' + s,
    'nav.prev': 'Previous',
    'nav.next': 'Next',
    'nav.today': 'Today',
    'view.year': 'Year',
    'view.month': 'Month',
    'view.week': 'Week',
    'view.day': 'Day',
    'cell.more': (n) => '+' + n + ' more',
    'list.todayPrefix': 'Today · ',
    'list.allDone': 'All done!',
    'list.remain': (n) => n + ' left',
    'list.empty': 'Nothing to do',
    'list.emptyHint': 'Tap the + button at the bottom right to add one',
    'list.check': 'Mark complete',
    'item.allDay': 'All day',
    'day.noTimed': 'Nothing scheduled at a time',
    'item.add': 'Add a to-do',

    'exp.btn': 'Image',
    'exp.title': 'Export as image',
    'exp.memo': 'Include notes',
    'exp.hint': 'Turn this off if your notes are private',
    'exp.share': 'Share',
    'exp.save': 'Save',
    'exp.building': 'Preparing image…',
    'exp.fail': 'Could not create the image',
    'exp.shareFail': 'Could not share',
    'exp.alt': 'Preview of the calendar image',
    'exp.brand': 'Todo Calendar',
    'exp.detail': 'Include detail list',
    'exp.detailHint': 'Adds a full-width list below the grid',
    'exp.grid': 'Include calendar',
    'exp.gridHint': 'Puts the month or week grid in the image',

    'jump.title': 'Jump to date',
    'jump.year': 'Year',
    'jump.month': 'Month',
    'jump.go': 'Go',

    'cat.none': 'None',
    'cat.all': 'All',
    'cat.title': 'Categories',
    'cat.manage': 'Manage categories',
    'cat.add': 'Add category',
    'cat.edit': 'Edit category',
    'cat.name': 'Name',
    'cat.color': 'Colour',
    'cat.namePh': 'Category name',
    'cat.empty': 'No categories yet',
    'cat.emptyHint': 'Give one a name and a colour',
    'cat.dupe': 'A category with that name already exists',
    'cat.reorder': 'Press and hold a row, then drag it into place',
    'cat.max': (n) => 'You can have at most ' + n + ' categories',
    'cat.delConfirm': (n) => n === 0
      ? 'Delete this category?'
      : 'Deleting this category. ' + n + ' to-do(s) will not be deleted — they become “None”.',
    'goal.title': 'Goals this year',
    'goal.add': 'Add a goal',
    'goal.new': 'New goal',
    'goal.edit': 'Edit goal',
    'goal.titlePh': 'What do you want to get done this year?',
    'goal.due': 'Deadline',
    'goal.dueYear': 'Within the year',
    'goal.dueMonth': 'By month',
    'goal.dueDay': 'By date',
    'goal.by': (s) => 'by ' + s,
    'goal.empty': 'No goals yet',
    'goal.emptyHint': 'Tap the + button to write down what you want to achieve',
    'goal.remain': (n) => n + ' left',
    'goal.allDone': 'All done!',
    'goal.check': 'Mark complete',
    'goal.months': 'Goals by month',
    // 숫자만. 'n goals' 는 12칸 격자에서 접힌다.
    'goal.count': (n) => String(n),

    'kind.todo': 'To-do',
    'kind.event': 'Event',
    'kind.all': 'All',
    'kind.addEvent': 'Add an event',
    'form.kind': 'Kind',
    'form.span': 'Duration',
    'form.spanToggle': 'Spans several days',
    'form.spanEnd': 'End date',
    'form.spanBefore': 'The end date is before the start date',
    'form.spanDays': (n) => n + ' days',
    'form.spanOne': 'One day',
    'form.spanTooLong': (n) => 'Must be shorter than the repeat interval (max ' + n + ' days)',
    'form.evTimeHint': 'The start time is on the first day, the end time on the last',
    'rep.none': 'Does not repeat', 'rep.daily': 'Daily', 'rep.weekly': 'Weekly', 'rep.monthly': 'Monthly',
    'rep.yearly': 'Yearly',
    'rep.weeklyDays': (n) => 'Every ' + n.join(', '),
    'rep.weeklyAll': 'Weekly (all days)',

    'form.new': 'New to-do',
    'form.edit': 'Edit to-do',
    'form.title': 'Title',
    'form.titlePh': 'What needs doing?',
    'form.date': 'Date',
    'form.time': 'Time',
    'form.timeToggle': 'Set a time',
    'form.timeStart': 'Start',
    'form.timeEnd': 'End',
    'form.endBeforeStart': 'The end time must be later than the start time',
    'form.cat': 'Category',
    'form.repeat': 'Repeat',
    'form.days': 'Repeat on',
    'form.daysEmpty': 'Pick at least one day',
    'form.memo': 'Note',
    'form.memoPh': 'Add a note (optional)',
    'form.delete': 'Delete',
    'form.cancel': 'Cancel',
    'form.save': 'Save',

    'auth.login': 'Sign in',
    'auth.signup': 'Sign up',
    'auth.submit': 'Create account',
    'auth.busy': 'One moment…',
    'auth.name': 'Name',
    'auth.namePh': 'Enter your name',
    'auth.email': 'Email',
    'auth.emailHint': 'Where your PIN reset link is sent if you forget it.',
    'auth.pin': 'PIN',
    'auth.pinDigits': ' (6 digits)',
    'auth.pin2': 'Confirm PIN',
    'auth.remember': 'Stay signed in',
    'auth.rememberHint': 'Skip the sign-in screen next time',
    'auth.afterSignup': 'You can sign in once an administrator approves your request.',
    'auth.needName': 'Please enter your name.',
    'auth.needEmail': 'Please enter a valid email address.',
    'auth.pinRule': 'The PIN must be 6 digits.',
    'auth.pinRuleSignup': 'Please enter a 6-digit PIN.',
    'auth.pinMismatch': 'The PINs do not match.',
    'auth.signupDone': 'Your request has been received. You can sign in once an administrator approves it.',

    'ag.all': 'Agree to everything',
    'ag.allHint': 'Includes the optional item.',
    'ag.terms': 'I agree to the Terms of Service',
    'ag.privacy': 'I agree to the collection and use of personal data',
    'ag.required': 'Required',
    'ag.optional': 'Optional',
    'ag.doc': 'Read in full',
    'ag.ageTitle': 'Age confirmation',
    'ag.over14': 'I am 14 or older',
    'ag.under14No': 'Under 14? You cannot create an account, but you can use the app without one — nothing personal is collected and your to-dos stay on this device.',
    'ag.marketing': 'Receive service notices and updates',
    'ag.needTerms': 'Please agree to the Terms of Service.',
    'ag.needPrivacy': 'Please agree to the collection and use of personal data.',
    'ag.needAge': 'Please confirm your age.',
    'legal.newWindow': 'Open in a new window',
    'legal.terms': 'Terms of Service',
    'legal.privacy': 'Privacy Policy',

    'set.title': 'Settings',
    'set.account': 'Account',
    'set.role': 'Role',
    'set.roleAdmin': 'Administrator',
    'set.roleUser': 'Member',
    'set.display': 'Display',
    'set.theme': 'Theme',
    'set.themeLight': 'Light',
    'set.themeDark': 'Dark',
    'set.themeSystem': 'System',
    'set.lang': 'Language',
    'set.view': 'First screen',
    'set.danger': 'Danger zone',
    'set.adminNoDelete': 'An administrator account cannot be deleted here. Ask another administrator, ' +
      'or remove it from the Firebase console.',
    'set.delConfirm': 'Your account and to-dos will be <strong>permanently deleted</strong> and cannot be recovered.<br>' +
      'Enter your 6-digit PIN again to continue.',
    'set.delCancel': 'Cancel',
    'set.delGo': 'Delete permanently',
    'set.delBusy': 'Deleting…',
    'set.delOpen': 'Delete account',
    'set.delHint': 'Your account and every to-do will be permanently deleted. This cannot be undone.',
    'set.delDone': (n) => 'Your account and ' + n + ' to-do(s) have been deleted. Thank you for using the app.',
    'set.delFail': 'Deletion failed.',

    'adm.title': 'Admin panel',
    'adm.statAll': 'Accounts',
    'adm.statNew': 'Joined in 7 days',
    'adm.statBlocked': 'Blocked',
    'adm.search': 'Search name or email',
    'adm.sortJoined': 'Newest',
    'adm.sortName': 'By name',
    'adm.noMatch': 'Nothing matches that search',
    'adm.block': 'Block',
    'adm.unblock': 'Unblock',
    'adm.agreeNone': 'No consent record',
    'adm.agreeVer': (v) => 'Terms ' + v,
    'adm.agreeMktOn': 'Marketing: yes',
    'adm.agreeMktOff': 'Marketing: no',
    'adm.pending': 'Sign-up requests',
    'adm.all': 'All members',
    'adm.noPending': 'No pending requests',
    'adm.noUsers': 'No members',
    'adm.reject': 'Reject',
    'adm.approve': 'Approve',
    'adm.resetPin': 'Send PIN reset',
    'adm.delete': 'Delete permanently',
    'adm.joined': (d) => 'requested ' + d,
    'adm.migrate': 'Data migration',
    'adm.migrateHint': 'Uploads to-dos still in this device’s localStorage to your account, once.',
    'adm.migrateBtn': 'Upload localStorage → Firestore',
    'adm.stPending': 'Pending', 'adm.stApproved': 'Approved', 'adm.stRejected': 'Rejected',
    'adm.ageOver14': '14 or older',
    'adm.ageUnder14': 'Under 14 · guardian consent',
    'adm.ageNone': 'No consent on file',
    'adm.askReset': (n, e) => 'Send a PIN reset email to ' + n + ' at ' + e + '?',
    'adm.resetSent': 'Reset email sent.',
    'adm.askDelete': (n) => n + '’s account and every to-do will be permanently deleted.\n' +
      'This cannot be undone.',
    'adm.deleteDone': (n, c) => 'Deleted ' + n + '’s account and ' + c + ' to-do(s).\n\n' +
      'Remember to remove the account from Firebase console → Authentication.',
    'adm.askMigrate': 'Running this on another device will overwrite your data.\n\n' +
      'Upload the to-dos left in this device’s localStorage to Firestore?',
    'adm.migrateDone': (n) => 'Uploaded ' + n + ' item(s).',
    'adm.migrateNone': 'Nothing to upload.',

    'err.login': 'That name or PIN is not correct.',
    'err.nameTaken': 'That name is already taken.',
    'err.emailUsed': 'That email address is already registered.',
    'err.emailBad': 'That email address is not valid.',
    'err.weakPin': 'The PIN must be 6 digits.',
    'err.needAgree': 'You must accept the required agreements to sign up.',
    'err.signup': (c) => 'Sign-up failed. (' + c + ')',
    'err.noProfile': 'No account information found.',
    'err.pending': 'Waiting for administrator approval.',
    'err.rejected': 'This sign-up request was rejected.',
    'err.needLogin': 'You need to be signed in.',
    'err.badPin': 'That PIN is not correct.',
    'err.loadProfile': 'Could not load your account',
    'err.loadTodos': 'Could not load your to-dos',
    'err.loadUsers': 'Could not load the member list',
    'err.save': 'Could not save',
    'err.settings': 'Could not save your settings',
    'err.logout': 'Sign-out failed',
    'err.status': 'Could not change the status',
    'err.mail': 'Could not send the email',
    'err.delete': 'Deletion failed',
    'err.upload': 'Upload failed'
  }
};

function t(k, a, b) {
  const table = STR[SETTINGS.lang] || STR.ko;
  const v = table[k] !== undefined ? table[k] : STR.ko[k];
  if (v === undefined) return k;
  return typeof v === 'function' ? v(a, b) : v;
}
