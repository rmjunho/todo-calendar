# 개인 할 일 캘린더 — 프로젝트 운영 브리프

> **최종 갱신:** 2026-07-26 (회원 탈퇴·연락처·테마·언어 완료 반영)
> **역할:** `CONTEXT.md`의 **보완 문서**. 기술 상세는 다루지 않음.

---

## 0. 문서 체제

| 문서 | 담당 | 누가 읽나 |
|---|---|---|
| **`CONTEXT.md`** | 코드 구조, 인증 설계, 데이터 모델, 보안 규칙, 함정 | **Claude Code가 매 세션 읽음** |
| **이 문서** | 계정·환경, 스토어 전략, 세션 운영 규칙, 미확정 항목 | 사람이 읽음 |
| ~~`HANDOFF.md`~~ | **폐기** — 인증 설계가 틀렸음 | — |

**기술 사항 충돌 시 `CONTEXT.md`가 정답입니다.**

`CONTEXT.md`에 스토어 전략이나 계정 정보를 옮기지 마십시오. 그 파일은 매 세션 컨텍스트에 통째로 들어가므로, 코드 작업에 쓰이지 않는 내용은 비용만 발생시킵니다.

---

## 1. 현재 상태

### 완료 (2026-07-26 기준)

```
✅ 프로젝트 폴더 정리 (Downloads 한글 경로 → C:\Users\LENOVO\dev\todo-calendar)
✅ 단일 HTML → 모듈 분리
✅ GitHub Pages 배포 + .nojekyll + 커스텀 도메인 todo-calendar.kro.kr + HTTPS
✅ Firebase 프로젝트 (Spark, asia-northeast3) + Auth + Firestore
✅ 약관 동의 절차, 관리자 패널, 첫 관리자 부트스트랩
✅ localStorage → Firestore 이관, PC ↔ 폰 실시간 동기화 검증
✅ firebase-tools 설치 + init + firestore.rules 배포

✅ 회원 탈퇴 기능 — 실경로 검증 완료
   탈퇴테스트 계정 + 할 일 4개 → Auth / users/{uid} / usernames/{이름} 3곳 삭제 확인
   안내 문구에 삭제 개수가 표시되어 todos 배치 삭제 동작도 확인됨
✅ delete-account.html — 웹 삭제 요청 경로 (정적 HTML, JS 미사용, ko/en 2벌)
✅ firestore.rules — hasProfile() exists 가드 추가, 본인 검사를 || 왼쪽으로
✅ 개인정보처리방침 연락처 입력
✅ 테마 3종 (밝은 / 어두운 / 기기 설정) + 언어 2종 (한국어 / 영어)
   users/{uid}.settings { theme, lang } 저장, 기기 간 동기화 확인
   js/i18n.js 신설, 로그인 화면 언어 토글
✅ --tc-card-sheen 하드 엣지 제거 — 실배포 5개 화면 밝은/어두운 양쪽 확인
✅ ?selftest 40개 통과 (17 → 26 → 40으로 증가)
✅ PIN 재설정 메일 동작 확인 (이전 세션)
```

### 남은 작업

```
1. 캘린더 이미지 저장/공유 (월/주/일)   ← 폰 실기기 검증 필수. 가장 불확실한 구간
2. PWA (manifest + 서비스워커 + 아이콘)
3. PWABuilder → TWA → 삼성 갤럭시 스토어
```

**1번을 PWA 이전에 하는 이유** — 브라우저에서 되던 것이 TWA WebView에서 동작하지 않는 사례가 흔합니다. APK를 만든 뒤 발견하면 패키징 단계로 되돌아와야 합니다.

---

## 2. ⚠️ 함정 — 실제로 겪은 것만

### `git push`가 출력 없이 조용히 실패

**2026-07-26 발생.** `git push`를 쳤는데 아무 출력 없이 프롬프트가 돌아왔고, 커밋이 원격에 안 올라갔습니다. `git status`로 `Your branch is ahead of 'origin/main' by 1 commit`을 보고서야 알았습니다.

