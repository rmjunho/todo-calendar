# CONTEXT — 개인 할 일 캘린더

> 다음 세션이 이 파일만 읽고 바로 작업할 수 있게 정리한 문서.
> 무엇을 왜 바꿨는지의 이력은 [CHANGELOG.md](CHANGELOG.md) 를 보세요.
> **이 파일은 매 세션 읽힙니다. 갱신할 때 늘리지 말고 낡은 내용을 지우세요.**

**최종 갱신:** 2026-07-27 · **본진:** `C:\Users\LENOVO\dev\todo-calendar` (git `main`)
**배포됨:** <https://todo-calendar.kro.kr> (GitHub Pages + `CNAME`) · 보안 규칙도 배포 완료

기능은 다 붙었습니다 — 계정·승인·약관 동의·기기 간 동기화·본인 탈퇴·테마 3종·언어 2종·
캘린더 이미지 내보내기(캘린더·상세·메모 토글)·날짜 이동 팝오버·요일 선택 반복. 남은 것은 §6 두 개
(PWA / 스토어)와 **이미지 공유의 실기기 검증**입니다. `?selftest` 210개 통과.
개수는 이제 `ok()` 가 세어 콘솔에 찍습니다 — 손으로 센 숫자를 여기 적지 마세요.

---

## 0. 실행·배포 — ⚠️ 반드시 HTTP로

```bash
cd C:\Users\LENOVO\dev\todo-calendar && python -m http.server 5500
```

<http://localhost:5500/index.html> 로 접속. `.claude/launch.json` 에 같은 설정이 있습니다.
자체 검사는 <http://localhost:5500/index.html?selftest> → 콘솔에 `selftest: all checks passed`.

**`index.html` 을 더블클릭하면 디자인이 깨집니다.** `_ds/.../styles.css` 가 `@import`
4줄짜리 매니페스트라서 `file://` 로는 토큰(`--bg`, `--tint` …)이 하나도 안 로드됩니다.

### 배포

```bash
git push origin main
```

⚠️ **리모트를 반드시 명시하세요.** `git push` 만 쓰면 **아무 출력 없이 조용히 실패한**
사례가 있었습니다. `git status` 가 `ahead of origin/main` 이라는데 반영이 안 되면
`git push origin main` 으로 다시 하세요.

⚠️ **배포해도 옛 화면이 남습니다 — 캐시입니다.** `index.html` 이
`Cache-Control: max-age=600` 이고 CSS·JS 는 URL 이 그대로라 브라우저가 304 로 넘깁니다.
확인할 때는 `?cb=<매번 다른 숫자>` 를 붙이세요. 로컬 `python -m http.server` 도
`If-Modified-Since` 에 304 를 주므로 똑같습니다. **스크립트 태그를 추가했는데 새 파일을
요청조차 안 하면 이것입니다.**

⚠️ **`?cb=` 는 `index.html` 만 새로 받습니다 — `js/*.js` 는 URL 이 안 바뀌어 그대로
캐시가 쓰입니다.** JS 를 고치고 로컬에서 확인할 때는 **다른 포트로 띄우세요**(`5501` 등 —
캐시 키가 포트를 포함합니다). 안 그러면 옛 코드가 도는 채로 `?selftest` 가 통과해서
**고치지도 않은 것을 통과로 착각합니다**(실제로 밟았습니다). 새 함수가 있는지
(`typeof syncSheet === 'function'`) 한 줄 찍어 보는 것이 제일 확실합니다.

### 보안 규칙

```bash
firebase deploy --only firestore:rules
```

⚠️ **배포 순서는 변경 성격에 따라 다릅니다.**
- 새 필드를 *요구*하는 규칙(예: `create` 의 약관 동의) → **코드를 먼저.**
  규칙이 앞서면 옛 코드를 받은 브라우저의 가입이 전부 실패합니다.
- 권한을 *추가*만 하는 규칙(예: `settings` 분기) → **규칙을 먼저** 올려도 안전하고,
  오히려 그래야 새 코드가 바로 저장됩니다.

에뮬레이터로 미리 시험하려면 Java 가 필요한데 이 PC 에는 없습니다.

**관리자 계정은 자동 생성되지 않습니다.** 일반 가입 후 Firebase 콘솔에서 `users/{uid}` 의
`role` 을 `admin`, `status` 를 `approved` 로 고치세요. 콘솔 설정(이메일 로그인·승인된
도메인)은 이미 끝나 있습니다.

---

## 1. 파일 구조

```
dev\todo-calendar\
├── index.html                     껍데기. <link> 3개 + <script> 6개. 로드 순서 고정.
├── css\style.css                  입체감 토큰 + DS 컴포넌트 CSS 포팅
├── js\i18n.js                     ★ 테마·언어 설정 단일 소스 + 문자열 테이블(ko/en)
├── js\legal.js                    약관 본문(ko/en)·버전 상수
├── js\auth.js                     로그인 화면·PIN 검증·회원 관리·설정 시트
├── js\calendar.js                 유틸·반복 규칙·state·달력 렌더
├── js\export.js                   ★ Canvas 2D 이미지 내보내기·미리보기 시트 (외부 lib 0)
├── js\todo.js                     할 일 CRUD·입력 시트·이벤트·부트스트랩·selftest
├── js\firebase.js                 ★ ESM 모듈. Auth·Firestore 전담. window.fb 로 노출
├── js\firebase-config.js          프로젝트 설정값 (공개돼도 되는 값)
├── terms.html · privacy.html      약관 단독 페이지 (본문은 legal.js 주입)
├── delete-account.html            계정 삭제 안내. ★ 본문이 정적 HTML (ko/en 두 벌)
├── firestore.rules                보안 규칙
├── _ds\ios-26-design-system-…\   디자인 토큰 (원본. 고치지 말 것)
│   └── tokens\             colors / typography / spacing / effects
├── CHANGELOG.md · CONTEXT.md
└── 백업·시안 (앱은 안 씀)
    할일캘린더.html · Todo Calendar.dc.html · support.js · legacy\
```

`할일캘린더.html` 과 `legacy\index-single-file.html` 은 분리 전 원본과 같은 코드입니다
(토큰 인라인 여부만 다름). 원본 전체는 커밋 `6c98f75` 에 있습니다.

### 로드 순서 — 바꾸면 깨집니다

```
i18n.js → legal.js → auth.js → calendar.js → export.js → todo.js   (클래식, 전역 공유)
                                                      ↓ 나중에
firebase.js                                                        (ESM 모듈)
```

- **`i18n.js` 가 맨 앞**이라야 합니다. 로드 즉시 `applyTheme()` 을 돌려 첫 페인트 전에
  `data-theme` 을 겁니다. 뒤로 밀면 어두운 테마에서 흰 화면이 한 번 번쩍입니다.
- `i18n.js`·`legal.js` 는 **뒤 파일의 함수를 하나도 안 부릅니다**(자기 안에서 끝나는
  `loadSettings()`·`applyTheme()` 뿐이라 맨 앞에 둘 수 있습니다). 뒤 4개는 서로 의존합니다 —
  `calendar.js` 의 `state` 리터럴이 `blankAuth()`(auth.js)를 부르고, `todo.js` 끝에서
  `render()` 가 앱을 띄웁니다.
- **`export.js` 는 `calendar.js` 뒤 · `todo.js` 앞**입니다. 앞쪽에서 `state`·`fmt`·
  `itemsOn`·`PRI` 를 받아 쓰고, `todo.js` 끝의 첫 `render()` 보다 `renderExportSheet` 가
  먼저 있어야 합니다.
- **이 6개에 `import`/`export` 를 붙이지 마세요.** 모듈이 되는 순간 전역 공유가 끊겨
  함수 참조가 전부 깨집니다. 모듈은 반대 방향으로만 붙였습니다 — `firebase.js` 하나만
  ESM 이고 `window.fb` 로 내보냅니다. 모듈에서 클래식의 최상위 `const`/`function` 은
  그대로 읽힙니다(전역 렉시컬 환경 공유).
- 모듈이 **나중에 도는 성질을 이용**합니다. 클래식이 `state.booting` 로딩 화면을 먼저
  그리고, 모듈이 `onAuthStateChanged` 로 세션을 복원한 뒤 `render()` 를 다시 부릅니다.
  그래서 새로고침해도 로그인 화면이 번쩍이지 않습니다.

