# CONTEXT — 개인 할 일 캘린더

> 다음 세션이 이 파일만 읽고 바로 작업할 수 있게 정리한 문서.
> 무엇을 왜 바꿨는지는 [CHANGELOG.md](CHANGELOG.md) 를 보세요.

**최종 갱신:** 2026-07-25 · **본진:** `C:\Users\LENOVO\dev\todo-calendar` (git `main`)

---

## 0. 실행 방법 — ⚠️ 반드시 HTTP로

```bash
cd C:\Users\LENOVO\dev\todo-calendar && python -m http.server 5500
```

그리고 <http://localhost:5500/index.html> 로 접속. `.claude/launch.json` 에 같은
설정이 들어 있습니다.

**`index.html` 을 더블클릭하면 디자인이 깨집니다.** `_ds/.../styles.css` 는 내용이
없는 `@import` 4줄짜리 매니페스트라서, `file://` 로 열면 토큰(`--bg`, `--tint` …)이
하나도 로드되지 않고 모든 색·간격·글꼴이 무효가 됩니다. 63KB `할일캘린더.html` 이
정상으로 보였던 이유가 이것 — 그 파일은 토큰을 `<style>` 로 인라인해 둔 자체 완결
버전입니다.

자체 검사: <http://localhost:5500/index.html?selftest> → 콘솔에
`selftest: all checks passed` (검사 17개).

**관리자 계정:** 이준호 / PIN `4943` (첫 실행 시 자동 생성)

---

## 1. 파일 구조

```
dev\todo-calendar\
├── index.html              714B   껍데기. <link> 3개 + <script> 3개. 로드 순서 고정.
├── css\style.css           8.2KB  입체감 토큰 + DS 컴포넌트 CSS 포팅
├── js\auth.js              173행  로그인·PIN·세션·관리자 승인
├── js\calendar.js          338행  유틸·반복 규칙·state·달력 렌더
├── js\todo.js              292행  할 일 저장·CRUD·입력 시트·이벤트·부트스트랩
├── _ds\ios-26-design-system-…\   디자인 토큰 (건드리지 말 것, 원본)
│   ├── styles.css          724B   @import 4줄 매니페스트 ← file:// 에서 깨지는 원인
│   └── tokens\             colors / typography / spacing / effects
├── 할일캘린더.html         63KB   자체 완결 단일 파일. 더블클릭용 백업.
├── CHANGELOG.md                   변경 이력
├── CONTEXT.md                     이 파일
├── Todo Calendar.dc.html   34KB   원본 디자인 시안 (Claude Design 산출물)
├── support.js              69KB   시안 전용 런타임. 앱은 안 씀.
└── legacy\
    ├── index-single-file.html  53KB  분리 전 단일 파일 버전
    └── README-handoff.md            핸드오프 번들 안내문
```

### 로드 순서가 중요합니다

`index.html` 의 `<script>` 3개는 **순서를 바꾸면 안 됩니다.**

```
auth.js  →  calendar.js  →  todo.js
```

`calendar.js:92` 가 `state` 를 만들면서 `loadUsers()`(auth.js:19)를 **파싱 시점에
동기 호출**하고, `todo.js:252-253` 이 마지막에 `restoreSession(); render();` 로
앱을 띄웁니다. 세 파일은 모듈이 아니라 **전역 스코프를 공유**합니다
(`type="module"` 아님). 함수 이름 48개가 세 파일에 겹침 없이 나뉘어 있습니다.

### 중복 파일 정리 안내

`할일캘린더.html`, `legacy\index-single-file.html` 둘 다 **분리 전 버전과 동일한
코드**입니다 (함수 48개·한글 문자열 24개 완전 일치). 차이는 딱 한 줄 —
`_ds` 링크 vs 토큰 인라인. 지울지 말지는 판단해서 결정하세요. git 커밋
`6c98f75 backup: 정리 전 원본 전체` 에 원본 17개 파일이 전부 들어 있습니다.

---

## 2. 주요 함수 위치