정확한 원인은 확인되지 않았습니다. **대응은 명확합니다 — 항상 `git push origin main`으로 명시하십시오.** 명시하면 정상 동작합니다.

```powershell
git push origin main        # ← 이 형태를 쓸 것
```

push 후 **`이전해시..새해시  main -> main`** 줄이 보이는지 반드시 확인하십시오. 그 줄이 없으면 안 올라간 것입니다.

### 배포 후 옛 화면이 남음 (캐시)

`index.html`은 `Cache-Control: max-age=600` — 최대 10분입니다. CSS·JS도 별도 캐시를 탑니다.

```
확인:  https://todo-calendar.kro.kr/?cb=2      ← 숫자를 바꿔가며
헤더:  curl.exe -I https://todo-calendar.kro.kr/index.html
```

`?cb=1`로 이미 옛 화면을 캐시했으면 `?cb=2`, `?cb=3`으로 바꿔야 합니다. **PWA 단계의 핵심 과제이기도 합니다 — §5 참조.**

### `--tc-sheen` 과 `--tc-card-sheen` 은 다른 토큰

`--tc-sheen`은 버튼용, `--tc-card-sheen`은 카드용입니다. **카드 문제에 버튼 토큰 값을 가져다 쓰지 마십시오.** 실제로 이 혼동으로 어두운 테마 알파를 `.16` → `.34`로 두 배 올려 멀쩡하던 화면을 망가뜨린 적이 있습니다.

그라디언트의 **마지막 stop은 반드시 alpha 0**이어야 합니다. `background-size`로 잘리는 지점에서 하드 엣지가 생기는 원인이 여기입니다.

### 세션 충돌 — 폴더가 같으면 금지

폴더를 옮기는 동안 다른 Claude Code 세션이 같은 폴더를 작업 중이었고, 결과적으로 리팩터링 산출물이 두 폴더로 쪼개졌습니다. 복구에 상당한 시간이 들었습니다.

```
✅ todo-calendar  +  다른 프로젝트 폴더    ← 병행 가능
❌ todo-calendar  +  todo-calendar        ← 금지
```

병행 시에는 **커밋을 한 번에 한 폴더씩** 하십시오. 번갈아 `git add -A` 하다 보면 어느 창에서 뭘 커밋했는지 놓칩니다.

### 커밋 전 Claude Code가 입력 대기 상태인지 확인

작업 중에 `git add -A`가 돌면 쓰다 만 파일이 커밋됩니다. 한 번 그럴 뻔했습니다.

---

## 3. 배포 절차

```powershell
cd C:\Users\LENOVO\dev\todo-calendar

# ① 확인
git diff --stat              # 예상 밖 파일이 없는지, firestore.rules 변경 여부

# ② 커밋 + push
git pull
git add -A
git commit -m "작업 내용"
git push origin main         # ← origin main 명시
#   "이전해시..새해시  main -> main" 줄 확인

# ③ Actions 초록불 대기 (1~3분)
#   github.com/rmjunho/todo-calendar → Actions 탭

# ④ 규칙이 바뀌었으면 (①에서 firestore.rules가 목록에 있었으면)
firebase deploy --only firestore:rules

# ⑤ 확인
#   https://todo-calendar.kro.kr/?cb=숫자   (숫자를 매번 바꿀 것)
```

**순서를 지키십시오 — 코드 배포가 규칙 배포보다 먼저입니다.** 규칙이 먼저 엄격해지면 캐시된 옛 코드에서 전면 실패합니다.

> **예외** — 규칙 변경이 **순수 권한 추가**일 때는 반대 순서가 맞습니다. 옛 클라이언트에 영향이 없고, 규칙을 안 올리면 로컬 검증에서 저장이 전부 `permission-denied`로 막힙니다. 테마·언어 작업이 이 경우였습니다.

---