약관 문구를 고칠 곳은 `js\legal.js` 뿐입니다 — `terms.html`·`privacy.html` 이 이 파일을
읽어 주입합니다. 세 군데에 복사하면 반드시 어긋납니다.

---

## 2. 주요 함수 위치

### js\i18n.js — 테마·언어 (설정의 단일 소스)
| 함수 | 역할 |
|---|---|
| **`SETTINGS`** | **`{theme, lang}` 단일 소스.** `state` 에 안 넣는다 — 정적 3페이지엔 `state` 가 없어서 |
| `loadSettings` / `setSettings` | localStorage 읽기 · 검증 후 반영 + 저장 + `applyTheme()` |
| **`adoptSettings`** | **로그인 시 병합.** 있는 키는 서버가 이기고 빠진 키는 로컬 유지. `false` 면 승격 필요 |
| `okTheme` / `okLang` | 값 검증. 규칙의 `validSettings()` 와 **같은 집합을 유지할 것** |
| **`applyTheme`** | **`data-theme` 을 건다.** `system` 일 때만 `darkMQ` 를 본다 |
| `dow` `timeLabel` **`timeRange`** `monthTitle` `dayTitle` `shortDay` `dateLabel` `monthShort` `yearLabel` | **Intl. 전부 화면 표시 전용.** `timeRange(a,b)` 는 `b` 가 비면 **`timeLabel(a)` 와 문자까지 동일** — `endTime` 없는 옛 항목의 표시가 안 변하는 근거 |
| `t(key, a, b)` / `STR` | 문자열. 값이 함수면 인자로 문장을 만든다. ko / en 각 ~170개 |

### js\auth.js — 계정 (화면·검증만. 실제 인증은 firebase.js)
| 함수 | 역할 |
|---|---|
| `validPin` / `validEmail` / `normName` | **PIN은 숫자 6자리 고정** · 이메일 형식 · 이름 trim |
| `blankAuth` | 로그인 폼 초기값. `state.auth` 모양의 단일 출처 |
| `login` / `signup` / `logout` | `fb.*` 호출 후 결과만 화면에 반영 |
| `decide` / `resetPin` / `migrateLocal` | 승인·거절 · PIN 재설정 메일 · localStorage 업로드 |
| **`agreeMissing`** | **필수 동의 검사.** 미충족 항목의 안내 문구를 돌려준다 |
| `renderAgree` / `renderLegalSheet` | 동의 체크 UI · 약관 전문 모달 (본문은 `legalDoc()`) |
| `ageBadge` | 관리자 패널 나이 배지. `agreements` 가 없으면 "약관 미동의" |
| **`canDeleteSelf`** | **관리자는 스스로 탈퇴 불가.** 버튼 표시와 실행 양쪽에서 본다 |
| **`setPref`** | **테마·언어 변경 진입점.** 즉시 적용 → `render()` → 서버 저장(로그인 시에만) |
| `prefRow` / `THEME_OPTS` / `LANG_OPTS` | 선택 줄. 기존 `.seg-wrap` 재사용 (새 CSS 없음) |
| `removeSelf` / `removeAccount` | 본인 탈퇴(PIN 재입력) · 관리자가 남의 계정 삭제 |
| `renderAuth` / `renderSettingsSheet` / `renderAdminSheet` | 로그인 화면 · 설정 · 회원 관리 |

### js\firebase.js — 서버 (이 파일만 ESM)
| 함수 | 역할 |
|---|---|
| `signIn` | `usernames/{name}` → email → `signInWithEmailAndPassword` |
| `signUp` | 이름 중복 검사 → 계정 생성 → users + usernames **batch** → 로그아웃 |
| `onAuthStateChanged` | 세션 복원 · `status !== 'approved'` 면 즉시 signOut · 설정 병합/승격 |
| `watch` | `todos` 실시간 구독. 관리자면 `users` 도 함께 |
| `newId` / `saveTodo` / `removeTodo` / `setToggle` | 할 일 쓰기. 완료는 `arrayUnion`/`arrayRemove` |
| `setStatus` / `resetPin` / `deleteAccount` / `deleteSelf` / `uploadLocal` | 관리자·탈퇴 |
| **`saveSettings`** | `settings` 맵만 통째로 교체. 세션 없으면 조용히 `Promise.resolve()` |
| `window.fb` | 클래식 파일들이 쓰는 유일한 창구 |

### js\calendar.js — 달력
| 함수 | 역할 |
|---|---|
| `esc` `pad` **`fmt`** `parse` `addDays` | 유틸. **`fmt` = `YYYY-MM-DD` — 저장 키 생산자** |
| `priLabel` / **`repLabel(k, days)`** | `PRI` 는 색만 남기고 이름은 `t()` 로. **days 를 넘기면 '매주 월·수·금'** — 7개면 '매주 (매일)', 없거나 비면 '매주' |
| **`occursOn`** | **반복 규칙 판정** (none/daily/weekly/monthly). **weekly 는 `days` 가 있으면 그 요일들로, 없거나 비면 시작일 요일로** — 빼면 옛 항목이 전부 사라진다 |
| **`isDone`** | 반복은 `doneDates[]`, 단발은 `done` |
| `sortItems` / `itemsOn` | 하루종일→시간→우선순위 정렬, 날짜 필터 |
| **`dayRange`** | **일간 뷰 시간축은 유동이다** — 그날 가장 이른~가장 늦은 시각을 정시로 내림/올림, **최소 3시간**. `pxPerHour = clamp(40, round(620/시간수), 72)` 이고 **축 높이 `h` 는 반드시 `시간수 × 반올림된 pxPerHour`** 다(620 을 그대로 쓰면 마지막 눈금선이 축 밖으로 나간다: 12시간이면 620 vs **624**). 12시간이 정확히 옛 52px/시간이다. 시간 항목이 0개면 **`null` → 축을 아예 안 그린다** |
| **`dayLayout`** | **겹침 → 열 배정 (순수 함수).** 시작 오름차순(같으면 긴 것 먼저, 그래도 같으면 입력 순서) → 겹침 그룹 → 그룹 안에서 `마지막 종료 ≤ 현재 시작`인 열 재사용, 없으면 새 열. 폭은 그룹 전체 열 수로 균등 분할. **종료 없는 항목은 겹침 계산에서만 30분**이고 화면은 `marker:true` + 고정 `MARK_H` — 없는 길이를 지어내지 않는다 |
| **`dayColW` / `blockTier`** | **좁아지면 숨기지 않고 단계적으로 버린다**(`full`→`title`→`bar`, `+N` 접기 없음). 임계값은 개수가 아니라 **폭 px** — 아래 실측 참고. `dayColW` 는 뷰포트에서 **산술로** 계산한다(2패스 측정도 `@container` 도 안 쓴다 — 전자는 `render()` 뒤에 후처리 훅이 생기고 후자는 selftest 가 문자열로 못 본다) |
| **`DAY_PX`** | ⚠️ **CSS 와 이중 소스.** `{maxW 1024, outerPad 16, cardPad 16, axisW 58, gutter 6}` — 폭 사슬은 **`colW = (min(vw,1024) − 16×2 − 16×2 − 58 − 6)/cols = (vw − 128)/cols`** 다. `maxW`·`outerPad` 는 `render()` 바깥 래퍼의, `cardPad` 는 일간 뷰 카드의 인라인 값과 **같아야 한다**(`axisW`·`gutter` 만 렌더가 이 상수로 직접 생성해 어긋날 수 없다). 한쪽만 고치면 화면은 멀쩡한데 `colW` 만 틀려져 좁은 화면의 표시 단계가 한 칸씩 밀린다. ★ **`axisW` 를 깎아 폰을 `full` 로 넘기려 하지 말 것** — 58→56 으로 2px 깎아도 360 은 못 넘고 축만 좁아진다(이미 한 번 시도했다 되돌렸다). 384 를 넘기려면 4px 이 아니라 **16px** 이 필요하다(128 → `T_FULL` 132) |
| **`state`** | **전역 상태 객체 (단일 소스)** |
| **`sheetBusy`** | **시트가 열려 있나.** 원격 스냅샷 렌더를 미룰지 판정 (`showForm \|\| exp \|\| jump`) |
| **`render`** | **`#app` 전체 innerHTML 재생성.** 격자는 접는다 — 월간 **3**개·주간 **5**개까지만 그리고 나머지는 `cell.more`(`+N개`). 주간 5의 근거(실측): 칸 `min-height:320` 에 헤더 64·항목 33·`gap:4`·`+N개` 12 라 넓은 화면은 5개=273(여유 47)·6개=310(여유 10뿐)·7개=347(초과)이고, **390px 에서는 열이 51px 라 시간 라벨이 두 줄로 접혀 항목이 48 → 5개라도 348** 이다(접기 전 17개는 713). **항목 높이·글꼴·시간 라벨 형식을 바꾸면 5를 다시 재야 한다.** 그래서 **격자 칸은 `pill.timeLabel`(시작만), 넓은 곳은 `pill.range`(시작–종료)** 로 갈라 둔다 — 51px 칸에 범위를 넣으면 3~4줄이 된다. 월간 셀은 애초에 시간을 안 그린다(제목만). `+N개` 는 월간처럼 **그 날을 고를 뿐**(뷰 전환 아님)이고, 주간은 부모에 `data-day` 가 없어 **`+N개` 요소에 직접** 달아 준다. 하단 리스트는 안 접는다 |
| **`clampDay`** | **말일 클램프.** 없는 날이면 그 달 마지막 날 (1/31 → 2월 = 2/28) |
| `jumpYears` | 오늘 ±10년(21개). 보고 있는 해가 밖이면 합쳐 넣는다 |
| **`jumpTo`** | **`cy`·`cm`·`selected` 를 함께 돌려준다.** `[data-day]` 계열 — 아래 지뢰 참고 |
| `openJump` / `closeJump` | 팝오버 열기·닫기. **닫으면 고르던 값을 버린다.** 닫으며 **반드시 `render()`** |
| **`applyJump`** | **[이동] 만이 확정한다.** `jumpTo()` 로 `cy`·`cm`·`selected` 를 함께 쓴다 |
| `jumpNow` | [오늘] — `data-nav="today"` 와 같은 일 + 팝오버 닫기 |
| **`saveJumpScroll` / `applyJumpScroll`** | **두 열의 `scrollTop`.** 저장은 `render()` **진입부** — 아래 지뢰 참고 |
| `renderJumpPopover` / `jumpOffset` | 제목 아래 팝오버(바텀 시트 아님). 선택 항목을 5칸 중 3번째로 |

