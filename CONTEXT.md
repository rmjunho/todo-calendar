# CONTEXT — 개인 할 일 캘린더

> 다음 세션이 이 파일만 읽고 바로 작업할 수 있게 정리한 문서.
> 무엇을 왜 바꿨는지는 [CHANGELOG.md](CHANGELOG.md) 를 보세요.

**최종 갱신:** 2026-07-26 · **본진:** `C:\Users\LENOVO\dev\todo-calendar` (git `main`)

**배포됨:** <https://todo-calendar.kro.kr> (GitHub Pages + `CNAME`) · 커밋 `6bb4e47` 이
`origin/main` 과 같고 워킹트리는 깨끗합니다. **보안 규칙도 배포 완료**
(`firebase deploy --only firestore:rules`, 커밋 `147e1f9`).

### 2026-07-26 에 끝낸 것

- **Firebase 연동** — localStorage 를 버리고 Auth + Firestore 로. 기기 간 동기화됨
- **약관 동의 절차** — 필수/선택 동의·나이 확인·전문 모달, `users/{uid}.agreements`
  기록. 필수 동의는 규칙이 서버에서 강제
- **보안 규칙 배포** — `exists()` 가드 포함. 콘솔 게시까지 완료
- **계정 완전 삭제(관리자)** — Auth 계정만 콘솔에서 수동
- **회원 본인 탈퇴 — 실경로 검증 완료.** 탈퇴테스트 계정 + 할 일 4개로
  Auth / `users` / `usernames` 세 곳 모두 삭제되는 것을 확인
- **`delete-account.html` 배포** — 로그인 못 하는 사용자의 유일한 창구
- **처리방침 연락처** — 이준호 / ij1481534943@gmail.com
- **PIN 재설정 메일 동작 확인** (이전 세션)
- **`?selftest` 26개 통과** — Firebase 연동 후에도 유효

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
`selftest: all checks passed` (검사 26개).

**관리자 계정:** 자동 생성되지 않습니다. 일반 회원가입을 한 뒤 Firebase 콘솔에서
`users/{uid}` 문서의 `role` 을 `admin`, `status` 를 `approved` 로 직접 고치세요.
(첫 관리자 부트스트랩 코드를 짜는 것보다 클릭 두 번이 쌉니다.)

**Firebase 콘솔 설정은 끝나 있습니다** (이메일/비밀번호 로그인, 승인된 도메인,
보안 규칙). 규칙을 고쳤을 때만 다시 올리면 됩니다:

```bash
cd C:\Users\LENOVO\dev\todo-calendar && firebase deploy --only firestore:rules
```

⚠️ **규칙은 항상 코드를 배포한 뒤에 올리세요.** `users` 의 `create` 가 약관 동의
필드를 요구해서, 규칙이 앞서면 아직 옛 코드를 받은 브라우저의 가입이 전부 실패합니다.
(에뮬레이터로 미리 시험하려면 Java 가 필요한데 지금 이 PC 에는 없습니다.)

---

## 1. 파일 구조

```
dev\todo-calendar\
├── index.html                     껍데기. <link> 3개 + <script> 4개. 로드 순서 고정.
├── css\style.css           8.2KB  입체감 토큰 + DS 컴포넌트 CSS 포팅
├── js\auth.js                     로그인 화면·PIN 검증·회원 관리 시트
├── js\calendar.js                 유틸·반복 규칙·state·달력 렌더
├── js\todo.js                     할 일 CRUD·입력 시트·이벤트·부트스트랩
├── js\firebase.js                 ★ ESM 모듈. Auth·Firestore 전담. window.fb 로 노출
├── js\firebase-config.js          프로젝트 설정값 (공개돼도 되는 값)
├── js\legal.js                    약관 본문·버전 상수. 모달과 아래 두 페이지가 같이 읽음
├── terms.html                     이용약관 단독 페이지 (스토어 제출용 URL)
├── privacy.html                   개인정보 처리방침 단독 페이지
├── delete-account.html            계정 삭제 요청 안내. ★ 본문이 정적 HTML (아래 참고)
├── firestore.rules                보안 규칙. 콘솔에 붙여넣어 게시할 것
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

```
legal.js  →  auth.js  →  calendar.js  →  todo.js   (클래식, 전역 스코프 공유)
                      ↓  나중에