## 4. 환경 정보

### GitHub

```
개인 계정:   rmjunho
저장소:      rmjunho/todo-calendar (Public, main)
git 설정:    user.name  = 이은총
             user.email = ij1481534943@gmail.com
gh CLI:      v2.96.0, 인증 완료 (HTTPS, keyring)
```

같은 계정의 다른 저장소: `smartchurch`, `GBM-mission`, `ak_pickleball_center`
인투유학·레베카유학·학원 홈페이지는 **별도 조직 계정 `intoedu`** — 이 프로젝트와 무관.

> **계정 분리 원칙** — GitHub 약관상 1인 1개 무료 계정. 세 번째 계정을 만들지 마십시오. 저장소별로 커밋 작성자만 분리하면 됩니다.
> ```powershell
> # 인투유학 프로젝트 폴더 안에서 (--global 없이)
> git config user.email "조직계정이메일"
> ```

### Firebase

```
프로젝트:    todo-calendar-50777 (별칭 todo-calendar)
요금제:      Spark (무료)
리전:        asia-northeast3 (서울)
콘솔 계정:   ij1481534943@gmail.com
firebase-tools: 전역 설치, 로그인 완료
```

`firebase init firestore` 선택값: Gemini **No** / 통계 수집 **No** / Agent Skills **No** / `firestore.rules` 덮어쓰기 **No**

**색인을 미리 만들지 마십시오.** 필요한 쿼리를 실행하면 브라우저 콘솔에 자동 생성 링크가 뜹니다.

### 로컬

```
경로:      C:\Users\LENOVO\dev\todo-calendar
OS:        Windows 11 (Lenovo)
로컬서버:  http://localhost:5500/index.html
```

`file://`로 열면 Firebase 인증이 동작하지 않습니다. `127.0.0.1`도 안 됩니다 — 승인된 도메인에 `localhost`만 등록돼 있습니다.

### Java — 미설치, 설치 권장

```powershell
winget install Microsoft.OpenJDK.21
```

Firebase 에뮬레이터(`firebase emulators:exec --only firestore`)에 필요합니다. 규칙을 실서비스에 올리기 전에 검증할 수 있는 유일한 수단입니다.

**설치를 권하는 이유** — 규칙은 앞으로도 계속 바뀌고, 잘못 건드리면 전 사용자가 잠깁니다. SmartChurch도 Firestore 기반이라 그대로 재사용합니다. 실서비스 규칙을 실험대로 쓰지 않으려면 필요합니다.

**단, 에뮬레이터는 규칙만 검증합니다.** Auth 계정 삭제, 재인증, 배치 청크 분할, 실패 시 안내 같은 건 여전히 실제로 돌려봐야 확인됩니다.

---

## 5. PWA 단계 필수 요건

오늘 겪은 캐시 문제에서 도출된 것입니다. **서비스워커가 들어가면 캐시가 시간이 지나도 안 풀립니다.** TWA로 패키징된 뒤엔 사용자가 캐시를 지울 방법조차 마땅치 않습니다.

```
□ 서비스워커 캐시에 버전을 붙이고, 새 버전 감지 시 즉시 교체 (skipWaiting)
□ index.html 은 network-first — 캐시 우선으로 두면 앱이 옛 버전에 갇힘
□ 스크립트 태그에 버전 쿼리(js/i18n.js?v=N) 적용 검토
□ 이미지 내보내기에 쓰는 외부 라이브러리를 캐싱 대상에 포함
□ 서비스워커 캐시 전략이 Firebase 인증 흐름을 막지 않게 할 것
□ .well-known/assetlinks.json 배치를 염두에 둘 것 (.nojekyll 있음)
□ 언어별 manifest 이름 처리 방안
□ CNAME 파일을 건드리지 말 것

측정값: index.html 은 Cache-Control: max-age=600
```

---

## 6. 스토어 출시 전략

### 왜 삼성이 먼저인가