### js\export.js — 이미지 내보내기 (Canvas 2D. 외부 라이브러리 0)
| 함수 | 역할 |
|---|---|
| **`EX_COLORS` / `exColors`** | **캔버스용 색 상수 테이블.** `data-theme` 으로 고른다 — getComputedStyle 을 쓰지 않는 이유는 §5 |
| **`exWrap` / `exEllipsize`** | **`measure` 를 인자로 받는 순수 함수.** 한글은 글자 단위, 영문은 공백에서 끊는다 |
| **`exMonthLayout`** | 5주/6주에 따라 **높이가 변한다** (`270 + 176×주수`) |
| `exWeekLayout` / `exDayLayout` | 데이터가 높이를 정하므로 **위아래를 클램프**한다 (주 598~1700, 일 700~8000) |
| **`includeGrid` 인자** | `exMonthLayout(cy,cm,g)`·`exWeekLayout(n,g)`. **생략(`undefined`)이면 켬** — 옛 호출부의 뜻이 안 변한다. `!== false` 로 쓰지 말 것(0 이 안 꺼진다) |
| **`expCanToggle`** | **마지막 하나는 못 끈다.** `grid`↔`detail` 쌍에만 적용 — `memo` 는 항상 끌 수 있어야 한다 |
| **`exDetailLayout`** | **격자 아래 상세 목록.** 할 일이 **있는 날만** 헤더를 그린다. `hidden` 은 항목 수 |
| **`exportFilename`** | `todo-calendar-{month\|week\|day}-…png`. **주는 그 주 일요일** (ISO 주차 아님) |
| **`exportModel` / `exAttachDetail`** | 그리기 전 데이터 모델. **`includeMemo` 가 false 면 `memo` 키를 안 만든다** |
| `drawExport` / `exDrawMonth·Week·Day` | 모델 → 캔버스. 페이지 색으로 먼저 덮어 **PNG 를 불투명**하게 만든다 |
| **`exDrawRow` / `exDrawDetail`** | **아젠다 한 줄 렌더러.** 일간 뷰와 월·주 상세가 **같은 것**을 쓴다 |
| **`openExport` / `buildExport`** | **1단.** `await document.fonts.ready` → 그리기 → `toBlob` → `canShare` 검사 |
| **`shareImage` / `saveImage`** | **2단.** `share()` 는 **핸들러 안에서 await 없이** 호출. 저장은 `a[download]` |
| `toggleExportOpt` (`…Memo`/`…Detail`) / `closeExport` | 옛 objectURL revoke 후 재빌드 · 닫으며 **반드시 `render()`** |
| `renderExportSheet` | 미리보기 시트. 기존 바텀 시트와 같은 구조(`.card` 아님) |

### js\todo.js — 할 일
| 함수 | 역할 |
|---|---|
| **`commit`** | **낙관적 업데이트** — 상태·렌더 먼저, Firestore 쓰기는 뒤. 실패하면 알림 |
| `toggleDone` | 반복이면 날짜 배열, 단발이면 플래그 |
| `renderSheet` / `openForm` / `saveForm` | 입력 시트. 날짜 칸은 한 줄 통째, 시간은 시작·종료 두 칸 |
| **`endOk` / `formTimes`** | **종료 ≤ 시작이면 저장 거부**(자정 넘김 금지) · 폼 → `{time, endTime}`. 하루 종일이면 둘 다 `''` |
| **`formOk`** | **저장 가능 조건의 단일 소스.** 버튼 `disabled` · 안내 문구 · `saveForm` 가드가 전부 이것만 본다 |
| **`syncSheet`** | **입력 위임이 `render()` 대신 부르는 것.** 저장 버튼 · 종료 안내 · 날짜 옆 요일 — 아래 지뢰 참고 |
| click / input / keydown 위임 | 모든 버튼이 여기 하나로. **입력은 uncontrolled**(캐럿 보존) |
| 창 단위 리스너 | `darkMQ.change` · 1분 타이머 · **`resize`(150ms 합침)**. 셋 다 `state.view==='day' && !sheetBusy()` 가드를 탄다 — 화면을 돌리면 열 폭이 변해 표시 단계를 다시 계산해야 한다 |
| 부트스트랩 · selftest | `render()` + 10초 타임아웃 가드 · `?selftest` |
| **`ok` / `eq`** (selftest) | **첫 실패에서 안 멈춥니다.** `fails[]` 에 모아 끝에서 목록으로 찍고 한 번만 throw — 보고 전에 `state` 를 되돌리므로 **실패해도 화면은 사용자 데이터로 돌아옵니다**(옛 구조는 픽스처가 화면에 남았습니다). 실패 메시지에는 **반드시 실제 값**을 넣습니다(`ok(cond, msg, info)` 의 3번째 인자, 또는 값을 자동으로 찍는 `eq(actual, expected, msg)`). 이름만 적힌 메시지는 무엇이 틀렸는지 못 알려 줍니다.<br>★ **`getComputedStyle` 의 px 값을 리터럴로 단언하지 마세요 — 브라우저 확대에서 소수로 나옵니다.** 계산값은 저작값이 아니라 **사용값**이라 배율에 맞춰 픽셀 스냅됩니다. **180% 에서 `2px` 이 `1.11111px`(=2÷1.8)** 로 나와 구분선 검사 3개가 터졌습니다(실제로 밟음. dpr 1·1.25 에서는 안 나옵니다). 굵기가 관심사가 아니면 **`parseFloat(...) > 0` / `=== 0`** 으로 "붙었나 안 붙었나"만 보세요. 반대로 **인라인 `style.*` 은 저작값이라 안전합니다**(`'50%'`·`'66.6667%'`·`'20px'` 를 그대로 비교해도 됩니다) |

렌더 흐름은 하나뿐입니다: **상태 변경 → `render()` → `#app.innerHTML` 통째 교체.**
가상 DOM·프레임워크 없음.

---

## 3. 데이터 구조