firebase.js                                        (ESM 모듈)
```

`legal.js` 는 상수만 담고 아무것도 호출하지 않아서 맨 앞이면 충분합니다. `terms.html`
과 `privacy.html` 은 이 파일 하나만 읽어 본문을 주입하므로, 약관 문구를 고칠 곳은
`js\legal.js` 뿐입니다 — 세 군데에 복사하면 반드시 어긋납니다.

앞 3개는 **순서를 바꾸면 안 됩니다.** `calendar.js` 의 `state` 리터럴이
`blankAuth()`(auth.js)를 호출하고, `todo.js` 끝에서 `render()` 가 앱을 띄웁니다.
세 파일은 모듈이 아니라 전역 스코프를 공유합니다.

`firebase.js` 만 `type="module"` 입니다. 모듈은 클래식 스크립트가 다 돈 **뒤에**
실행되므로 순서를 신경 쓸 필요가 없고, 오히려 그 성질을 이용합니다 — 3개가 먼저
`state.booting` 로딩 화면을 그리고, 모듈이 `onAuthStateChanged` 로 세션을 복원한
뒤 `render()` 를 다시 부릅니다. 그래서 새로고침해도 로그인 화면이 번쩍이지
않습니다.

**세 파일에 `import`/`export` 를 붙이지 마세요.** 모듈로 바꾸는 순간 전역 공유가
끊겨 함수 참조가 전부 깨집니다. 모듈 코드는 클래식 스크립트의 최상위
`const`/`function` 을 그대로 읽을 수 있으므로 (전역 렉시컬 환경 공유) 반대 방향
— 모듈 하나만 추가하고 `window.fb` 로 내보내기 — 로 붙였습니다.

### 중복 파일 정리 안내

`할일캘린더.html`, `legacy\index-single-file.html` 둘 다 **분리 전 버전과 동일한
코드**입니다 (함수 48개·한글 문자열 24개 완전 일치). 차이는 딱 한 줄 —
`_ds` 링크 vs 토큰 인라인. 지울지 말지는 판단해서 결정하세요. git 커밋
`6c98f75 backup: 정리 전 원본 전체` 에 원본 17개 파일이 전부 들어 있습니다.

---

## 2. 주요 함수 위치

### js\auth.js — 계정 (화면·검증만. 실제 인증은 firebase.js)
| 함수 | 역할 |
|---|---|
| `validPin` / `validEmail` / `normName` | **PIN은 숫자 6자리 고정** · 이메일 형식 · 이름 trim |
| `blankAuth` | 로그인 폼 초기값. `state.auth` 모양의 단일 출처 |
| `login` / `signup` / `logout` | `fb.*` 호출 후 결과만 화면에 반영 |
| `decide` / `resetPin` / `migrateLocal` | 승인·거절 · PIN 재설정 메일 · localStorage 업로드 |
| **`agreeMissing`** | **필수 동의 검사.** 미충족 항목의 안내 문구를 돌려준다 |
| `renderAgree` / `renderLegalSheet` | 동의 체크 UI · 약관 전문 모달 (본문은 `LEGAL`) |
| `ageBadge` | 관리자 패널의 나이 배지. `agreements` 가 없으면 "약관 미동의" |
| **`canDeleteSelf`** | **관리자는 스스로 탈퇴 불가.** 버튼 표시와 실행 양쪽에서 본다 |
| `removeSelf` / `renderSettingsSheet` | 본인 탈퇴(PIN 재입력) · 설정 시트 |
| `removeAccount` | 관리자가 남의 계정을 지운다 (Auth 계정은 콘솔에서 수동) |
| `renderAuth` / `renderAdminSheet` | 로그인 화면 · 회원 관리 바텀시트 |

### js\firebase.js — 서버 (이 파일만 ESM)
| 함수 | 역할 |
|---|---|
| `signIn` | `usernames/{name}` → email → `signInWithEmailAndPassword` |
| `signUp` | 이름 중복 검사 → 계정 생성 → users + usernames **batch** → 로그아웃 |
| `onAuthStateChanged` | 세션 복원. `status !== 'approved'` 면 즉시 signOut |
| `watch` | `todos` 실시간 구독. 관리자면 `users` 도 함께 |
| `newId` / `saveTodo` / `removeTodo` / `setToggle` | 할 일 쓰기. 완료는 `arrayUnion`/`arrayRemove` |
| `setStatus` / `resetPin` / `uploadLocal` | 관리자 기능 |
| `window.fb` | 클래식 3파일이 쓰는 유일한 창구 |

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
| `blankForm` | 입력 시트 초기값 |
| **`commit`** | **낙관적 업데이트** — 상태·렌더 먼저, Firestore 쓰기는 뒤. 실패하면 알림 |
| `toggleDone` | 반복이면 날짜 배열, 단발이면 플래그. 서버엔 `arrayUnion`/`arrayRemove` |
| `renderSheet` / `openForm` / `closeForm` / `saveForm` | 입력 시트 |
| click 위임 | 모든 버튼이 여기 하나로. `data-*` 분기 |
| input 위임 | **입력은 uncontrolled — 타이핑 시 렌더 안 함** (캐럿 보존) |
| keydown | Esc 닫기 · Enter 로그인 |
| 부트스트랩 | `render()` + 10초 타임아웃 가드 (모듈이 안 뜨면 안내 문구) |
| selftest | `?selftest` 로 15개 검사 |

렌더 흐름은 하나뿐입니다: **상태 변경 → `render()` → `#app.innerHTML` 통째로 교체.**
가상 DOM·프레임워크 없음.