| | 삼성 갤럭시 스토어 | 구글 플레이 |
|---|---|---|
| 가입비 | 무료 | $25 (1회) |
| 테스터 요건 | **없음** | **개인 계정은 12명 × 14일 연속 비공개 테스트 필수** |
| 심사 기간 | 공식 2~5 영업일 | 조직 계정이면 바로 프로덕션 |
| 포털 | seller.samsungapps.com | play.google.com/console |

구글의 12명 요건은 **2023년 11월 13일 이후 생성된 개인 계정**에 적용됩니다. 삼성에는 이 요건이 없어 최단 경로입니다.

> 삼성 심사가 공식 기준(2~5일)을 크게 넘겼다는 사례가 개발자 포럼에 다수 보고돼 있습니다. 실제 편차가 큽니다.

### 구글은 조직 계정으로

**조직(사업자) 계정은 12명 × 14일 요건이 면제됩니다.** 인투유학원 또는 AK 피클볼센터 사업자등록증으로 등록 가능합니다.

SmartChurch도 언젠가 스토어에 올리실 것이므로 조직 계정은 한 번 만들어두면 계속 씁니다. **승인에 며칠 걸리므로 지금 신청을 걸어두고 다른 작업을 진행하십시오.**

> 조직 계정은 D-U-N-S 번호 발급과 사업자 확인 절차가 필요합니다. 소요 기간은 확인되지 않았습니다.

### 제출 준비물

```
□ AAB/APK               PWABuilder 생성
□ 서명키 파일           ★ 별도 백업 필수 — 분실 시 앱 업데이트 영구 불가
□ 앱 아이콘 512×512
□ 스크린샷 3장 이상     폰 실기기 캡처
□ 앱 설명
✅ 개인정보처리방침 URL  https://todo-calendar.kro.kr/privacy.html
✅ 인앱 회원 탈퇴        구현 + 실경로 검증 완료
✅ 웹 삭제 요청 경로     delete-account.html (승인 못 받은 사용자용 안내 포함)
□ PIN 재설정 메일 재확인 제출 직전 한 번 더 (정책 변경 가능성)
```

### APK 생성 흐름

```
pwabuilder.com → https://todo-calendar.kro.kr 입력 → Start
→ 점수 확인 (매니페스트·서비스워커 초록불)
→ Package for stores → Android → Generate
→ ZIP 다운로드 (.aab/.apk + 서명키)
→ .well-known/assetlinks.json 을 사이트 루트에 배치
```

---

## 7. Claude Code 세션 운영 규칙

| 규칙 | 이유 |
|---|---|
| **같은 폴더에 세션 하나만** | §2 사고 재발 방지. 다른 폴더는 병행 가능 |
| 작업 단위마다 새 세션 (`/clear`) | 끝난 작업의 파일 내용이 계속 컨텍스트를 차지함 |
| 세션 종료 시 `CONTEXT.md` 갱신 | 다음 세션 첫 줄: `@CONTEXT.md 읽고 시작해줘` |
| **`CONTEXT.md`는 갱신하되 늘리지 말 것** | 매 세션 통째로 읽힘. 낡은 내용은 지우면서 갱신 |
| **"먼저 계획을 설명하고 승인 후 구현"** | 설계 오류를 코드 쓰기 전에 잡음 |
| 파일 삭제 전 반드시 git 커밋 | 되돌릴 지점 확보 |
| 삭제 줄이 많으면 무엇을 지웠는지 확인 | `git diff --stat` |
| **콘솔·PowerShell 작업은 반드시 `CONTEXT.md`에 기록** | 규칙 배포 누락이 이 경로로 발생함 |
| 조사·탐색은 서브에이전트에 위임 | 별도 컨텍스트에서 돌고 요약만 반환 |
| 70% 도달 시 `/compact <지시문>` | 지시문 없이 쓰면 필요한 맥락도 날아감 |
| 짧은 질문은 `/btw` | 대화 기록에 남지 않아 컨텍스트를 안 먹음 |