| 경로 | 값 |
|---|---|
| `users/{uid}` | 아래 계정 문서 |
| `usernames/{name}` | `{ uid, email }` ← **로그인 전** 이름→이메일 조회용 |
| `users/{uid}/todos/{id}` | 할 일 문서 |

`usernames` 는 로그인 전에 읽어야 해서 규칙에서 `get` 이 공개돼 있습니다. 대신 `list` 를
막아 뒀습니다 — 안 막으면 전체 이름·이메일이 통째로 털립니다. 이름 중복 검사도 이 문서의
존재 여부로 합니다.

### 할 일 (item)
```js
{
  id: 'k3f9a2',             // Firestore 문서 id (fb.newId())
  title: '팀 주간 회의',
  date: '2026-07-25',       // fmt() 산출. 로컬 자정 기준 문자열
  time: '10:00',            // '' 이면 하루 종일
  endTime: '11:00',         // '' 이면 종료 없음. 자정 넘김은 입력에서 막는다
  pri: 'none'|'low'|'med'|'high',
  repeat: 'none'|'daily'|'weekly'|'monthly',
  days: [1, 3, 5],          // 0=일 ~ 6=토, 오름차순. repeat==='weekly' 일 때만 읽는다
  memo: '회의실 B',
  done: false,              // repeat==='none' 일 때만 씀
  doneDates: ['2026-07-25'] // repeat!=='none' 일 때만 씀
}
```

**`days` 는 옛 항목에 없습니다.** 없거나 비면 `occursOn` 이 **시작일의 요일**로 판정합니다
— 빼면 기존 반복 할 일이 전부 사라집니다. 필드 자체는 `done`/`doneDates` 처럼 **늘 있고**
(weekly 가 아니면 `[]`), 읽을지는 `repeat` 이 정합니다. 편집 시트가 옛 항목에 `days` 를
채워 넣지만 판정은 안 바뀝니다 — selftest 가 43일치를 비교합니다.

**`endTime` 도 옛 항목에 없습니다** — `days` 와 같은 방식입니다. 필드는 **늘 쓰고**(하루
종일이면 `time`·`endTime` 둘 다 `''`), 읽는 쪽이 `it.endTime || ''` 로 폴백합니다. 비면
`timeRange()` 가 `timeLabel()` 과 **문자 하나까지 같은 문자열**을 돌려주므로 시작 시간만
있는 기존 항목의 표시가 안 바뀝니다. **종료 ≤ 시작은 저장이 거부됩니다**(`endOk`, todo.js)
— `23:00 → 01:00` 을 허용하면 "그 날 안"이라는 전제가 깨져 반복 판정·정렬·일간 뷰가 전부
이틀짜리 항목을 다뤄야 합니다. 정렬은 `endTime` 을 안 봅니다.

`done` 과 `doneDates` 는 **배타적**입니다. `isDone` 이 반복 여부로 어느 쪽을 볼지
고릅니다 — 그래서 이번 주에 체크해도 다음 주 항목은 미완료로 남습니다.

### 계정 (users/{uid})
```js
{
  name: '이준호',                     // 로그인 아이디 겸용. 중복 불가
  email: 'someone@example.com',       // Auth 계정 이메일. 화면엔 안 나옴
  role: 'admin'|'user',
  status: 'pending'|'approved'|'rejected',
  createdAt: <Timestamp>,
  agreements: {                       // 약관 1.0 이후 가입자만 있음
    terms:   { agreed: true, version: '1.0', at: <Timestamp> },
    privacy: { agreed: true, version: '1.0', at: <Timestamp> },
    age: 'over14'|'under14_guardian',
    marketing: true|false             // 선택 항목
  },
  settings: {                         // 없을 수 있음 (도입 전 계정)
    theme: 'light'|'dark'|'system',   // 없으면 system
    lang:  'ko'|'en'                  // 없으면 ko
  }
}
```

**`agreements` 는 `create` 규칙이 서버에서 강제합니다** — 필수 두 개가 `true` 가 아니거나
`age` 가 두 값 중 하나가 아니면 문서 자체가 안 만들어집니다. 화면 검사(`agreeMissing`)는
안내용입니다.

**옛 계정에는 `agreements` 나 `settings` 가 없습니다.** 규칙은 `create`/`update` 에만
걸리므로 로그인·읽기·동기화가 전부 그대로 동작합니다. `agreements` 는 관리자 패널에서
"약관 미동의" 배지로만 구분되고(소급 재동의 흐름은 없음), `settings` 는 기본값으로
떨어졌다가 다음 로그인에 생깁니다.

**PIN은 어디에도 저장하지 않습니다.** Firebase Auth 비밀번호로 그대로 들어가고, Auth 최소
길이 6자에 맞춰 **숫자 6자리 고정**입니다.

### state (calendar.js)
```js
{
  view, cy, cm, selected: 'YYYY-MM-DD',
  items: [],           // 로그인한 계정의 할 일
  showForm, editingId, form, repeatOpen,   // 입력 시트
  users: [],           // 관리자일 때만 채워지는 users 스냅샷
  user: null,          // { uid, name, email, role, status }. null = 로그인 화면
  auth: blankAuth(),   // mode, name, email, pin, pin2, remember, error, notice, busy
  booting: true,       // firebase.js 가 인증 상태를 알려줄 때까지 로딩 화면
  showAdmin, showSettings,
  legal: null,         // null | 'terms' | 'privacy'
  del: null,           // 탈퇴 확인 { pin, error, busy }
  exp: null,           // 이미지 미리보기 { grid, detail, memo, busy, url, file, canShare, err }
  jump: null           // 년월 팝오버 { y, m, sy, sm } — y/m 은 임시 선택([이동] 전엔
                       //   cy/cm 을 안 건드림), sy/sm 은 두 열의 scrollTop
}
```
설정(`theme`/`lang`)은 여기 없습니다 — `SETTINGS`(i18n.js)에 있습니다.

### 날짜 표현
전부 **로컬 시간 문자열**입니다. `Date` 객체나 UTC·타임스탬프를 저장하지 않습니다.
`parse()` 는 `'2026-07-25'` → `new Date(2026, 6, 25)` = 로컬 자정. 타임존 버그를 피하려고
의도적으로 이렇게 했습니다. `createdAt` 만 예외(Timestamp).

---

## 4. 어떻게 붙어 있나 — 다음에 밟기 쉬운 지뢰

### 인증 — 화면은 이름+PIN, 속은 이메일+비밀번호

```
이름 ─→ usernames/{이름}.email ─┐
                                ├─→ signInWithEmailAndPassword(email, PIN)
PIN  ───────────────────────────┘
```

- **로그인 실패 사유를 구분해서 알려주지 않습니다.** 이름이 없는 건지 PIN이 틀린 건지
  나누면 이름 존재 여부가 새어 나갑니다.
- 승인 검사는 `onAuthStateChanged` 안에서 합니다. Auth 로그인 자체는 승인 전에도 되므로
  `status !== 'approved'` 면 그 자리에서 `signOut` 합니다. **이 화면 검사만 믿으면 안
  됩니다** — 데이터 접근은 규칙이 따로 막습니다.
- 자동 로그인 스위치 = `setPersistence(browserLocal | browserSession)`.
- `validPin` 을 느슨하게 풀면 가입 폼은 통과하고 Auth가 `weak-password` 로 거절합니다.

**회원가입은 순서가 까다롭습니다.** `createUserWithEmailAndPassword` 는 계정을 만들며
곧바로 로그인시키는데, 그 순간 `users/{uid}` 가 아직 없어 핸들러가 헛돕니다. 그래서
`busy` 플래그로 가입 중에는 인증 상태 변화를 무시합니다. 계정만 생기고 문서 생성이
실패하면 `catch` 에서 로그아웃합니다 — 다음 로그인 때 "계정 정보를 찾을 수 없습니다"로
걸리게 하려는 의도이니 지우지 마세요.

### 보안 규칙

**한 군데 일부러 느슨합니다.** `users/{uid}` **본인 읽기는 승인 여부와 무관하게**
허용합니다 — 승인 대기자가 자기 `status` 를 확인할 방법이 이것뿐입니다. 쓰기와 `todos` 는
전부 `approved` 라야 통과합니다.

**`update` 는 분기가 둘이고, 일부러 합치지 않았습니다.**