---

## 3. 데이터 구조

### Firestore 경로
| 경로 | 값 |
|---|---|
| `users/{uid}` | `{ name, email, role, status, createdAt }` |
| `usernames/{name}` | `{ uid, email }` ← **로그인 전** 이름→이메일 조회용 |
| `users/{uid}/todos/{id}` | 할 일 문서. 구조는 아래와 동일 |

`usernames` 는 로그인하기 전에 읽어야 하므로 규칙에서 `get` 이 공개돼 있습니다.
대신 `list` 를 막아 뒀습니다 — 안 막으면 전체 이름·이메일이 통째로 털립니다.
이름 중복 검사도 이 문서의 존재 여부로 합니다.

### localStorage
이제 **저장에 쓰지 않습니다.** 남아 있는 옛 키(`todo-cal-users-v1`,
`todo-cal-v1:<id>`, `todo-cal-v1`)는 관리자 패널의 업로드 버튼이 읽기만 합니다.
자동 로그인은 Firebase 세션 지속성(`browserLocal` vs `browserSession`)으로
대체됐습니다.

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

`id` 는 이제 Firestore 문서 id 입니다 (`fb.newId()`). 예전 `uid()` 는 기기 간
충돌 가능성이 있어서 지웠습니다.

### 계정 (users/{uid})
```js
{
  name: '이준호',                              // 로그인 아이디 겸용. 중복 불가
  email: 'someone@example.com',                // Firebase Auth 계정 이메일. 화면엔 안 나옴
  role: 'admin'|'user',
  status: 'pending'|'approved'|'rejected',
  createdAt: <Timestamp>,
  agreements: {                                // 약관 1.0 이후 가입자만 있음
    terms:   { agreed: true, version: '1.0', at: <Timestamp> },
    privacy: { agreed: true, version: '1.0', at: <Timestamp> },
    age: 'over14'|'under14_guardian',
    marketing: true|false                      // 선택 항목
  },
  settings: { theme, lang }                    // ← 예정. §6-1 에서 추가된다.
}                                              //   update 규칙의 hasOnly 도 함께 손볼 것
```

**`agreements` 는 `create` 규칙이 강제합니다** — 필수 두 개가 `true` 가 아니거나 `age`
가 두 값 중 하나가 아니면 문서 자체가 만들어지지 않습니다. 화면 검사(`agreeMissing`)는
안내용이고, 우회하면 서버가 자릅니다.

**약관 도입 전에 가입한 계정에는 이 필드가 없습니다.** 규칙은 `create` 에만 걸리므로
로그인·읽기·할 일 동기화가 전부 그대로 동작하고, 관리자 패널에서 "약관 미동의"
배지로만 구분됩니다. 소급해서 재동의를 받는 흐름은 만들지 않았습니다.

버전 문자열은 `LEGAL.version`(js\legal.js) 한 곳에서 옵니다. 본문을 실질적으로 고치면
그 상수를 올리세요 — 이미 저장된 문서의 값은 그대로 남아 언제 무엇에 동의했는지가
남습니다.