### js\auth.js — 계정
| 함수 | 위치 | 역할 |
|---|---|---|
| `USERS_KEY` / `SESSION_KEY` / `ADMIN` | 5, 7, 8 | 저장 키 상수 |
| `validPin` / `normName` / `findUser` | 15, 16, 17 | PIN 형식·이름 정규화·조회 |
| `loadUsers` / `saveUsers` | 19, 28 | 계정 목록 · **관리자 시딩** |
| `startSession` / `restoreSession` / `logout` | 33, 44, 50 | 세션. 자동 로그인은 opt-in |
| `login` / `signup` / `decide` | 61, 70, 86 | 인증 · 가입 신청 · 승인/거절 |
| `renderAuth` / `renderAdminSheet` | 94, 146 | 로그인 화면 · 승인 바텀시트 |

### js\calendar.js — 달력
| 함수 | 위치 | 역할 |
|---|---|---|
| `icon` | 26 | 24×24 SVG 아이콘 |
| `esc` `pad` `fmt` `parse` `addDays` `uid` | 33–39 | 유틸. `fmt`=`YYYY-MM-DD` |
| `timeLabel` | 41 | `'14:30'` → `오후 2:30` |
| **`occursOn`** | 53 | **반복 규칙 판정** (none/daily/weekly/monthly) |
| **`isDone`** | 64 | 반복은 `doneDates[]`, 단발은 `done` |
| `sortItems` / `itemsOn` | 67, 76 | 하루종일→시간→우선순위 정렬, 날짜 필터 |
| **`state`** | **82** | **전역 상태 객체 (단일 소스)** |
| `pill` / `openAttr` | 99, 112 | 셀 안 항목 뷰모델 |
| **`render`** | **115** | **`#app` 전체 innerHTML 재생성** |

### js\todo.js — 할 일
| 함수 | 위치 | 역할 |
|---|---|---|
| `STORE_KEY` | 5 | `'todo-cal-v1'` (구버전 단일 사용자 키) |
| `seed` | 7 | 샘플 6개 |
| `itemsKey` / `load` / `save` | 20, 22, 38 | 계정별 저장. 관리자가 구데이터 승계 |
| `blankForm` / `persist` | 42, 44 | `persist` = 상태+저장+렌더 한 번에 |
| `toggleDone` | 46 | 반복이면 날짜 배열, 단발이면 플래그 |
| `renderSheet` / `openForm` / `closeForm` / `saveForm` | 58, 127, 142, 149 | 입력 시트 |
| click 위임 | **164** | 모든 버튼이 여기 하나로. `data-*` 분기 |
| input 위임 | **226** | **입력은 uncontrolled — 타이핑 시 렌더 안 함** (캐럿 보존) |
| keydown | 238 | Esc 닫기 · Enter 로그인 |
| 부트스트랩 | **252-253** | `restoreSession(); render();` |
| selftest | 258 | `?selftest` 로 17개 검사 |

렌더 흐름은 하나뿐입니다: **상태 변경 → `render()` → `#app.innerHTML` 통째로 교체.**
가상 DOM·프레임워크 없음.

---

## 3. 데이터 구조

### localStorage 키
| 키 | 값 |
|---|---|
| `todo-cal-users-v1` | 계정 배열 |
| `todo-cal-session-v2` | 자동 로그인 **켠 경우에만** 사용자 id 문자열 |
| `todo-cal-v1:<userId>` | 그 계정의 할 일 배열 |
| `todo-cal-v1` | (구버전) 계정 도입 전 데이터 → 관리자가 승계 |

`v1` 세션 키는 무시합니다. 스위치를 켠 적 없는데 자동 로그인되던 버그 때문에
`v2` 로 올렸습니다 — **다시 내리지 마세요.**

### 할 일 (item)
```js
{
  id: 'k3f9a2',            // uid() = Math.random().toString(36).slice(2)
  title: '팀 주간 회의',
  date: '2026-07-25',      // fmt() 산출. 로컬 자정 기준 문자열
  time: '10:00',           // '' 이면 하루 종일
  pri: 'none'|'low'|'med'|'high',
  repeat: 'none'|'daily'|'weekly'|'monthly',
  memo: '회의실 B',
  done: false,             // repeat==='none' 일 때만 씀
  doneDates: ['2026-07-25'] // 반복 항목의 날짜별 완료. repeat!=='none' 일 때만 씀
}
```