| 분기 | 누가 | 무엇을 |
|---|---|---|
| 1 | 관리자 (`isAdmin()`) | 남의 `status` **한 필드만** |
| 2 | 본인 (`uid == uid && approved()`) | 자기 `settings` **한 필드만** |

`hasOnly(['status','settings'])` 로 합치면 **관리자가 남의 화면 설정을 바꿀 수 있게
됩니다.** 지금은 관리자가 남의 문서에 `settings` 를 섞는 순간 분기 1이 막고, 분기 2는
`uid` 가 달라 시작도 못 합니다. `validSettings()` 가 키 목록과 값 집합을 둘 다 고정합니다
— 빼면 `users` 가 임의의 맵을 받는 통로가 됩니다.

`create` 는 `status:'pending'` + `role:'user'` 로 값을 고정해 스스로 관리자를 달고
태어나지 못하게 막습니다.

### 계정 삭제 — 순서가 곧 안전장치입니다

관리자 삭제(`deleteAccount`)는 `todos/*` → `users` + `usernames` 순입니다. 계정 문서를
**마지막에** 지워야 합니다 — 먼저 지우면 목록에서 사라져 남은 todos 를 찾아갈 방법이
없어집니다. **Auth 계정은 안 지워집니다**(Admin SDK 필요). 안내창이 콘솔에서 지우라고
알려 주고, 안 지워도 `users` 문서가 없어 로그인은 막힙니다.

본인 탈퇴(`deleteSelf`)는 **Auth 까지 완전히 사라집니다:**

```
PIN 재인증 → todos 삭제 → users + usernames 삭제 → Auth 계정 삭제
```

- **PIN 재입력은 두 가지 일을 동시에 합니다** — 실수 방지 확인이자 Auth
  재인증입니다(`requires-recent-login`). 오래 켜 둔 세션은 재인증 없이 삭제가 거부됩니다.
- **Auth 를 마지막에** 지웁니다. 먼저 지우면 그 순간 권한을 잃어 Firestore 데이터가
  아무도 읽지도 지우지도 못하는 쓰레기로 남습니다. 순서를 바꾸지 마세요.
- **관리자는 스스로 탈퇴할 수 없습니다.** 자기 문서를 지우면 `isAdmin()` 이 거짓이 되어
  남은 회원을 아무도 관리하지 못합니다. 화면과 규칙 양쪽에서 막습니다.

⚠️ **관리자에게 남의 할 일 `read` 가 열려 있습니다.** 서브컬렉션은 부모를 지워도 남고
클라이언트 SDK 에 재귀 삭제가 없는데, **id 조회(`list`)가 곧 내용 조회**라서 `read` 없이
`delete` 만 주는 방법이 없습니다. **이 사실은 처리방침 7항에 적어 두었습니다** — 규칙을
조이거나 풀면 그 문구도 같이 고치세요.

### 데이터 계층

- **`commit()` 은 낙관적 업데이트입니다.** 화면을 먼저 바꾸고 쓰기는 뒤에 보냅니다.
  실패하면 알리고 `onSnapshot` 이 서버 값으로 되돌립니다. `try{}catch{}` 로 삼키지
  마세요 — 여기선 데이터 소실입니다.
- **완료 체크는 `arrayUnion`/`arrayRemove`.** 배열을 통째로 교체하면 두 기기에서 같은 날
  체크했을 때 한쪽이 사라집니다(lost update).
- **날짜는 계속 `'YYYY-MM-DD'` 문자열.** `Timestamp` 로 바꾸면 `occursOn` 의 반복 판정과
  `parse()` 의 로컬 자정 가정이 깨집니다. 문자열도 정렬·범위 쿼리가 됩니다.

### 렌더링 — 시트가 열려 있으면 렌더를 미룹니다

`render()` 는 `#app` 을 통째로 다시 만듭니다. 원격 스냅샷마다 그리면 바텀 시트가 튀어서
`if (!sheetBusy()) render()` 로 막아 뒀습니다(입력 시트 + 이미지 미리보기). **이 가드를
빼지 마세요.** 대신 **시트를 닫는 쪽이 반드시 `render()` 를 불러야** 합니다 —
`closeForm()`·`closeExport()`·`closeJump()` 가 그때 밀린 원격 변경을 한 번에 반영합니다.
안 부르면 다른 기기에서 추가한 할 일이 화면에 영영 안 나타납니다.

### ⚠️ 입력 위임은 `render()` 를 안 부릅니다 — 파생 표시는 `syncSheet()`

입력이 **uncontrolled** 라야 캐럿이 살고, `type="date"`/`"time"` 은 **반쯤 입력한 상태에서도**
`input` 을 쏘므로 다시 그리면 편집 중인 세그먼트가 날아갑니다. 그래서 값에서 파생되는
표시(저장 버튼 `disabled` · 종료 안내 · 날짜 옆 요일)는 `syncSheet()` 가 DOM 을 직접
맞춥니다. **새 파생 표시를 시트에 추가하면 여기도 같이 보세요** — 안 그러면 값은 맞는데
화면만 안 따라오고, 조건 함수를 아무리 검사해도 selftest 가 못 잡습니다.

★ 실제로 밟았습니다: 예전 위임은 `title` 일 때만, 그것도 `formOk()` 가 아니라 제목만 보고
버튼을 켰습니다. 갤럭시에서 **종료 06:00 을 넣어도 안내가 없고 버튼이 진한 파란색인데
눌러도 아무 일이 없는** 상태가 나왔고(저장은 정상적으로 막혔습니다), 종료가 잘못된 채로
제목을 한 글자만 쳐도 버튼이 다시 켜졌습니다. 데스크톱도 같았습니다. **조건은 `formOk()`
하나로 모으고, selftest 는 조건이 아니라 그려진 `#saveBtn.disabled` 를 봅니다.**

### ⚠️ 일간 뷰 표시 단계의 실측 근거 — 주간 뷰 "5개"와 같은 성격

임계값은 **열 폭 px** 입니다(개수가 아닙니다 — 그래야 넓은 화면에서 4열이어도 시간이 남습니다).
블록 안에서 글자가 실제로 쓰는 폭은 **`colW − 21`**(왼쪽 강조선 3 + 오른쪽 구분선 2 + 좌우 패딩 8×2).

```
실측(Pretendard, document.fonts.ready 이후 span.getBoundingClientRect):
  '오후 12:30 – 오후 12:30'  11px/500 = 110.05   ← ko 가 최장 (en '12:30 PM – 12:30 PM' 은 104.44)
  '가나…'                    13px/600 =  33.11
  T_FULL  = ceil(110.05) + 21 = 132     시간 범위가 **안 잘리는** 최소 폭
  T_TITLE = ceil(33.11)  + 21 =  55     이 아래는 '…' 만 남아 정보가 0
  TWO_LINE_H = 5 + 13×1.3 + 11×1.3 + 5 = 42   두 줄이 들어가는 최소 높이
```

390px 의 열 폭은 `(390−16×2−16×2−56−4)/cols = 266/cols` 라 **2열 133(여유 1px)·3열 88.7·
4열 66.5·5열 53.2** 이고, 임계값과 만나 **2열 = full · 3·4열 = title · 5열 이상 = bar** 가
됩니다. 1024px 이상에서는 4열도 225 라 full 이 유지됩니다. **글꼴·글자 크기·패딩·구분선을
바꾸면 세 값을 다시 재야 합니다.** 폭뿐 아니라 **높이**도 봅니다 — 30분 일정은 42px 이 안 돼
넓어도 시간 라벨을 버립니다.