```
/context      무엇이 컨텍스트를 차지하는지 진단
/clear        완전 리셋
/compact 수정한 파일 목록, 확정된 결정사항, 남은 TODO만 남기고 나머지는 버려
Esc Esc       특정 지점 기준 부분 요약
```

---

## 8. 새 세션 프롬프트

### 기본

```
@CONTEXT.md 읽고 시작해줘.
```

### 캘린더 이미지 저장/공유 — 다음 작업

```
@CONTEXT.md 읽고 시작해줘.

월간/주간/일간 캘린더를 이미지로 만들어 저장·공유하는 기능을 붙여줘.

■ 요구사항
- 각 뷰(월/주/일)마다 "이미지로 내보내기" 버튼
- 화면을 그대로 캡처하지 말고, 내보내기 전용 고정 크기 레이아웃을 따로 만들 것
  (화면은 폰 세로 폭이고 공유 이미지는 가독성 있는 고정 크기여야 함)
- 현재 테마 색상과 현재 언어 설정을 반영
- 메모 포함 여부를 선택할 수 있게 (개인 내용이 그대로 이미지로 나가므로)

■ 반드시 반영할 것 ★
이 앱은 PWABuilder 로 TWA 안드로이드 앱으로 패키징할 예정이야.
- navigator.canShare({ files }) 로 지원 여부를 먼저 검사하고,
  미지원 환경에서는 다운로드로 폴백되게 해줘.
- 이 폴백 없이 만들면 데스크톱 크롬에서만 되는 코드가 나와.
- 외부 라이브러리를 쓴다면 무엇을 왜 골랐는지 먼저 알려주고,
  CDN 경로를 CONTEXT.md 에 기록할 것. 다음 PWA 단계에서
  서비스워커 캐싱 대상에 넣어야 함.

■ 주의
- 스크립트 로드 순서를 깨지 말 것
  (i18n → legal → auth → calendar → todo → firebase[module])
- js/firebase.js 외에 새 ESM 모듈을 만들지 말 것

■ 진행 방식
1. 구현 방식과 TWA 대응 계획을 먼저 설명해줘. 코드는 아직 쓰지 마.
2. 승인하면 구현해줘.

작업 후 ?selftest 통과 확인하고 CONTEXT.md 갱신해줘.
★ 완료 후 반드시 갤럭시 실기기에서 공유·저장을 직접 테스트할 것.
  데스크톱 크롬 결과는 근거가 안 됨.
```

### PWA

```
@CONTEXT.md 읽고 시작해줘.

삼성 갤럭시 스토어 제출용 PWA로 전환해줘.

1. manifest.json (앱명 "할 일 캘린더", theme_color 는 기본 테마 기준)
2. 192x192, 512x512 아이콘
3. 서비스워커 (오프라인에서도 화면은 뜨게)
4. index.html 에 매니페스트·서비스워커 등록 연결
5. PWABuilder 점수가 최대한 높게 나오도록 매니페스트 필드를 채워줘

■ 캐시 요건 ★ 이게 이 단계의 핵심
서비스워커가 들어가면 캐시가 시간이 지나도 안 풀려. TWA 로 패키징된 뒤엔
사용자가 캐시를 지울 방법도 마땅치 않아. 아래를 반드시 반영해줘.
- 캐시에 버전을 붙이고, 새 버전 감지 시 즉시 교체 (skipWaiting)
- index.html 은 network-first. 캐시 우선으로 두면 앱이 옛 버전에 갇힘
- 스크립트 태그에 버전 쿼리(js/i18n.js?v=N) 적용 검토
- 이미지 내보내기용 외부 라이브러리를 캐싱 대상에 포함
- 캐시 전략이 Firebase 인증 흐름을 막지 않게 할 것

■ 그 외 주의
- .well-known/assetlinks.json 배치를 염두에 둘 것 (.nojekyll 있음)
- CNAME 파일을 건드리지 말 것
- 언어별 manifest 이름 처리 방안을 함께 제안해줘

■ 진행 방식
1. 캐시 전략을 먼저 설명해줘. 코드는 아직 쓰지 마.
2. 승인하면 구현해줘.

작업 후 ?selftest 통과 확인하고 CONTEXT.md 갱신해줘.
```