**PIN은 어디에도 저장하지 않습니다.** Firebase Auth 비밀번호로 그대로 들어가고,
그래서 Auth 최소 길이 6자에 맞춰 **숫자 6자리 고정**입니다. 잊었을 때는 관리자가
회원 관리 시트에서 재설정 메일을 보냅니다.

### state (calendar.js:82)
```js
{
  view: 'month'|'week'|'day',
  cy, cm,              // 달력이 보고 있는 연·월
  selected: 'YYYY-MM-DD',
  items: [],           // 로그인한 계정의 할 일
  showForm, editingId, form, repeatOpen,   // 입력 시트
  users: [],           // 관리자로 로그인했을 때만 채워지는 users 스냅샷
  user: null,          // { uid, name, email, role, status }. null = 로그인 화면
  auth: blankAuth(),   // mode, name, email, pin, pin2, remember, error, notice, busy
  booting: true,       // firebase.js 가 인증 상태를 알려줄 때까지 로딩 화면
  showAdmin,
  legal: null,         // null | 'terms' | 'privacy'. 로그인 화면 위의 약관 모달
  showSettings,        // 설정 시트
  del: null            // 탈퇴 확인 { pin, error, busy }. PIN은 여기 잠깐 있다 사라진다
}
```

### 날짜 표현
전부 **로컬 시간 문자열**입니다. `Date` 객체나 UTC·타임스탬프를 쓰지 않습니다.
`parse()`(calendar.js:37)는 `'2026-07-25'` → `new Date(2026, 6, 25)` = 로컬 자정.
타임존 버그를 피하려고 의도적으로 이렇게 했습니다.

---

## 4. Firebase — 어떻게 붙어 있나

localStorage는 더 이상 저장소가 아닙니다. 아래는 연동하면서 내린 결정과, 다음에
손댈 때 밟기 쉬운 지뢰들입니다.

### 인증 — 화면은 이름+PIN, 속은 이메일+비밀번호

```
이름 ─→ usernames/{이름}.email ─┐
                                ├─→ signInWithEmailAndPassword(email, PIN)
PIN  ───────────────────────────┘
```

이메일은 **회원가입 탭에서만** 받고 로그인 화면에는 다시 나오지 않습니다.
익명 인증·구글 로그인은 쓰지 않습니다.

- **PIN은 숫자 6자리 고정**입니다. Firebase Auth 비밀번호 최소 길이가 6자라서
  예전 4자리(`4943`)는 못 씁니다. `validPin` 을 다시 느슨하게 풀면 가입 폼은
  통과하고 Auth가 `auth/weak-password` 로 거절합니다.
- **로그인 실패 사유를 구분해서 알려주지 않습니다.** 이름이 없는 건지 PIN이
  틀린 건지 나누면 이름 존재 여부가 새어 나갑니다.
- 승인 검사는 `onAuthStateChanged` 안에서 합니다. Auth 로그인 자체는 승인 전에도
  되기 때문에 `status !== 'approved'` 면 그 자리에서 `signOut` 합니다.
  **이 화면 검사만 믿으면 안 됩니다** — 데이터 접근은 보안 규칙이 따로 막습니다.
- 자동 로그인 스위치 = `setPersistence(browserLocal | browserSession)`.

### 회원가입은 순서가 까다롭습니다

`createUserWithEmailAndPassword` 는 **계정을 만들면서 곧바로 로그인**시킵니다.
그 순간 `users/{uid}` 문서는 아직 없어서 `onAuthStateChanged` 핸들러가 헛돕니다.
그래서 `busy` 플래그로 가입 중에는 인증 상태 변화를 무시합니다.

계정만 생기고 문서 생성이 실패하면 반쪽 계정이 남습니다. `catch` 에서 로그아웃해
두면 다음 로그인 때 "계정 정보를 찾을 수 없습니다"로 걸립니다 — 조용히 넘어가지
않게 하려는 의도이니 지우지 마세요.

### 보안 규칙에서 한 군데 일부러 느슨합니다

`users/{uid}` **본인 읽기는 승인 여부와 무관하게** 허용합니다. 승인 대기 중인
사람이 자기 `status` 를 확인할 방법이 이것뿐이기 때문입니다. 노출되는 건 자기
이름·이메일·상태뿐입니다. 쓰기와 `todos` 는 전부 `approved` 라야 통과합니다.