인접 열은 **`border-right:2px solid var(--bg)`** 로 가릅니다. `.card` 가 `var(--bg)` 라 **같은
토큰**이고 블록 배경이 반투명이라 그 자리만 카드색이 드러납니다(밝은/어두운 양쪽에서 정의상
일치. 카드 상단 96px 의 sheen 띠 안에서만 아주 미세하게 어둡습니다). **`cols > 1 && 마지막 열
아님**일 때만 붙여서 안 겹치는 날의 화면은 그대로입니다.

★ selftest 는 `var()` 를 쓴 단축 속성의 CSSOM 롱핸드가 **빈 문자열**이라(pending-substitution)
`style.borderRightWidth` 가 아니라 `getComputedStyle` 로 봅니다. **`cols===1`(안 겹치는 보통의
하루)과 3열의 가운데 열까지** 그려진 값으로 확인합니다 — 겹치는 2열만 검사하면 "마지막 열이
아닐 때"와 "열이 하나일 때"가 둘 다 안 덮입니다. 기대값은 **`parseFloat(...) > 0` / `=== 0`**
입니다 — 브라우저 확대에서 `2px` 이 `1.11111px` 로 나오므로 px 리터럴로 적으면 안 됩니다(§2).
굵기 `2` 의 소스는 `calendar.js` 한 곳이고, 이 검사의 관심사는 **구분선의 유무**뿐입니다.
조건식(`cols > 1 && col < cols - 1`)을 그대로 옮겨 적으면 항등식이 되어 아무것도 검증하지 않습니다.

### ⚠️ 시트 키를 늘리면 `applyLoggedOut()` 에도 넣으세요

`firebase.js` 의 `applyLoggedOut()` 은 열려 있던 시트를 전부 닫습니다. **빠뜨리면
`sheetBusy()` 가 영영 `true` 로 남아 재로그인 후 원격 스냅샷이 화면에 절대 안 들어옵니다**
— 조용히 "동기화가 안 되는 앱"이 됩니다. `exp` 는 `objectURL` 까지 샙니다.
`showForm`·`showAdmin` 만 있던 것을 **`exp`·`jump`·`showSettings`·`del`** 까지 넓혔습니다.
`sheetBusy()` 에 키를 하나 더할 때마다 여기도 같이 보세요.

### ⚠️ 팝오버 스크롤은 `render()` **진입부**에서 저장합니다

`render()` 는 `#app` 을 갈아엎으므로 스크롤이 매번 0 이 됩니다. 저장을 탭 핸들러에 두면
**탭을 안 거치는 경로에서 스크롤이 튑니다** — `darkMQ` 의 `change` 리스너(안드로이드 자동
다크 모드가 고르는 도중에 터집니다)와 `applyLoggedOut()` 이 그렇습니다. `sheetBusy()` 가
막아 주는 것은 원격 스냅샷뿐입니다. 진입부에 두면 앞으로 생길 경로까지 덮입니다.

### ⚠️ 캔버스 상한 8000 — 올리지 마세요

`EX_MAX_H = 8000`(export.js)은 취향이 아니라 **한계선**입니다. **캔버스는 최대 크기를
넘으면 예외 없이 빈 이미지를 냅니다** — 에러도 로그도 없이 흰 PNG 가 공유됩니다.

- **iOS Safari 의 최대 면적이 16,777,216px²** 이고, 1080 폭이면 높이 15,534 에 해당합니다.
  8000 은 **그 절반**이라 브라우저 자체 할당분의 여유가 남습니다. 상한에 붙이면 기기와
  메모리 상황에 따라 넘어갑니다.
- 비트맵 RAM 은 `1080×8000×4` = **34.6MB**, PNG 인코딩 피크가 그 두 배입니다. 12000 이면
  피크가 100MB 를 넘어 저사양 기기의 탭이 죽습니다.
- 1:7.4 가 실용 한계입니다. 메신저가 썸네일로 줄이므로 더 길면 읽을 수 없는 띠가 됩니다.

넘치는 만큼은 `+N개` 로 자릅니다. **"잘리니까 올리자"가 아니라 그 자름이 안전장치입니다.**

### ★ 남은 버그 — `< >` 가 `selected` 를 안 바꿉니다

`todo.js` 의 `[data-nav]` 는 축이 갈립니다. **월간에서 `< >` 로 달을 넘겨도 `selected` 가
그대로라 하단 리스트가 이전 달 날짜를 계속 보여줍니다.**

| 조작 | `cy`/`cm` | `selected` |
|---|---|---|
| `< >` (월간) | 바꿈 | **안 바꿈** ← 버그 |
| `< >` (주·일간) | 안 바꿈 | 바꿈 |
| `[data-day]` 셀 클릭 · `today` · **년월 점프** | 바꿈 | 바꿈 |

**이미지 내보내기·년월 점프 이전부터 있던 것**이고, 점프는 `[data-day]` 계열(`jumpTo()`)을
따르므로 영향을 안 받습니다. 고칠 때는 월간 `< >` 에서 `selected` 를 그 달 1일로 옮기면
되는데, "달을 훑어보는 동안 선택은 유지"를 의도한 것일 수도 있어 **판단이 필요합니다.**

### CSS 함정

1. **버튼 색을 바꿀 때 `background:` (단축)를 쓰면 `--tc-sheen` 이 지워집니다.**
   반드시 **`background-color:`** 를 쓰세요.
2. **`--tc-sheen`(버튼용)과 `--tc-card-sheen`(카드용)은 다른 토큰입니다.**
   **카드 문제에 `--tc-sheen` 값을 가져다 쓰지 마세요.** 분리한 이유가 아래입니다.
3. **잘리는 그라디언트는 반드시 `alpha 0` 으로 끝낼 것.** `.card` 는 sheen 을
   `background-size:100% 96px` 로 **잘라서** 씁니다. 버튼 sheen 은 불투명 stop 으로
   끝나는데 — 요소 전체 높이에 깔리니 그 stop 이 *경계*에 떨어져 아래쪽 음영이 되는, 맞는
   설계입니다 — 같은 값을 **잘라 쓰면 그 stop 이 카드 한가운데 떨어져 하드 엣지**가
   생깁니다. 밝은 테마에서 `rgb(240) → rgb(255)` **단차 15** 로 드러났고, 어두운 테마는
   `rgb(23) → rgb(28)` 단차 5라 안 보였을 뿐 같은 버그였습니다. `--tc-card-sheen` 은 양쪽
   다 마지막 stop 이 `alpha 0` 이라 어느 높이에서 잘려도 엣지가 원리적으로 안
   생깁니다(밝은 `.05/.02/0`, 어두운 `.16/.03/0`). **불투명 stop 으로 되돌리면 버그가
   그대로 돌아옵니다.** 밝은 쪽만 방향이 반대(검정→투명)입니다 — 카드가 `#fff`, 페이지가
   `#F2F2F7` 라 흰 하이라이트는 아예 안 보이고 옅은 상단 음영만 읽힙니다.
4. **`.card` 를 쓰는 곳은 9군데**입니다: 로그인 카드, 월/주/일 뷰, 할 일 리스트,
   `terms.html`, `privacy.html`, `delete-account.html` **×2(ko·en)**. 한 군데만 고치면
   나머지가 남으니 **토큰으로 고치세요.** 바텀 시트 5개(입력·설정·회원 관리·약관·
   이미지 미리보기)와 날짜 이동 팝오버는 `.card` 가 아니라 `var(--bg)` 단색이라 sheen 이
   없습니다.
5. **월간 뷰 요일 헤더 아래 실선과 일간 뷰 시간선은 sheen 이 아닙니다.**
   `border-top:.5px solid var(--separator)` 헤어라인이고 **의도된 것**입니다. 위치도
   다릅니다 — 월간 뷰 헤더는 35px, sheen 은 96px 에서 끝납니다. 같이 지우지 마세요.
6. **`_ds/` 는 원본 그대로 두세요.** `css/style.css` 에서 토큰을 덮어쓰면 됩니다.
7. **7열 격자는 `repeat(7, minmax(0,1fr))`.** `1fr`(=`minmax(auto,1fr)`)로 쓰면 nowrap
   제목(`.trunc`·`.pill`)의 min-content 가 열을 밀어내 나머지 요일이 화면 밖으로 나가고,
   `.card` 가 `overflow:hidden` 이라 가로 스크롤도 안 됩니다. **월간·주간 양쪽 다**
   해당합니다(월간은 `.cell{overflow:hidden}` 이 우연히 막고 있었을 뿐).

### 기타

- **부트스트랩에 10초 타임아웃**이 있습니다. CDN이 막히면 모듈이 영영 안 뜨는데, 그때
  로딩 화면에 사람을 가둬 두지 않으려는 장치입니다.
- **관리자 패널 업로드 버튼**은 옛 localStorage 데이터를 1회 올립니다. 다른 기기에서
  누르면 그 기기의 오래된 사본이 덮어씁니다. 확인 창이 그래서 있습니다.

---

## 5. 테마와 언어

### 값은 한 군데서만 삽니다

`js/i18n.js` 의 **`SETTINGS = { theme, lang }`** 이 유일한 소스입니다. `state` 에 안 넣은
이유는 `terms`/`privacy`/`delete-account` 페이지에 `state` 가 없기 때문입니다.