`done` 과 `doneDates` 는 **배타적**입니다. 반복 여부에 따라 `isDone`(calendar.js:64)
이 어느 쪽을 볼지 고릅니다. 이 규칙 덕분에 이번 주에 체크해도 다음 주 항목은
미완료로 남습니다.

### 계정 (user)
```js
{
  id: 'a7x2m1',
  name: '이준호',                              // 로그인 아이디 겸용. 중복 불가
  pin: '4943',                                 // ⚠️ 평문
  role: 'admin'|'user',
  status: 'pending'|'approved'|'rejected',
  at: '2026-07-25'
}
```

### state (calendar.js:82)
```js
{
  view: 'month'|'week'|'day',
  cy, cm,              // 달력이 보고 있는 연·월
  selected: 'YYYY-MM-DD',
  items: [],           // 로그인한 계정의 할 일
  showForm, editingId, form, repeatOpen,   // 입력 시트
  users: [],           // 전체 계정 (파싱 시점에 동기 로드)
  user: null,          // 로그인한 사용자. null = 로그인 화면
  auth: { mode, name, pin, pin2, remember, error, notice },
  showAdmin
}
```

### 날짜 표현
전부 **로컬 시간 문자열**입니다. `Date` 객체나 UTC·타임스탬프를 쓰지 않습니다.
`parse()`(calendar.js:37)는 `'2026-07-25'` → `new Date(2026, 6, 25)` = 로컬 자정.
타임존 버그를 피하려고 의도적으로 이렇게 했습니다.

---

## 4. Firebase 연동 시 주의사항

현재 코드는 **처음부터 끝까지 동기(synchronous)** 입니다. Firebase는 전부
비동기라서, 아래 5개는 연동 전에 반드시 손봐야 합니다.

### 🔴 반드시 먼저 해결

**① `state` 가 파싱 시점에 동기로 만들어집니다** — 최대 걸림돌

```js
// calendar.js:92
users: loadUsers(),     // localStorage 라서 즉시 반환됨
```

Firestore 읽기는 Promise입니다. `state` 를 이렇게 초기화할 수 없습니다.
`state.users = []` 로 시작해서 로딩 화면을 먼저 렌더하고, 데이터가 도착하면
`render()` 를 다시 호출하는 구조로 뒤집어야 합니다.

**② 부트스트랩도 동기입니다**

```js
// todo.js:252-253
restoreSession();       // localStorage 즉시 읽기
render();
```

Firebase Auth는 `onAuthStateChanged` 콜백으로 세션을 복원합니다. 이 두 줄은
콜백 안으로 들어가야 하고, 그 전까지는 로딩 상태를 보여줘야 합니다. 안 그러면
새로고침할 때마다 로그인 화면이 한 번 번쩍입니다.

**③ ESM 전환 시 전역 스코프가 깨집니다**

세 파일은 지금 전역을 공유합니다. Firebase 최신 SDK는 ESM이라
`<script type="module">` 이 필요한데, 모듈로 바꾸는 순간 `state`·`render`·`fmt`
같은 참조가 **전부 끊깁니다**. 둘 중 하나를 고르세요.

- 쉬운 길: Firebase **compat CDN 전역 빌드** 사용 → 지금 구조 그대로
- 제대로: 세 파일에 `export`/`import` 를 명시적으로 추가

**④ PIN — Firestore에 절대 그대로 올리지 마세요**

지금 PIN은 평문입니다 (`auth.js:8` 에 관리자 PIN이 하드코딩). 이대로 Firestore에
올리면 보안 규칙 한 번 잘못 쓰는 순간 전부 노출됩니다. Firebase Auth로 옮기세요.

**함정:** `validPin`(auth.js:15)은 **4~8자리**를 허용하지만 Firebase Auth 비밀번호는
**최소 6자**입니다. 기존 `4943`(4자리) 같은 PIN은 그대로 못 씁니다. 셋 중 하나:
- PIN을 6자리 이상으로 강제 (기존 계정 마이그레이션 필요)
- PIN에 접두사를 붙여 내부 비밀번호 생성 (`'pin:' + pin`)
- Cloud Functions + 커스텀 토큰으로 PIN 검증

이름+PIN 로그인은 Firebase Auth에 그대로 매핑되지 않습니다. 이름을 합성 이메일
(`<slug>@todo.local`)로 바꾸는 우회가 흔한 방법입니다.

