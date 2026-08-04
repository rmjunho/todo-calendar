# CLAUDE.md

**작업 전에 [CONTEXT.md](CONTEXT.md) 를 먼저 읽으세요.** 구조·근거·지뢰는 전부 거기 있습니다.
아래는 규칙만 적습니다 — 이유가 궁금하면 CONTEXT.md 를 보세요.

## 작업 방식

- **코드를 쓰기 전에 계획을 먼저 설명하고 승인을 받을 것.**
- **파일을 수정할 때마다** `git add -A && git commit -m "WIP: <무엇>"`.
  이 PC 가 예고 없이 재부팅됩니다. **푸시는 지시할 때만.**
- `firestore.rules` 를 건드릴 일이 생기면 **먼저 근거를 말할 것.**

## 코드 규칙

- 스크립트 로드 순서 유지: `i18n → legal → auth → calendar → export → todo → firebase(module)`.
- **`js/firebase.js` 외에 새 ESM 모듈 금지.**
- 클릭·입력은 기존 위임에 `case` 추가. **개별 `addEventListener` 금지.**
- 입력은 **uncontrolled** 유지 (캐럿 보존).
- 새 i18n 키는 **ko/en 양쪽에**.
- CSS 는 `background:` 단축 금지. **`background-color:`** 를 쓸 것.
- **`_ds/` 는 원본 그대로.** `css/style.css` 에서 해결.
- 시트가 열려 있을 때 `render()` 를 미루는 가드 유지.
- 새 시트를 만들면 **`sheetBusy()` 와 `applyLoggedOut()` 양쪽에** 반영.

## selftest

- 조건 함수가 아니라 **그려진 DOM** 을 볼 것.
- 단언의 기댓값을 **조건식으로 옮겨 적지 말 것** (항등식이 됨).
- `getComputedStyle` 의 px 을 **리터럴로 비교하지 말 것** (브라우저 확대에서 소수).
- **검사 개수를 손으로 세지 말 것.**