```
읽기:  Firestore(로그인 후)  >  localStorage  >  기본값(system / ko)
쓰기:  SETTINGS → localStorage(항상) → Firestore(로그인 상태일 때만)
```

`localStorage['todo-cal-settings-v1']` 은 로그인 전 임시 저장소이자 **정적 3페이지가
설정을 알아내는 유일한 창구**입니다(그 페이지들은 Firestore 를 못 읽습니다).

**로그인 시 병합:** `adoptSettings()` 에서 **있는 키는 Firestore 가 이기고, 빠진 키는
로컬 값이 살아남습니다.** 빠진 키가 있으면 그 자리에서 `saveSettings()` 로 승격
저장합니다. 이게 없으면 **로그인 화면에서 고른 언어가 첫 로그인 때 사라집니다** —
한국어를 못 읽는 사람에게는 기능이 아예 안 되는 것에 가깝습니다. 승격이 실패해도 로그인은
막지 않습니다(`console.warn` 만).

### 테마 — 새 CSS 가 필요 없습니다

`data-theme` 속성 하나가 `_ds` 토큰과 `css/style.css` 의 다크 블록을 한꺼번에 켭니다.
`applyTheme()` 은 그 속성을 **누가 정할지만** 바꿉니다:

```js
data-theme = theme === 'system' ? (darkMQ.matches ? 'dark' : 'light') : theme
```

- `i18n.js` 로드 시점에 한 번, `render()` 안에서 다시 부릅니다(멱등).
- `darkMQ` 의 `change` 리스너는 **`system` 일 때만** 의미가 있습니다. 밝은/어두운으로
  고정하면 OS 를 바꿔도 안 흔들립니다.
- ⚠️ 개발도구의 "prefers-color-scheme 강제"는 실제 `change` 이벤트를 안 쏠 수 있습니다.
  안 따라오는 것처럼 보여도 `applyTheme()` 을 직접 부르면 맞는 값이 나옵니다.

### 캔버스는 CSS 변수를 안 읽습니다 — 색 테이블이 따로 있습니다

`js/export.js` 의 `EX_COLORS` 가 light/dark 두 벌을 들고 있고, `applyTheme()` 이 걸어 둔
`data-theme` 으로 고릅니다(그래서 `system` 분기가 공짜입니다). `getComputedStyle` 로 토큰을
읽지 않는 이유는 셋입니다:

1. **캔버스는 파싱 못 하는 `fillStyle` 을 예외 없이 무시합니다.** 토큰이 언젠가
   `color-mix()`/`oklch()` 로 바뀌면 에러 하나 없이 색만 틀린 이미지가 나갑니다.
2. **어차피 화면에 없는 색이 필요합니다** — 화면 pill 은 `color-mix(… 16%, transparent)`
   인데 캔버스는 불투명 카드 위에 `rgba` 로 직접 합성합니다. 읽어 와도 델타 테이블은 남아
   소스가 둘이 됩니다.
3. **출력물은 화면이 아닙니다.** 남의 메신저에서 축소돼 읽히니 UI 보다 대비가 조금 높아야
   맞고, 그건 일부러 달라야 합니다.

**`_ds/…/tokens/colors.css` 를 고치면 `EX_COLORS` 도 같이 고치세요.** 그 대가로 고정한
것입니다.

### 언어 — Intl 은 화면에만, 데이터 키에는 절대

```
Intl (표시 전용)                 손대지 않음 (데이터 키)
─────────────────────            ──────────────────────────
dow() 요일 이름                  fmt()  ← 'YYYY-MM-DD' 생산자
monthTitle() / dayTitle()        parse() / addDays()
shortDay() / dateLabel()         occursOn() / isDone()
timeLabel() / timeRange()        item.date · item.time · item.endTime
  ↑ 오전·오후 · 시작–종료          · doneDates[] · state.selected
monthShort() / yearLabel()       clampDay() / jumpTo() ← 점프가 돌려주는 값
  ↑ 점프 피커의 년·월 이름         <input type="date"> 의 value
```

**날짜 이동 팝오버도 이 경계 위에 있습니다.** 두 열에 *보이는* 것은
`monthShort()`/`yearLabel()` 이지만, [이동] 을 눌렀을 때 `jumpTo()` 가 돌려주는 것은
**숫자 `cy`/`cm` 와 `fmt()` 문자열**뿐입니다.

**이 경계가 제일 위험한 곳입니다.** Intl 출력이 저장 경로로 새면 타임존 경계에서 할 일이
하루씩 밀립니다. `?selftest` 가 `lang='en'` 으로 바꾼 뒤 `fmt`·`addDays`·`occursOn`·
`isDone`·정렬이 **한 글자도 안 변하는지** 검사하고, 동시에 표시 문자열은 **반드시
변하는지**도 봅니다(안 변하면 Intl 이 안 걸린 것이라 그것도 실패).

- `dow()` 는 `getDay()` 색인(0=일)에 맞춰 **`new Date(2024, 0, 7+i)`** 에서 뽑습니다.
  `new Date('2024-01-07')` 은 UTC 파싱이라 시간대에 따라 하루 밀립니다.
- **주 시작 요일은 로케일과 무관하게 일요일 고정**입니다. `startOffset = getDay()` 가 그
  전제로 짜여 있습니다. Intl 은 이름만 줍니다.

문자열은 `t('키')` 로 꺼내고, 값이 함수면 `t('list.remain', 3)` 처럼 인자를 넘깁니다. 키가
없으면 ko 로, ko 에도 없으면 **키 자체를** 돌려줍니다 — 화면이 비지 않고 빠진 키가 눈에
띕니다. `firebase.js` 의 `SIGNUP_ERR` 은 **값이 아니라 키**를 들고 있습니다(값으로 굳히면
모듈 로드 시점의 언어에 고정됩니다).

**로그인 화면에도 언어 토글이 있습니다.** 설정 시트는 로그인해야 열려서, 그것만 두면
한국어를 못 읽는 사람이 영문 UI 에 도달할 방법이 없습니다. 언어 이름 자체(`한국어` /
`English`)는 번역하지 않습니다 — 읽을 수 없는 언어로 적히면 고를 수가 없습니다.

### 약관 — 한국어본이 정본입니다

`LEGAL.ko` / `LEGAL.en` 두 벌이고 `legalDoc(kind)` 가 현재 언어로 고릅니다. **두 문서
마지막 조항에 "한국어본이 정본, 영문본은 참고용"** 을 적어 두었습니다 — 영문을 고칠 때는
한국어를 먼저 고치고 맞추세요. `LEGAL.version` 은 언어별로 나누지 않습니다(동의 기록의
대상은 정본 하나입니다).

`delete-account.html` 만 다릅니다 — 본문을 주입하지 않고 **ko/en 두 벌을 정적 HTML 로
나란히 두고 `hidden` 으로 전환**합니다. 스토어 심사와 크롤러가 JS 없이 받아 읽는 URL 이라,
스크립트가 안 돌면 한국어본이 그대로 보여야 합니다. 반면 `terms.html` 과 `privacy.html` 은
JS 를 안 돌리는 크롤러에게 **빈 페이지**입니다(확인함). 이 둘도 정적으로 바꿔야 한다면
`legal.js` 를 빌드 소스로 두고 생성하세요.

---

## 6. 남은 작업

2·3번은 이 앱을 폰에 올리기 위한 포장입니다.

### 1. 캘린더 이미지 저장·공유 — **코드 완료 · 갤럭시 실기기 검증만 남음**

`js/export.js` 로 구현했습니다. `_ds` 토큰이 `color-mix()` 를 쓰는 탓에 html2canvas 는
예외를 던지므로 **Canvas 2D 로 직접** 그립니다(CDN 의존 0 — PWA 캐시 목록이 안 늘고
오프라인에서도 동작합니다). 화면을 캡처하지 않고 **출력 전용 1080px 레이아웃**을 따로
그립니다. 일간 뷰는 화면의 시간축을 옮기지 않고 아젠다 리스트로 그립니다 — 6시~24시 눈금은
900px 을 먹고 정보가 0입니다.