**⑤ 승인 대기 흐름은 Auth만으로 안 됩니다**

`status: pending|approved|rejected` 는 Firestore 문서 + **보안 규칙**으로 가야
합니다. Auth 계정은 승인 *전에* 이미 존재하므로, 규칙에서 로그인 여부가 아니라
`status === 'approved'` 를 검사해야 합니다. 안 하면 승인 대기 중인 사람이
데이터를 읽습니다.

### 🟡 데이터 계층

**`persist()` 의 조용한 실패** — `save()`(todo.js:38)는 `try{}catch(e){}` 로
에러를 삼킵니다. localStorage에선 용량 초과 정도였지만, Firestore에선 **네트워크
실패 = 데이터 소실**입니다. 낙관적 업데이트 + 실패 시 롤백 + 사용자 알림이
필요합니다.

**`doneDates[]` 배열 갱신 충돌** — `toggleDone`(todo.js:46)은 배열을 통째로
교체합니다. 두 기기에서 동시에 체크하면 한쪽이 사라집니다(lost update).
`arrayUnion` / `arrayRemove` 를 쓰세요.

**`uid()` 는 전역 유일하지 않습니다** — `Math.random().toString(36).slice(2)`
(calendar.js:39). 기기 간 충돌 가능. Firestore `doc().id` 로 바꾸세요.

**날짜는 문자열로 유지하는 걸 권합니다** — Firestore `Timestamp` 로 바꾸면
`occursOn`(calendar.js:53) 의 반복 판정과 `parse()` 의 로컬 자정 가정이 전부
깨지고 타임존 버그가 들어옵니다. `'YYYY-MM-DD'` 문자열은 Firestore에서도 정렬·
범위 쿼리가 정상 동작합니다.

**경로 제안:** `users/{uid}` (계정) + `users/{uid}/items/{itemId}` (할 일).
지금의 계정별 분리(`todo-cal-v1:<id>`)와 1:1로 대응됩니다.

### 🟡 렌더링

**`render()` 는 `#app` 을 통째로 다시 만듭니다** (calendar.js:115). `onSnapshot`
실시간 리스너를 붙이면 원격 변경마다 전체 재생성이 돌아 깜빡입니다.
입력 필드는 uncontrolled라 타이핑 중 캐럿은 안전하지만(todo.js:224 주석),
바텀 시트가 열려 있을 때 원격 스냅샷이 오면 화면이 튑니다. 시트가 열려 있는
동안은 렌더를 미루는 가드를 넣으세요.

### 🟡 기타

- **selftest 17개가 깨집니다** — `todo.js:258` 이하가 `state.users` 와
  localStorage를 동기로 읽고 "관리자 시딩됨"을 검사합니다. Firebase 전환 시
  이 검사들을 분리하거나 목으로 대체해야 합니다. **검사를 그냥 지우지 마세요** —
  반복 규칙 검사는 계속 유효합니다.
- **구데이터 마이그레이션** — `todo-cal-v1` → 관리자 승계 로직(todo.js:26-30)은
  Firebase가 소스가 되면 죽은 코드가 됩니다. 일회성 업로드 경로를 만들거나
  기존 localStorage 데이터는 버려집니다.
- **`_ds/` 는 원본 그대로 두세요.** 수정하지 말고 `css/style.css` 에서 토큰을
  덮어쓰세요.
- **CSS 함정:** 버튼 색을 바꿀 때 `background:` (단축)를 쓰면 `--tc-sheen`
  그라데이션이 지워집니다. 반드시 **`background-color:`** 를 쓰세요.

---

## 5. 의도적으로 안 만든 것

| 생략 | 추가할 시점 |
|---|---|
| 서버 인증 / PIN 해싱 | **지금** — Firebase 연동이 곧 이 시점 |
| PIN 변경 / 재설정 | PIN을 잊었을 때. 현재 복구 수단 **없음** |
| 계정 삭제 / 목록 관리 | 승인 회원이 늘어 정리가 필요할 때 |
| 로그인 시도 제한 | 서버 인증 이후 (클라이언트 제한은 우회됨) |
| 다크 모드 토글 UI | 원본 시안에 없음 → 시스템 설정 따름 |