### 계정 완전 삭제 — 관리자에게 남의 할 일 읽기 권한이 열려 있습니다

회원 관리 시트의 **완전 삭제**는 `users/{uid}/todos/*` → `users/{uid}` + `usernames/{name}`
순서로 지웁니다. 계정 문서를 **마지막에** 지우는 게 중요합니다 — 먼저 지우면 목록에서
사라져서 남은 todos 를 다시 찾아갈 방법이 없어집니다.

서브컬렉션은 부모를 지워도 남고, 클라이언트 SDK 에는 재귀 삭제가 없습니다. 문서 id 를
알아야 지울 수 있는데 **id 조회(`list`)가 곧 내용 조회**라서, 관리자에게 `read` 없이
`delete` 만 주는 방법이 없습니다. 그래서 `todos` 에 `allow read, delete: if isAdmin()`
이 열려 있습니다. 막으려면 삭제를 Admin SDK(Cloud Function)로 옮겨야 합니다.
**이 사실은 개인정보 처리방침 7항에 적어 두었습니다** — 규칙을 조이거나 풀면 그 문구도
같이 고치세요.

`users` 의 `delete` 는 `request.auth.uid != uid` 를 함께 봅니다. 관리자가 자기 문서를
지우면 `isAdmin()` 이 거짓이 되어 스스로 잠기기 때문입니다. 화면에서도 본인에게는
버튼을 안 그리지만, 규칙 쪽이 진짜 방어선입니다.

**Auth 계정은 지워지지 않습니다.** 남의 Auth 계정 삭제는 Admin SDK 가 있어야 합니다.
삭제 후 안내창이 콘솔에서 지우라고 알려 주며, 지우지 않아도 `users` 문서가 없어서
로그인은 막힙니다(`onAuthStateChanged` 가 "계정 정보를 찾을 수 없습니다"로 자릅니다).

### 본인 탈퇴 — 순서가 곧 안전장치입니다

설정 시트의 **계정 삭제**는 관리자 삭제와 달리 **Auth 계정까지 완전히 사라집니다.**
본인 계정은 `deleteUser()` 로 클라이언트에서 지울 수 있어서 Cloud Function 이
필요 없습니다. `fb.deleteSelf(pin)` 이 이 순서로 움직입니다:

```
PIN 재인증 → todos 삭제 → users + usernames 삭제 → Auth 계정 삭제
```

- **PIN 재입력은 두 가지 일을 동시에 합니다.** 실수 방지 확인이자 Auth 재인증입니다.
  Auth 는 계정 삭제 같은 민감한 작업에 최근 로그인을 요구해서(`requires-recent-login`),
  오래 켜 둔 세션은 재인증 없이 삭제가 거부됩니다. 확인 절차를 그 자리에 물렸습니다.
- **Auth 를 마지막에 지우는 게 핵심입니다.** 먼저 지우면 그 순간 권한을 잃어서
  Firestore 데이터가 주인 없이 남습니다 — 아무도 읽지도 지우지도 못하는 쓰레기가
  됩니다. 순서를 바꾸지 마세요.
- 삭제는 **두 단계**입니다. `askDelete` 로 확인 화면을 열고 `confirmDelete` 로
  실행합니다. 버튼 한 번에 지워지지 않습니다. 진행 중(`del.busy`)에는 Esc 로도
  닫히지 않습니다.
- **관리자는 스스로 탈퇴할 수 없습니다.** 자기 `users` 문서를 지우면 `isAdmin()` 이
  거짓이 되어 남은 회원을 아무도 관리하지 못합니다. 화면(`canDeleteSelf`)과
  보안 규칙 양쪽에서 막습니다. 관리자를 넘기려면 콘솔에서 다른 계정의 `role` 을
  먼저 올리세요.

`usernames` 의 `delete` 는 문서 안의 `uid` 로 주인을 확인합니다
(`resource.data.uid == request.auth.uid`). 이름 선점이 탈퇴와 함께 풀립니다.

### 약관 페이지 셋 중 하나만 정적입니다