격자 아래에 **폭 1080 을 통째로 쓰는 상세 목록**이 붙습니다(월·주). 셀 폭이 154px 라
격자에서는 제목이 잘리는데, 상세는 안 잘립니다. 날짜 헤더는 **할 일이 있는 날만** 그리고,
일간 뷰의 아젠다 렌더러(`exDrawRow`)를 **그대로 재사용**합니다. 일간 뷰는 이미 아젠다라
토글을 안 보여 줍니다.

토글은 셋입니다 — **[캘린더 포함] · [상세 목록 포함] · [메모 포함]**(일간 뷰는 이미
아젠다라 메모만 보여 줍니다). 캘린더를 꺼도 **제목과 꼬리말은 남습니다** — 빠지면 무슨
달인지 알 수 없습니다. ★ **캘린더와 상세를 둘 다 끄면 제목만 있는 빈 이미지**가 나가므로
`expCanToggle()` 이 마지막 하나를 잠급니다(양방향 대칭. `memo` 는 안 잠깁니다).

**크기 기준선** — 다음 세션이 회귀를 판단할 실측값입니다. 데이터셋은 **2026-07 에 항목 3개**
(7/26 하루종일 1개 + 10:00 1개, 7/28 14:30 완료 1개, 앞 둘에 메모):

| 뷰 | 캘린더+상세 | 캘린더만 | 상세만 | 메모 끔(캘린더+상세) |
|---|---|---|---|---|
| 월 | 1080×1736 | **1080×1150** | 1080×800 | 1080×1612 |
| 주 | 1080×1184 | **1080×598** | 1080×800 | 1080×1060 |
| 일 | 1080×700 (토글 없음) | — | — | 1080×700 |

**캘린더만** 열이 옛 기준선과 같아야 회귀가 없는 것입니다(월 1150 / 주 598).
캘린더를 끄면 월은 **정확히 936**(`56 + 176×5`), 주는 **384** 가 빠집니다.

공식: `150(제목) + 격자 + 상세 + 64(꼬리말)`, 전체 **≤ 8000**(§4).
격자 = 월 `56 + 176×주수` · 주 `clamp(384, 96+88×가장 긴 칸+24, 1486)` · **끄면 0**.
일간은 격자 대신 아젠다라 `clamp(700, 214+행 합, 8000)`.

⚠️ **`navigator.share()` 는 사용자 제스처 처리 중에만 허용됩니다.** `canvas.toBlob()` 이
비동기라 클릭→그리기→`await`→`share()` 로 짜면 활성화가 만료돼 **폰에서만**
`NotAllowedError` 로 죽습니다(데스크톱 크롬은 빨라서 통과하므로 여기서 잡히지 않습니다).
그래서 **2단**입니다 — 시트를 여는 동안 Blob 까지 다 만들고, 시트 안의 [공유]/[저장]이
**새 제스처**가 됩니다. `shareImage()` 안에서 `await` 하지 마세요.

- 지원 검사는 **실제 `File` 로** `navigator.canShare({ files:[file] })`. `navigator.share`
  존재 여부로 판단하지 말고, 넘기는 객체에 `title`/`text`/`url` 을 섞지 마세요.
  false 면 [공유] 버튼을 아예 안 그리고 저장(`a[download]`)만 남깁니다.
- **objectURL 은 미리보기 `<img>` 와 다운로드가 함께 씁니다.** 저장 직후 revoke 하면
  미리보기가 깨집니다 — `closeExport()`/`toggleExportMemo()` 가 revoke 를 책임집니다.
- `await document.fonts.ready` 를 매번 겁니다. 안 걸면 **첫 내보내기만** 시스템 폰트입니다.
- [메모 포함] 토글은 개인정보 장치입니다. 끄면 `exportModel()` 이 `memo` **키 자체를 안
  만듭니다** — 빈 문자열로 두면 `row.memo != null` 검사에서 새어 나갑니다. **상세 목록도
  같은 `exRow()` 를 지나므로** 메모를 끄면 상세에서도 자동으로 빠집니다(토글 두 개가 따로
  놀지 않는 지점. selftest 가 모델 JSON 전체에 메모 문자열이 없는지까지 봅니다).
- 월 상세는 **그 달의 날만** 싣습니다. 앞뒤 달에서 넘어온 격자 칸은 35% 로 흐려 둔 맥락일
  뿐이라, 제목이 "2026년 7월" 인데 8월 항목을 나열하면 어긋납니다.

**★ 남은 일: 갤럭시 실기기에서 공유·저장 직접 확인.** 데스크톱 크롬 통과는 위 제스처
만료를 재현하지 못하므로 근거가 되지 않습니다. TWA 패키징(§6-3) 후에도 한 번 더 보세요.

### 2. PWA — 1~2일

`manifest.json`(이름·아이콘·`display:standalone`·테마색), 아이콘 세트(192/512 최소),
서비스 워커.

- 앱이 **CDN 세 곳에 의존**합니다 — Firebase SDK, Pretendard 폰트, `_ds/styles.css` 의
  `@import` 체인. 캐싱 전략 없이는 오프라인에서 흰 화면입니다. `@import` 로 끌려오는
  토큰 파일 4개도 캐시 목록에 넣으세요.
- 오프라인 캐시(`enableIndexedDbPersistence`)를 이때 같이 켤지 정하세요.
- `theme_color` 를 밝은/어두운 중 어느 쪽에 맞출지도 정해야 합니다.

### 3. PWABuilder → TWA → 삼성 갤럭시 스토어

배포 URL 로 TWA 패키지를 뽑아 올립니다. Digital Asset Links 검증이 필요해
`/.well-known/assetlinks.json` 을 루트에 두면 됩니다(GitHub Pages 라 파일로 충분).

**출시 전 점검**

- 처리방침 URL `…/privacy.html`, 계정 삭제 URL `…/delete-account.html`
- 스토어에 신고하는 **수집 항목이 `privacy.html` 과 정확히 일치**해야 합니다
- ⚠️ **만 14세 미만 가입을 허용해 두어** 아동 대상 정책 심사가 까다로워집니다. 연령 등급
  신고 방식을 정하거나 만 14세 이상만 받도록 바꾸세요. 후자면 가입 화면 선택지와
  `agreements.age` 값이 함께 바뀝니다.
- ⚠️ **`LEGAL.version` 이 아직 `"1.0"` 입니다.** 처리방침 본문은 그 뒤로 여러 번
  바뀌었습니다(관리자 접근 조항·탈퇴 경로·연락처·영문본·준거 언어 조항). 지금은 동의
  기록이 테스트 계정뿐이라 무해하지만, **실사용자를 받기 전에** 버전을 올릴지 재동의를
  받을지 정하세요. 안 정하면 "무엇에 동의했는지" 기록이 어긋납니다.
- 영문 UI 가 있으므로 스토어 리스팅에 영어를 넣을지 정하세요. 넣는다면 **약관 영문본이
  참고용이라는 점**을 설명란에도 적는 편이 안전합니다.
- Google Play / App Store 로 넓힐 때: Play 는 데이터 안전 섹션, App Store 는 Capacitor
  래핑이 추가로 필요합니다. 앱 내 계정 삭제(5.1.1(v))는 이미 갖췄습니다.

---

## 7. 의도적으로 안 만든 것

| 생략 | 추가할 시점 |
|---|---|
| 사용자 본인의 PIN 변경 화면 | 지금은 관리자가 재설정 메일을 보내야 함 |
| 옛 계정 소급 재동의 화면 | 약관 버전을 올려서 다시 받아야 할 때 |
| 만 14세 미만의 법정대리인 *확인* 절차 | 지금은 본인 체크만. 이용자가 늘면 필요 |
| Auth 계정까지 자동 삭제(관리자) | Admin SDK(Cloud Function)를 띄울 때 |
| 로그인 시도 제한 | Firebase 기본 제공 수준을 넘어야 할 때 |
| 오프라인 캐시 | PWA 붙일 때 같이 (§6-2) |
| 전 요일 선택(`days` 7개)을 `daily` 로 자동 변환 | 사용자가 고른 것을 앱이 고쳐 쓰지 않는다. 라벨만 "매주 (매일)" 로 구분 |
| 세 번째 언어 | `STR` 에 키 추가 + `LANGS` 와 규칙의 `validSettings` 를 함께 넓힐 것 |
| 약관 영문본의 법적 검토 | 영어권 실사용자를 받을 때. 지금은 한국어본이 정본 |