---

## 9. 미확정 사항

> 사실로 전제하지 마시고 진행 시점에 확인하십시오.

| 항목 | 확인 방법 |
|---|---|
| 관리자가 남의 `settings`를 못 바꾸는지 | 규칙 텍스트상 차단 확인. **라이브 미검증** — 승인된 일반 계정으로 로그인해 관리자 문서에 `settings` 쓰기 시도 |
| `git push`가 조용히 실패한 원인 | 미확인. `git push origin main`으로 우회 중 |
| TWA WebView 에서 `navigator.share()` 파일 공유 지원 범위 | 폰 실기기 테스트 |
| TWA 에서 갤러리 직접 저장 가능 여부 (다운로드 폴더로만 갈 수도) | 폰 실기기 테스트 |
| `LEGAL.version`이 `"1.0"` 그대로임 | 처리방침 본문이 여러 번 바뀜. 실사용자 받기 전 버전 정책 확정 |
| 삼성의 안드로이드 15+ 16KB 페이지 사이즈 요건을 PWABuilder TWA 가 만족하는지 | 제출 시 반려되면 대응 |
| 삼성 개인/상업 판매자 중 어느 쪽이 D-U-N-S 를 요구하는지 | 가입 화면에서 확인 |
| 구글 조직 계정 승인 소요 기간 | 신청 후 확인 |
| 삼성이 인앱 회원 탈퇴를 요구하는지 | 구글은 요구함. 어차피 만들었음 |
| PIN 재설정 메일 (스토어 제출 직전 재확인) | 동작 확인됨. 시간 경과에 따른 정책 변경 가능성만 남음 |
| iOS 빌드용 무료 클라우드 서비스 (Mac 없음) | 해당 단계에서 조사 |
| **`kro.kr` 도메인 만료일** | 내도메인.한국에서 직접 확인 |

### 가장 큰 리스크 — `kro.kr` 도메인

**TWA는 이 도메인을 여는 껍데기입니다.** 도메인이 만료되면 스토어에 올라간 앱이 통째로 죽습니다.

무료 도메인은 주기적 갱신이 필요합니다. **스토어 제출 전에 만료일을 확인하시고 유료 도메인 전환을 진지하게 검토하십시오.** 출시 후 도메인을 바꾸면 `assetlinks.json` 재배치와 앱 재제출이 필요합니다.

---

## 10. 새 대화에서 이어가기

Claude와의 대화가 길어져 새로 시작할 때는, `CONTEXT.md`와 이 문서를 첨부하고 아래를 붙여넣으십시오.

```
개인 할 일 캘린더 프로젝트입니다. 첨부한 두 문서를 읽고 이어서 도와주세요.

CONTEXT.md       — 기술 사항의 정답. Claude Code가 매 세션 읽는 파일
PROJECT-BRIEF.md — 계정·환경, 스토어 전략, 세션 운영 규칙, 함정

남은 작업은 3개입니다.
1. 캘린더 이미지 저장/공유 (월/주/일) — 폰 실기기 검증 필수
2. PWA (manifest + 서비스워커 + 아이콘)
3. PWABuilder → TWA → 삼성 갤럭시 스토어

작업 방식:
- 제가 Claude Code에 넣을 프롬프트를 만들어 주세요
- Claude Code 결과 화면을 캡처해 드리면 검토해 주세요
- PowerShell 명령은 순서대로 알려주세요
- 배포는 git push origin main → (규칙 변경 시) firebase deploy --only firestore:rules

먼저 캘린더 이미지 저장/공유부터 시작하겠습니다.
```