`terms.html` 과 `privacy.html` 은 본문을 `LEGAL`(js\legal.js)에서 주입하므로
**JS 를 실행하지 않는 크롤러에게는 빈 페이지**입니다(확인함). 반면
`delete-account.html` 은 본문을 HTML 에 직접 적었습니다 — 스토어 심사가 그냥 받아
읽는 URL 이고, 앱을 지운 사람이 보는 마지막 창구라 JS 에 기대면 안 되기 때문입니다.
앞의 둘도 정적으로 바꿔야 한다면 `legal.js` 를 빌드 소스로 두고 두 페이지를 생성하세요.

`users` 의 `update` 는 **관리자가, `status` 한 필드만** 바꿀 수 있습니다.
`create` 는 `status:'pending'` + `role:'user'` 로 값을 고정해서 스스로 관리자를
달고 태어나지 못하게 막습니다.

### 데이터 계층

- **`commit()`(todo.js)은 낙관적 업데이트입니다.** 화면을 먼저 바꾸고 쓰기는
  뒤에 보냅니다. 실패하면 알리고, `onSnapshot` 이 서버 값으로 되돌립니다.
  예전 `save()` 처럼 `try{}catch{}` 로 삼키지 마세요 — 여기선 데이터 소실입니다.
- **완료 체크는 `arrayUnion`/`arrayRemove`** 로 보냅니다. 배열을 통째로 교체하면
  두 기기에서 같은 날 체크했을 때 한쪽이 사라집니다(lost update).
- **문서 id는 `fb.newId()`** (Firestore 생성). 예전 `uid()` 는 지웠습니다.
- **날짜는 계속 `'YYYY-MM-DD'` 문자열**입니다. `Timestamp` 로 바꾸면 `occursOn`
  의 반복 판정과 `parse()` 의 로컬 자정 가정이 깨지고 타임존 버그가 들어옵니다.
  문자열도 Firestore에서 정렬·범위 쿼리가 정상 동작합니다. `createdAt` 만 예외.

### 렌더링 — 시트가 열려 있으면 렌더를 미룹니다

`render()` 는 `#app` 을 통째로 다시 만듭니다. 원격 스냅샷이 올 때마다 그리면
바텀 시트가 튀기 때문에 `if (!state.showForm) render()` 로 막아 뒀습니다.
시트를 닫을 때의 `render()` 가 이미 갱신된 `state.items` 를 그대로 집어갑니다.
**이 가드를 빼지 마세요.**

### 기타

- **부트스트랩에 10초 타임아웃**이 있습니다. CDN이 막히거나 오프라인이면 모듈이
  영영 안 뜨는데, 그때 로딩 화면에 사람을 가둬 두지 않으려는 장치입니다.
- **관리자 패널 업로드 버튼**은 옛 localStorage 데이터를 1회 올립니다. 지금
  로그인한 *이름* 과 맞는 옛 계정의 키를 찾아 올리므로, 다른 기기에서 누르면
  그 기기의 오래된 사본이 덮어씁니다. 확인 창이 그래서 있습니다.
- **`_ds/` 는 원본 그대로 두세요.** 수정하지 말고 `css/style.css` 에서 토큰을
  덮어쓰세요.
- **CSS 함정:** 버튼 색을 바꿀 때 `background:` (단축)를 쓰면 `--tc-sheen`
  그라데이션이 지워집니다. 반드시 **`background-color:`** 를 쓰세요.

---

## 5. 의도적으로 안 만든 것

| 생략 | 추가할 시점 |
|---|---|
| 사용자 본인의 PIN 변경 화면 | 지금은 관리자가 재설정 메일을 보내야 함 |
| 옛 계정 소급 재동의 화면 | 약관 버전을 올려서 다시 받아야 할 때 |
| 만 14세 미만의 법정대리인 *확인* 절차 | 지금은 본인 체크만 받음. 이용자가 늘면 보호자 연락처 확인이 필요 |
| Auth 계정까지 자동 삭제 | Admin SDK(Cloud Function)를 띄울 때. 지금은 콘솔에서 수동 |
| 로그인 시도 제한 | Firebase가 기본 제공하는 수준을 넘어야 할 때 |
| 오프라인 캐시(`enableIndexedDbPersistence`) | PWA 붙일 때 같이 (§6-3) |

---

## 6. 남은 작업

인프라는 끝났습니다. **1·2번이 원래 이 앱을 만든 이유**이고, 3·4번은 그걸 폰에
올리기 위한 포장입니다.

### 1. 테마 + 언어 변경 — 한 세션에서 함께

`users/{uid}` 에 `settings: { theme, lang }` 로 저장합니다. **두 기능이 저장 경로를
공유하므로 따로 하지 마세요** — 규칙과 설정 시트를 두 번 건드리게 됩니다.

- 자리는 설정 시트(`renderSettingsSheet`, auth.js)의 "계정" 아래가 자연스럽습니다.
- **`update` 규칙을 함께 손봐야 합니다.** 지금은
  `affectedKeys().hasOnly(['status'])` 로 잠겨 있어 본인이 `settings` 를 못 씁니다.
  본인이 `settings` 만 바꾸는 분기를 따로 추가하세요 — 관리자의 `status` 분기와
  섞으면 관리자가 남의 설정을 바꿀 수 있게 됩니다.
- 지금 `render()` 는 **매번 시스템 설정으로 `data-theme` 를 덮어씁니다**
  (calendar.js). 저장값이 있으면 그쪽이 이기도록 고칠 것.
- 기존 계정에는 `settings` 가 없습니다. 없으면 시스템 테마 + 한국어로 떨어뜨리세요.

### 2. 캘린더 이미지 저장·공유 (월/주/일) — **폰 실기기 검증 필수**

- 데스크톱에서 되는 것과 폰에서 되는 것이 다릅니다. iOS Safari 의 `navigator.share`
  파일 지원과 안드로이드 크롬의 다운로드 동작을 **실기기로** 확인하세요.
  데스크톱만 보고 끝내면 반드시 새어 나갑니다.
- 화면이 CSS 변수와 `_ds` 토큰에 전부 기대고 있습니다. 캔버스로 옮길 때
  `color-mix()` 와 `backdrop-filter` 는 따라오지 않습니다 — 출력 전용 마크업을
  따로 그리는 편이 빠릅니다.

### 3. PWA — 1~2일

스토어에 올리는 수단입니다. `manifest.json`(이름·아이콘·`display:standalone`·테마색),
아이콘 세트(192/512 최소), 서비스 워커.

**함정 두 개:**

- 지금 앱은 **CDN 세 곳에 의존**합니다 — Firebase SDK, Pretendard 폰트, 그리고
  `_ds/styles.css` 의 `@import` 체인. 캐싱 전략을 짜지 않으면 오프라인에서 흰 화면이
  됩니다. `@import` 로 끌려오는 토큰 파일 4개도 캐시 목록에 넣어야 합니다.
- 오프라인 캐시(`enableIndexedDbPersistence`)를 이때 같이 켤지 정하세요.
  [§5](#5-의도적으로-안-만든-것) 에서 미뤄 둔 항목입니다.

### 4. PWABuilder → TWA → 삼성 갤럭시 스토어

PWABuilder 에 배포 URL 을 넣어 TWA 패키지를 뽑고 갤럭시 스토어에 올립니다.
TWA 는 Digital Asset Links 검증이 필요해서 `/.well-known/assetlinks.json` 을
루트에 올려야 합니다 — GitHub Pages 라 그냥 파일로 두면 됩니다.

**출시 전 점검**

- 처리방침 URL `…/privacy.html`, 계정 삭제 URL `…/delete-account.html`
- 스토어에 신고하는 **수집 항목이 `privacy.html` 과 정확히 일치**해야 합니다
- ⚠️ **만 14세 미만 가입을 허용해 두어** 아동 대상 정책 심사가 까다로워집니다.
  연령 등급 신고 방식을 정하거나, 아예 만 14세 이상만 받도록 바꾸세요.
  후자면 가입 화면 선택지와 `agreements.age` 값이 함께 바뀝니다.
- ⚠️ **`LEGAL.version` 이 아직 `"1.0"` 입니다.** 처리방침 본문은 2026-07-26 에 세 번
  바뀌었는데(관리자 접근 조항 · 탈퇴 경로 · 연락처) 버전은 그대로입니다. 지금은
  동의 기록이 테스트 계정뿐이라 무해하지만, **실사용자를 받기 전에** 버전을 올릴지
  재동의를 받을지 정하세요. 안 정하면 "무엇에 동의했는지" 기록이 어긋납니다.
- Google Play / App Store 로 넓힐 때: Play 는 데이터 안전 섹션, App Store 는
  Capacitor 래핑이 추가로 필요합니다. 앱 내 계정 삭제(5.1.1(v))는 이미 갖췄습니다.
