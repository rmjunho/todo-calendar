'use strict';
// 할 일 저장 · CRUD · 입력 시트 · 이벤트 바인딩. 마지막에 로드된다.

// ---------------------------------------------------------------- persistence
// 할 일은 users/{uid}/todos/{id} 에 산다. 목록은 firebase.js 의 onSnapshot 이
// state.items 로 흘려 넣는다 — 여기서는 쓰기만 한다.
// ★ 새 항목의 기본 카테고리는 **지금 걸린 필터**다. 필터가 '업무' 인데 새 할 일이
//   '없음' 으로 태어나면 저장하자마자 화면에서 사라진다(필터가 걸러낸다).
// ★ 종류 기본값도 같은 이유로 지금 걸린 종류 필터다 — '일정' 만 보는 화면에서 새
//   항목이 할 일로 태어나면 저장하자마자 화면에서 사라진다.
const blankForm = (date, kind) => ({ title: '', date, kind: kind || 'todo',
  hasSpan: false, endDate: date, hasTime: false, time: '07:00', end: '08:00',
  categoryId: state.filter || '', repeat: 'none', days: [], memo: '' });

// 폼 → 기간(일). 일정이 아니거나 '여러 날' 이 꺼져 있으면 늘 1이다 — span 은 일정 전용이다.
// 종료가 시작보다 빠르면 0 이하가, 날짜가 비면 NaN 이 나오고 spanOk() 가 저장을 막는다.
const formSpan = (f) => (f.kind === 'event' && f.hasSpan ? daysBetween(f.date, f.endDate) + 1 : 1);
// 회차가 자기 자신과 겹치면 안 된다 — '매주 8일짜리' 는 다음 회차와 포개져서
// occStart() 의 "한 날을 덮는 회차는 최대 하나" 전제가 깨진다(막대가 사라지거나 겹친다).
// 반복 안 함이면 REP_GAP 이 Infinity 라 상한이 없다.
const spanOk = (f) => { const n = formSpan(f); return n >= 1 && n <= REP_GAP[f.repeat || 'none']; };
// 아래 둘은 renderSheet 와 syncSheet 가 **같이** 쓴다 — 두 곳이 문자열을 따로 만들면
// 입력하는 동안만 다른 문구가 뜬다.
const spanLabel = (f) => { const n = formSpan(f); return n > 1 ? t('form.spanDays', n) : t('form.spanOne'); };
const spanWarn = (f) => (formSpan(f) < 1 ? t('form.spanBefore')
  : t('form.spanTooLong', REP_GAP[f.repeat || 'none']));

// ★ 자정 넘김을 막는다. 종료가 시작보다 빠르거나 같으면 저장하지 않는다 —
//   23:00 → 01:00 을 허용하면 "그 날 안"이라는 전제가 깨져서 반복 판정·정렬·
//   일간 뷰가 전부 이틀에 걸친 항목을 다뤄야 한다. 'HH:MM' 은 사전순이 곧
//   시간순이라 문자열 비교로 충분하다 (Date 를 만들면 타임존이 끼어든다).
// ★ 여러 날 일정은 예외다 — 시작 시각은 첫날, 종료 시각은 **마지막 날**에 붙어서
//   09:00 시작 / 08:00 종료도 자정을 안 넘는다. 하루로 줄이면 다시 걸린다.
const endOk = (f) => !f.hasTime || !f.end || formSpan(f) > 1 || f.end > f.time;
// 폼 → 저장값. 하루 종일이면 둘 다 비운다. weekly 의 days 와 같은 방식으로
// endTime 은 **늘 쓴다** — 옛 문서엔 키가 없고, 읽는 쪽이 `|| ''` 로 폴백한다.
const formTimes = (f) => (f.hasTime ? { time: f.time, endTime: f.end || '' } : { time: '', endTime: '' });

// ★ 저장 가능 조건은 여기 하나뿐이다. 저장 버튼의 disabled · 안내 문구 · saveForm 의
//   마지막 가드가 **전부 이걸 본다**. 예전에는 입력 위임이 제목만 따로 검사해서,
//   종료 < 시작인 상태에서 제목을 한 글자 치면 버튼이 다시 켜졌다 — 화면과 실제
//   저장 판정이 어긋나면 "눌러도 아무 일이 없는 진한 파란 버튼"이 된다.
const formOk = (f) => !!f.title.trim() && !(f.repeat === 'weekly' && !f.days.length)
  && endOk(f) && spanOk(f);

// 입력 위임은 render() 를 부르지 않는다 — 입력이 uncontrolled 라야 캐럿이 살고,
// type="date"/"time" 은 **반쯤 입력한 상태에서도** input 이벤트를 쏘기 때문에 다시
// 그리면 편집 중인 세그먼트가 통째로 날아간다. 그래서 값에서 파생되는 표시만
// 여기서 직접 맞춘다: 저장 버튼 · 종료 안내 · 날짜 옆 요일.
// 요일·우선순위·반복은 버튼 탭이라 클릭 위임의 render() 가 이미 맡는다.
function syncSheet() {
  const f = state.form;
  if (!f) return;
  const btn = document.getElementById('saveBtn');
  if (btn) btn.disabled = !formOk(f);
  const wd = document.getElementById('formDow');
  if (wd) wd.textContent = f.date ? '(' + dow()[parse(f.date).getDay()] + ')' : '';
  const warn = document.getElementById('formEndWarn');
  if (warn) warn.hidden = endOk(f);
  // 종료 날짜도 uncontrolled 라 여기서 파생 표시를 맞춘다 — 'N일간' 과 경고 문구.
  const sd = document.getElementById('formSpanDays');
  if (sd) sd.textContent = spanLabel(f);
  const sw = document.getElementById('formSpanWarn');
  if (sw) {
    const bad = !spanOk(f);
    sw.hidden = !bad;
    if (bad) sw.textContent = spanWarn(f);
  }
}
// 요일 반복의 기본값 = 시작일의 요일 하나. 아무것도 안 고치면 예전 '매주' 와
// 결과가 같다. 색인은 getDay() 기준 0=일 (주 시작 일요일 고정 — CONTEXT §5).
const defaultDays = (ds) => [parse(ds).getDay()];

// 낙관적 업데이트: 화면을 먼저 바꾸고 Firestore 에 쓴다. 실패하면 알리고,
// 스냅샷이 서버 값으로 되돌려 놓는다. 예전 save() 처럼 조용히 삼키지 않는다 —
// localStorage 에서는 용량 초과였지만 여기서는 데이터 소실이다.
function commit(items, write) {
  state.items = items;
  render();
  write().catch((e) => fb.fail(t('err.save'), e));
}

function toggleDone(id, ds) {
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  const repeating = !!it.repeat && it.repeat !== 'none';
  const dd = it.doneDates || [];
  const on = repeating ? !dd.includes(ds) : !it.done;
  const next = repeating
    ? Object.assign({}, it, { doneDates: on ? dd.concat(ds) : dd.filter((x) => x !== ds) })
    : Object.assign({}, it, { done: on });
  commit(state.items.map((x) => (x.id === id ? next : x)), () => fb.setToggle(id, ds, repeating, on));
}

// ---------------------------------------------------------------- form sheet
function renderSheet() {
  const f = state.form;
  // '없음' + 만들어 둔 카테고리들. 옛 우선순위 칩과 같은 .pri CSS 를 그대로 쓴다.
  const catChoices = [CAT_NONE].concat(state.cats).map((c) => {
    const on = (f.categoryId || '') === c.id;
    return '<button class="pri" data-cat="' + esc(c.id) + '" style="background-color:' +
      (on ? 'color-mix(in srgb, ' + c.color + ' 16%, transparent)' : 'var(--fill-tertiary)') +
      ';color:' + (on ? c.color : 'var(--label-secondary)') +
      (on ? ';box-shadow:inset 0 0 0 1.5px ' + c.color + ', var(--tc-raise-sm)' : '') + '">' +
      '<span style="width:9px;height:9px;border-radius:50%;background:' + c.color + '"></span>' +
      esc(catName(c)) + '</button>';
  }).join('');

  const repeatMenu = state.repeatOpen ? '<div class="picker-menu" role="menu">' +
    REP_KEYS.map((k) =>
      '<button role="menuitemradio" aria-checked="' + (f.repeat === k) + '" data-repeat="' + k + '">' +
      '<span>' + esc(repLabel(k)) + '</span>' + (f.repeat === k ? icon('checkmark', 16, 'var(--tint)') : '') + '</button>'
    ).join('') + '</div>' : '';

  // 요일 선택 줄. 기존 .seg-wrap / .seg 를 그대로 쓴다 (새 CSS 규칙 0개).
  // dow() 가 0=일 순서로 주므로 버튼 순서도 일요일부터다 — data-dow 값이 곧 색인.
  // data-day 는 달력 셀이 이미 쓰고 있어서 이름을 달리한다.
  const dayRow = f.repeat !== 'weekly' ? '' :
    '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' +
      esc(t('form.days')) + '</div>' +
    '<div class="seg-wrap" role="group" aria-label="' + esc(t('form.days')) + '">' +
      dow().map((nm, i) =>
        '<button class="seg' + (f.days.includes(i) ? ' seg-on' : '') + '" data-dow="' + i +
        '" aria-pressed="' + f.days.includes(i) + '" style="flex:1;min-width:0;padding:0">' +
        esc(nm) + '</button>').join('') + '</div>' +
    (f.days.length ? '' :
      '<div style="font-size:12px;color:#FF3B30;margin-top:6px">' + esc(t('form.daysEmpty')) + '</div>');

  // 요일을 하나도 안 고른 '매주' 는 아무 날에도 안 뜨는 항목이 된다 — 저장을 막는다.
  const canSave = formOk(f);

  // 시작·종료 한 쌍. 종료를 비우면 종료 없음 — endTime 이 없던 옛 항목과 같은 상태다.
  const timeField = (k, v, key) =>
    '<div><div style="font-size:12px;font-weight:600;color:var(--label-tertiary);margin:0 0 4px">' +
      esc(t(key)) + '</div>' +
    '<input class="field" type="time" data-f="' + k + '" value="' + esc(v) +
      '" style="padding:11px 14px;font-size:15px"></div>';

  const ev = f.kind === 'event';
  const timeBlock = f.hasTime
    ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        timeField('time', f.time, 'form.timeStart') + timeField('end', f.end, 'form.timeEnd') + '</div>' +
      // 안내는 늘 그려 두고 hidden 만 토글한다 — syncSheet() 가 render() 없이
      // 껐다 켤 수 있어야 입력 도중에도 바로 따라온다.
      '<div id="formEndWarn"' + (endOk(f) ? ' hidden' : '') +
        ' style="font-size:12px;color:#FF3B30;margin-top:6px">' + esc(t('form.endBeforeStart')) + '</div>' +
      // 여러 날 일정에서는 두 시각이 **다른 날**에 붙는다. 안 적으면 '09:00–18:00' 이
      // 매일 반복되는 것으로 읽힌다.
      (ev && f.hasSpan ? '<div style="font-size:12px;color:var(--label-tertiary);margin-top:6px">' +
        esc(t('form.evTimeHint')) + '</div>' : '')
    : '<div style="padding:11px 14px;font-size:14px;color:var(--label-tertiary);background:var(--fill-quaternary);border-radius:12px">' +
      esc(t('item.allDay')) + '</div>';

  // 종류. 할 일과 일정은 달력에서 다르게 그려지므로(알약 / 막대) 제일 먼저 고른다.
  const kindRow = '<div class="seg-wrap" role="group" aria-label="' + esc(t('form.kind')) +
    '" style="margin:12px 0 2px">' +
    ['todo', 'event'].map((k) =>
      '<button class="seg' + (f.kind === k ? ' seg-on' : '') + '" data-fkind="' + k +
      '" aria-pressed="' + (f.kind === k) + '" style="flex:1;min-width:0">' +
      esc(t('kind.' + k)) + '</button>').join('') + '</div>';

  // 기간. 일정에서만 그린다 — 할 일은 늘 하루다(span 은 일정 전용, CONTEXT §3).
  // 시간 토글과 같은 자리·같은 모양이다: 스위치 하나 + 켜면 나오는 칸.
  const spanBlock = !ev ? '' :
    '<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
      '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('form.span')) + '</span>' +
      '<button class="sw" role="switch" data-act="toggleSpan" aria-checked="' + f.hasSpan +
        '" aria-label="' + esc(t('form.spanToggle')) + '"><span></span></button></div>' +
    (f.hasSpan
      ? '<div style="display:flex;align-items:center;gap:10px">' +
          '<input class="field" type="date" data-f="endDate" value="' + esc(f.endDate) +
            '" style="flex:1;min-width:0;padding:11px 14px;font-size:15px">' +
          '<span id="formSpanDays" style="flex:none;font-size:13px;font-weight:600;color:var(--label-secondary)">' +
            esc(spanLabel(f)) + '</span></div>' +
        '<div id="formSpanWarn"' + (spanOk(f) ? ' hidden' : '') +
          ' style="font-size:12px;color:#FF3B30;margin-top:6px">' + esc(spanWarn(f)) + '</div>'
      : '<div style="padding:11px 14px;font-size:14px;color:var(--label-tertiary);background:var(--fill-quaternary);border-radius:12px">' +
        esc(t('form.spanOne')) + '</div>');

  return '<div data-act="close" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div id="sheet" role="dialog" aria-modal="true" style="pointer-events:auto;width:min(560px,100vw);max-height:88vh;overflow:auto;' +
      'background:var(--bg);border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(t(state.editingId ? 'form.edit' : 'form.new')) + '</h3>' +
        '<button data-act="close" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;width:30px;height:30px;border-radius:50%;' +
          'background:var(--fill-tertiary);color:var(--label-secondary);display:flex;align-items:center;justify-content:center;padding:0">' +
          icon('xmark', 14) + '</button></div>' + kindRow +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.title')) + '</div>' +
      '<input class="field" type="text" data-f="title" placeholder="' + esc(t('form.titlePh')) + '" value="' + esc(f.title) +
        '" style="padding:12px 14px;font-size:16px">' +

      '<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
        '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('form.date')) + '</span>' +
        // ★ 요일은 표시 전용이다 (CONTEXT §5). type="date" 의 네이티브 표시는 브라우저가
        //   정해서 요일을 끼워 넣을 수 없으므로 라벨 줄에 따로 적는다. 저장되는 값은
        //   아래 input 의 'YYYY-MM-DD' 하나뿐이고, dow() 결과가 그리로 되돌아가는
        //   경로는 없다. 날짜를 지워 value 가 비면 요일도 안 그린다.
        '<span id="formDow" style="font-size:13px;font-weight:600;color:var(--label-tertiary)">' +
          (f.date ? '(' + esc(dow()[parse(f.date).getDay()]) + ')' : '') + '</span>' +
      '</div>' +
      // value 는 'YYYY-MM-DD' 그대로다. type="date" 가 요구하는 형식이자 저장 키의
      // 형식이라 Intl 을 끼우면 안 된다 — 표시 형식은 브라우저가 로케일에 맞춘다.
      '<input class="field" type="date" data-f="date" value="' + esc(f.date) + '" style="padding:11px 14px;font-size:15px">' +
      spanBlock +

      '<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
        '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('form.time')) + '</span>' +
        '<button class="sw" role="switch" data-act="toggleTime" aria-checked="' + f.hasTime +
          '" aria-label="' + esc(t('form.timeToggle')) + '"><span></span></button>' +
      '</div>' + timeBlock +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.cat')) + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + catChoices + '</div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.repeat')) + '</div>' +
      '<div class="picker"><button class="picker-btn" data-act="repeatToggle" aria-haspopup="menu" aria-expanded="' + state.repeatOpen + '">' +
        '<span>' + esc(repLabel(f.repeat)) + '</span>' + icon('chevron.up.chevron.down', 15, 'var(--tint)') + '</button>' + repeatMenu + '</div>' +
      dayRow +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + esc(t('form.memo')) + '</div>' +
      '<textarea class="field" rows="2" data-f="memo" placeholder="' + esc(t('form.memoPh')) + '" ' +
        'style="padding:12px 14px;font-size:15px;resize:vertical">' + esc(f.memo) + '</textarea>' +

      '<div style="display:flex;gap:10px;margin-top:20px;align-items:center">' +
        (state.editingId ? '<button class="btn btn-plain btn-md" data-act="delete" style="color:#FF3B30">' +
          esc(t('form.delete')) + '</button>' : '') +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-gray btn-md" data-act="close">' + esc(t('form.cancel')) + '</button>' +
        '<span data-raise="tint" style="display:inline-flex">' +
          '<button class="btn btn-prominent btn-md" id="saveBtn" data-act="save"' +
          (canSave ? '' : ' disabled') + '>' + esc(t('form.save')) + '</button></span>' +
      '</div></div></div>';
}

// ---------------------------------------------------------------- interaction
const app = document.getElementById('app');

function openForm(id, ds, kind) {
  if (id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    state.editingId = id;
    state.form = { title: it.title, date: ds || it.date,
      // kind 가 없는 옛 문서는 할 일이다 (isEvent 의 폴백과 같다).
      kind: isEvent(it) ? 'event' : 'todo',
      hasSpan: spanOf(it) > 1,
      // ★ 기준은 it.date 가 아니라 **연 날짜**다. 반복 일정을 세 번째 회차에서
      //   열면 ds 가 그 회차의 시작일이고, 종료도 그 회차 기준이라야 맞는다.
      endDate: addDays(ds || it.date, spanOf(it) - 1),
      hasTime: !!it.time, time: it.time || '07:00',
      // endTime 은 옛 항목에 아예 없다 — 없으면 '' 로 열려 '종료 없음' 이 그대로
      // 유지된다. 하루 종일이던 항목의 시간을 켜면 새 항목과 같은 07:00–08:00 에서
      // 시작한다 (그 항목에는 지울 종료 시간이 애초에 없다).
      end: it.time ? (it.endTime || '') : '08:00',
      // 지워진 카테고리를 가리키던 항목은 '없음' 이 골라진 채로 열린다 — 화면과
      // 같은 상태다(catOf 폴백). 그대로 저장하면 categoryId 가 '' 로 굳는다.
      categoryId: (it.categoryId && state.cats.some((c) => c.id === it.categoryId)) ? it.categoryId : '',
      repeat: it.repeat || 'none',
      // days 가 없는 옛 weekly 항목은 시작일 요일 하나가 켜진 채로 열린다 — 지금
      // 판정과 같은 상태다. 그대로 저장하면 days 가 생기지만 결과는 안 바뀐다.
      days: (it.days && it.days.length) ? it.days.slice()
        : (it.repeat === 'weekly' ? defaultDays(it.date) : []),
      memo: it.memo || '' };
  } else {
    state.editingId = null;
    state.form = blankForm(state.selected, kind);
  }
  state.showForm = true;
  state.repeatOpen = false;
  render();
}
function closeForm() {
  state.showForm = false;
  state.editingId = null;
  state.form = null;
  state.repeatOpen = false;
  render();
}
function saveForm() {
  const f = state.form;
  // 저장 버튼도 disabled 지만 여기서 한 번 더 막는다 — 화면 검사 하나만 믿지 않는다.
  // 버튼과 **같은 formOk()** 를 본다: 요일을 하나도 안 고른 '매주' 는 아무 날에도
  // 안 뜨고, 종료 ≤ 시작은 자정을 넘긴다.
  if (!formOk(f)) return;
  const base = Object.assign({ title: f.title.trim(), date: f.date }, formTimes(f), {
    categoryId: f.categoryId, repeat: f.repeat,
    // 오름차순으로 굳혀 둔다 — 판정과 라벨이 고른 순서에 안 흔들린다.
    // weekly 가 아니면 []. done/doneDates 와 같은 방식이다: 필드는 늘 있고
    // 어느 쪽을 읽을지는 repeat 이 정한다 (occursOn 은 weekly 에서만 days 를 본다).
    days: f.repeat === 'weekly' ? f.days.slice().sort((a, b) => a - b) : [],
    // 종류·기간. 읽는 쪽에 폴백이 있지만(kind 없음=할 일, span 없음=하루) 쓸 때는
    // days/endTime 과 같은 방식으로 **늘 둘 다** 쓴다. 할 일이면 span 은 언제나 1이다.
    kind: f.kind, span: formSpan(f),
    memo: (f.memo || '').trim() });
  // 새 항목의 id 는 Firestore 가 만든다 — 기기 간 충돌이 없고, 쓰기를 기다리지
  // 않고도 화면에 먼저 넣을 수 있다.
  const editing = !!state.editingId;
  const id = state.editingId || fb.newId();
  const fresh = Object.assign({ id }, base, { done: false, doneDates: [] });
  const items = editing
    ? state.items.map((it) => (it.id === id ? Object.assign({}, it, base) : it))
    : state.items.concat(fresh);
  state.selected = f.date;
  state.showForm = false;
  state.editingId = null;
  state.form = null;
  // ★ 새 항목의 쓰기값을 필드마다 손으로 적지 않는다. 예전에는 그렇게 적혀 있었는데
  //   base 에 필드를 하나 늘릴 때마다 여기를 같이 안 고치면 **새 항목만** 그 필드가
  //   빠진 채 저장된다(kind·span 을 붙이면서 실제로 걸릴 뻔했다). base 가 한 소스다.
  commit(items, () => fb.saveTodo(id, editing ? base
    : Object.assign({}, base, { done: false, doneDates: [] })));
}

// ---------------------------------------------------------------- 카테고리 시트
// 두 모드다: catDraft 가 null 이면 목록, 있으면 편집기. 입력 시트(openForm/saveForm/
// closeForm)와 같은 모양이라 새 개념이 없다.
//
// ★ 이름 중복·길이 조건을 여기 한 곳에 모은다 — 저장 버튼 disabled · 안내 문구 ·
//   saveCatDraft 가드가 전부 이것만 본다(formOk 와 같은 성격).
const catNameOf = (d) => (d.name || '').trim();
const catTaken = (d) => state.cats.some((c) => c.id !== d.id && c.name === catNameOf(d));
const catOk = (d) => !!d && catNameOf(d).length > 0
  && catNameOf(d).length <= CAT_NAME_MAX && !catTaken(d);

// 새 카테고리의 기본 색 = 아직 안 쓴 팔레트 색. 열 때마다 같은 빨강을 주면
// 열 개를 만들어도 전부 빨강이 된다.
const freeColor = () =>
  CAT_COLORS.find((c) => !state.cats.some((k) => k.color === c)) || CAT_COLORS[0];

function openCats() {
  state.showSettings = false;   // 설정 시트에서 들어온다 — 두 장이 겹치지 않게 닫는다
  state.del = null;
  state.showCats = true;
  state.catDraft = null;
  render();
}
function closeCats() {
  state.showCats = false;
  state.catDraft = null;
  render();   // ★ sheetBusy() 로 밀려 있던 원격 스냅샷을 여기서 반영한다
}
function newCat() {
  if (state.cats.length >= CAT_MAX) return;   // 화면에서도 버튼을 감추지만 한 번 더 본다
  state.catDraft = { id: '', name: '', color: freeColor() };
  render();
}
function editCat(id) {
  const c = state.cats.find((x) => x.id === id);
  if (!c) return;
  state.catDraft = { id: c.id, name: c.name, color: c.color };
  render();
}
// ★ 낙관적 업데이트. 시트가 열려 있는 동안은 sheetBusy() 가 원격 스냅샷 렌더를
//   막으므로, state.cats 를 직접 고치지 않으면 **방금 만든 카테고리가 시트를 닫을
//   때까지 목록에 안 나타난다**. 정렬 기준은 firebase.js 의 구독과 같게 유지할 것.
function saveCatDraft() {
  const d = state.catDraft;
  if (!catOk(d)) return;
  const name = catNameOf(d), color = d.color;
  const id = d.id || fb.newCatId();
  state.cats = state.cats.filter((c) => c.id !== id).concat({ id, name, color })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  state.catDraft = null;
  render();
  fb.saveCat(id, name, color).catch((e) => fb.fail(t('err.save'), e));
}
// ★ 카테고리 문서 하나만 지운다. 그걸 쓰던 할 일은 **건드리지 않는다** — 죽은 id 는
//   catOf() 가 '없음' 으로 떨어뜨린다(calendar.js). 되돌릴 수 없는 조작이라 개수를
//   눈으로 보여 주는 확인창이 유일한 방어선이다. 지우지 말 것.
function delCat() {
  const d = state.catDraft;
  if (!d || !d.id) return;
  const n = state.items.filter((it) => (it.categoryId || '') === d.id).length;
  if (!confirm(t('cat.delConfirm', n))) return;
  state.cats = state.cats.filter((c) => c.id !== d.id);
  if (state.filter === d.id) state.filter = null;   // 보고 있던 필터가 사라지면 전체로
  state.catDraft = null;
  render();
  fb.removeCat(d.id).catch((e) => fb.fail(t('err.save'), e));
}
// 입력 위임이 render() 대신 부른다 — 이름 칸이 uncontrolled 라야 캐럿이 산다.
// syncSheet() 와 같은 이유·같은 방식이다.
function syncCatSheet() {
  const d = state.catDraft;
  if (!d) return;
  const btn = document.getElementById('catSaveBtn');
  if (btn) btn.disabled = !catOk(d);
  const warn = document.getElementById('catDupe');
  if (warn) warn.hidden = !catTaken(d);
}

function renderCatSheet() {
  const d = state.catDraft;
  let body;

  if (d) {
    const swatches = CAT_COLORS.map((c) => {
      const on = d.color === c;
      return '<button data-catcolor="' + c + '" aria-label="' + c + '" aria-pressed="' + on + '" ' +
        'style="width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;padding:0;' +
        'background-color:' + c + (on ? ';box-shadow:0 0 0 2px var(--bg), 0 0 0 4px ' + c : '') + '"></button>';
    }).join('');
    body =
      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' +
        esc(t('cat.name')) + '</div>' +
      // .field 는 패딩을 안 준다 — 다른 입력칸처럼 여기서 붙인다(안 붙이면 브라우저
      // 기본 높이라 유독 납작하다). 16px 인 이유는 폰이다: 그보다 작으면 누를 때
      // 화면이 자동으로 확대된다.
      '<input class="field" data-cn maxlength="' + CAT_NAME_MAX + '" ' +
        'style="padding:12px 14px;font-size:16px" ' +
        'placeholder="' + esc(t('cat.namePh')) + '" value="' + esc(d.name) + '">' +
      '<div id="catDupe" role="alert"' + (catTaken(d) ? '' : ' hidden') +
        ' style="margin-top:8px;font-size:13px;font-weight:600;color:#FF3B30">' +
        esc(t('cat.dupe')) + '</div>' +
      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:16px 0 8px">' +
        esc(t('cat.color')) + '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' + swatches + '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:22px">' +
        (d.id ? '<button class="btn btn-plain btn-md" data-act="catDel" style="color:#FF3B30">' +
          esc(t('form.delete')) + '</button>' : '') +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-gray btn-md" data-act="catCancel">' + esc(t('form.cancel')) + '</button>' +
        '<span data-raise="tint" style="display:inline-flex">' +
          '<button class="btn btn-prominent btn-md" id="catSaveBtn" data-act="catSave"' +
          (catOk(d) ? '' : ' disabled') + '>' + esc(t('form.save')) + '</button></span>' +
      '</div>';
  } else if (state.cats.length) {
    const rows = state.cats.map((c, i) =>
      '<div data-catedit="' + esc(c.id) + '" style="display:flex;align-items:center;gap:12px;cursor:pointer;' +
        'padding:13px 4px;border-top:' + (i === 0 ? 'none' : '.5px solid var(--separator)') + '">' +
        '<span style="width:12px;height:12px;border-radius:50%;flex:none;background-color:' + c.color + '"></span>' +
        '<span class="trunc" style="flex:1;font-size:15px;font-weight:600">' + esc(c.name) + '</span>' +
        '<span style="color:var(--label-tertiary);display:flex">' + icon('chevron.right', 15) + '</span></div>'
    ).join('');
    body = rows + (state.cats.length >= CAT_MAX
      ? '<div style="font-size:13px;color:var(--label-tertiary);padding:14px 4px 0">' +
        esc(t('cat.max', CAT_MAX)) + '</div>'
      : '<button class="btn btn-gray btn-md" data-act="catNew" style="width:100%;margin-top:16px">' +
        esc(t('cat.add')) + '</button>');
  } else {
    body = '<div style="padding:26px 4px;text-align:center">' +
        '<div style="font-size:15px;font-weight:600;color:var(--label-secondary)">' + esc(t('cat.empty')) + '</div>' +
        '<div style="font-size:13px;color:var(--label-tertiary);margin-top:3px">' + esc(t('cat.emptyHint')) + '</div></div>' +
      '<button class="btn btn-gray btn-md" data-act="catNew" style="width:100%">' + esc(t('cat.add')) + '</button>';
  }

  return '<div data-act="closeCats" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" style="pointer-events:auto;width:min(560px,100vw);max-height:88vh;overflow:auto;' +
      'background:var(--bg);border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .28s cubic-bezier(.32,.72,0,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' +
          esc(t(d ? (d.id ? 'cat.edit' : 'cat.add') : 'cat.manage')) + '</h3>' +
        '<button data-act="closeCats" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;width:30px;height:30px;border-radius:50%;' +
          'background:var(--fill-tertiary);color:var(--label-secondary);display:flex;align-items:center;justify-content:center;padding:0">' +
          icon('xmark', 14) + '</button></div>' +
      body +
    '</div></div>';
}

// ---------------------------------------------------------------- 목표 시트
// 입력 시트(openForm/saveForm/closeForm)와 같은 모양이다. 다른 점이 셋 있다 —
//   1) 날짜가 아니라 **기한**이다: 올해 안에 / 그 달까지 / 그 달 며칠까지.
//   2) 년(y)을 고르지 않는다. 지금 보고 있는 해(state.cy)에 붙는다 — 연간 뷰가
//      해마다 하나라서, 년을 따로 고르게 하면 저장한 목표가 다른 해로 사라진다.
//   3) 반복이 없다. 목표는 기간 자체라 '매주'가 성립하지 않는다.
//
// ★ 100자는 firestore.rules 의 validGoal() 과 **같은 값**이어야 한다. 어긋나면
//   화면은 멀쩡한데 저장만 조용히 거부된다 (validSettings 와 같은 성격).
const GOAL_TITLE_MAX = 100;
const goalTitleOf = (g) => (g.title || '').trim();
const goalOk = (g) => !!g && goalTitleOf(g).length > 0 && goalTitleOf(g).length <= GOAL_TITLE_MAX;
// 그 달의 말일. 2월에 31을 저장하면 goalDue() 의 new Date(y,1,31) 이 3월 3일로 샌다.
const lastDayOf = (y, m) => new Date(y, m + 1, 0).getDate();
const goalDay = (g) => Math.min(Math.max(1, Number(g.d) || 1), lastDayOf(g.y, g.m));

// 기본은 '올해 안에' — 버킷리스트의 기본값이고 더 고를 것이 없다. 월·일은
// '월까지' 로 켰을 때 쓸 값만 오늘 기준으로 미리 채워 둔다.
// ★ 카테고리 기본값은 blankForm 과 같은 이유로 지금 걸린 필터다 — '업무' 필터에서
//   만든 목표가 '없음' 으로 태어나면 저장하자마자 화면에서 사라진다.
function blankGoal() {
  const n = new Date();
  return { id: '', title: '', scope: 'year', y: state.cy,
    m: state.cy === n.getFullYear() ? n.getMonth() : 0, hasDay: false, d: n.getDate(),
    categoryId: state.filter || '', memo: '' };
}

function openGoal(id) {
  const g = id && state.goals.find((x) => x.id === id);
  state.goalDraft = g
    ? { id: g.id, title: g.title, scope: g.scope === 'month' ? 'month' : 'year',
        // m 이 null 인 'year' 목표를 '월까지' 로 바꿔도 고를 달이 있어야 한다.
        y: g.y, m: g.m == null ? 0 : g.m, hasDay: g.d != null, d: g.d || 1,
        // 지워진 카테고리를 가리키면 '없음' 이 골라진 채로 열린다 — 화면과 같은
        // 상태다(catOf 폴백). 그대로 저장하면 categoryId 가 '' 로 굳는다.
        categoryId: (g.categoryId && state.cats.some((c) => c.id === g.categoryId)) ? g.categoryId : '',
        memo: g.memo || '' }
    : blankGoal();
  render();
}
function closeGoal() {
  state.goalDraft = null;
  render();   // ★ sheetBusy() 로 밀려 있던 원격 스냅샷을 여기서 반영한다
}

// ★ 낙관적 업데이트. 시트가 열려 있는 동안 sheetBusy() 가 원격 스냅샷 렌더를 막으므로
//   state.goals 를 직접 고치지 않으면 방금 만든 목표가 시트를 닫을 때까지 안 보인다
//   (saveCatDraft 와 같은 이유).
// ★ 규칙이 hasOnly + done is bool 을 보므로 **여덟 키를 전부** 실어 보낸다.
//   done 은 편집 때 기존 값을 이어받는다 — 안 그러면 제목만 고쳐도 체크가 풀린다.
function saveGoalDraft() {
  const g = state.goalDraft;
  if (!goalOk(g)) return;
  const month = g.scope === 'month';
  const prev = g.id && state.goals.find((x) => x.id === g.id);
  const data = {
    title: goalTitleOf(g), scope: g.scope, y: g.y,
    m: month ? g.m : null,
    d: (month && g.hasDay) ? goalDay(g) : null,
    categoryId: g.categoryId, memo: (g.memo || '').trim(), done: prev ? !!prev.done : false
  };
  const id = g.id || fb.newGoalId();
  state.goals = state.goals.filter((x) => x.id !== id).concat(Object.assign({ id: id }, data));
  state.goalDraft = null;
  render();
  fb.saveGoal(id, data).catch((e) => fb.fail(t('err.save'), e));
}

// 할 일 삭제(case 'delete')와 같다 — 확인창이 없다. 카테고리와 달리 목표를 지워도
// 다른 문서가 딸려 가지 않아서, 되돌릴 수 없는 것은 그 한 줄뿐이다.
function delGoal() {
  const g = state.goalDraft;
  if (!g || !g.id) return;
  state.goals = state.goals.filter((x) => x.id !== g.id);
  state.goalDraft = null;
  render();
  fb.removeGoal(g.id).catch((e) => fb.fail(t('err.save'), e));
}

function toggleGoal(id) {
  const g = state.goals.find((x) => x.id === id);
  if (!g) return;
  const on = !g.done;
  state.goals = state.goals.map((x) => (x.id === id ? Object.assign({}, x, { done: on }) : x));
  render();
  fb.setGoalDone(id, on).catch((e) => fb.fail(t('err.save'), e));
}

// 입력 위임이 render() 대신 부른다 — 제목·메모·일 칸이 uncontrolled 라야 캐럿이 산다
// (syncSheet / syncCatSheet 와 같은 이유·같은 방식).
function syncGoalSheet() {
  const btn = document.getElementById('goalSaveBtn');
  if (btn) btn.disabled = !goalOk(state.goalDraft);
}

function renderGoalSheet() {
  const g = state.goalDraft;

  // 기한은 2단이다: 먼저 올해 안 / 월까지, '월까지' 를 고르면 달과 (선택) 날짜.
  const scopeRow = '<div class="seg-wrap" role="group" aria-label="' + esc(t('goal.due')) + '">' +
    [['year', 'goal.dueYear'], ['month', 'goal.dueMonth']].map((p) =>
      '<button class="seg' + (g.scope === p[0] ? ' seg-on' : '') + '" data-gscope="' + p[0] +
      '" aria-pressed="' + (g.scope === p[0]) + '" style="flex:1;min-width:0;padding:0">' +
      esc(t(p[1])) + '</button>').join('') + '</div>';

  // 12칸 달 격자. .seg 를 그대로 쓴다 (새 CSS 규칙 0개 — 요일 선택 줄과 같은 방식).
  // 6열 × 2줄인 이유: 390px 시트에서 12열이면 한 칸이 28px 이라 '12월' 이 잘린다.
  const monthGrid = g.scope !== 'month' ? '' :
    '<div role="group" aria-label="' + esc(t('goal.dueMonth')) + '" style="display:grid;' +
      'grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:10px">' +
    Array.from({ length: 12 }, (x, i) =>
      '<button class="seg' + (g.m === i ? ' seg-on' : '') + '" data-gm="' + i +
      '" aria-pressed="' + (g.m === i) + '" style="padding:0">' + esc(monthShort(i)) + '</button>').join('') +
    '</div>' +
    // '며칠까지' — 할 일의 '시간 지정' 스위치와 같은 자리·같은 모양이다.
    '<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
      '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('goal.dueDay')) + '</span>' +
      '<button class="sw" role="switch" data-act="goalDayToggle" aria-checked="' + g.hasDay +
        '" aria-label="' + esc(t('goal.dueDay')) + '"><span></span></button></div>' +
    (g.hasDay
      // max 는 그 달의 말일이다 — 2월에 31을 못 넣는다. 브라우저의 max 는 강제가
      // 아니라 힌트라서, 넘겨 적어도 goalDay() 가 저장 직전에 다시 조인다.
      ? '<input class="field" type="number" inputmode="numeric" data-g="d" min="1" max="' +
        lastDayOf(g.y, g.m) + '" value="' + goalDay(g) + '" style="padding:11px 14px;font-size:15px">'
      : '<div style="padding:11px 14px;font-size:14px;color:var(--label-tertiary);' +
        'background-color:var(--fill-quaternary);border-radius:12px">' +
        esc(t('goal.by', monthShort(g.m))) + '</div>');

  // 카테고리 칩. 입력 시트와 같은 .pri 를 쓴다 — 다만 data-cat 은 state.form 을
  // 고치므로 이름을 달리한다(시트 둘이 같이 열리진 않지만 위임이 하나다).
  const catChoices = [CAT_NONE].concat(state.cats).map((c) => {
    const on = (g.categoryId || '') === c.id;
    return '<button class="pri" data-gcat="' + esc(c.id) + '" style="background-color:' +
      (on ? 'color-mix(in srgb, ' + c.color + ' 16%, transparent)' : 'var(--fill-tertiary)') +
      ';color:' + (on ? c.color : 'var(--label-secondary)') +
      (on ? ';box-shadow:inset 0 0 0 1.5px ' + c.color + ', var(--tc-raise-sm)' : '') + '">' +
      '<span style="width:9px;height:9px;border-radius:50%;background-color:' + c.color + '"></span>' +
      esc(catName(c)) + '</button>';
  }).join('');

  return '<div data-act="closeGoal" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" style="pointer-events:auto;width:min(560px,100vw);max-height:88vh;overflow:auto;' +
      'background:var(--bg);border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(t(g.id ? 'goal.edit' : 'goal.new')) + '</h3>' +
        '<button data-act="closeGoal" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;width:30px;height:30px;border-radius:50%;' +
          'background:var(--fill-tertiary);color:var(--label-secondary);display:flex;align-items:center;justify-content:center;padding:0">' +
          icon('xmark', 14) + '</button></div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' +
        esc(t('form.title')) + '</div>' +
      '<input class="field" type="text" data-g="title" maxlength="' + GOAL_TITLE_MAX + '" placeholder="' +
        esc(t('goal.titlePh')) + '" value="' + esc(g.title) + '" style="padding:12px 14px;font-size:16px">' +

      '<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">' +
        '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('goal.due')) + '</span>' +
        // 년은 안 고른다 — 지금 보고 있는 해에 붙는다는 것을 여기서 밝힌다.
        '<span style="font-size:13px;font-weight:600;color:var(--label-tertiary)">' +
          esc(yearLabel(g.y)) + '</span></div>' +
      scopeRow + monthGrid +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' +
        esc(t('form.cat')) + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + catChoices + '</div>' +

      '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' +
        esc(t('form.memo')) + '</div>' +
      '<textarea class="field" rows="2" data-g="memo" placeholder="' + esc(t('form.memoPh')) + '" ' +
        'style="padding:12px 14px;font-size:15px;resize:vertical">' + esc(g.memo) + '</textarea>' +

      '<div style="display:flex;gap:10px;margin-top:20px;align-items:center">' +
        (g.id ? '<button class="btn btn-plain btn-md" data-act="goalDel" style="color:#FF3B30">' +
          esc(t('form.delete')) + '</button>' : '') +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-gray btn-md" data-act="closeGoal">' + esc(t('form.cancel')) + '</button>' +
        '<span data-raise="tint" style="display:inline-flex">' +
          '<button class="btn btn-prominent btn-md" id="goalSaveBtn" data-act="goalSave"' +
          (goalOk(g) ? '' : ' disabled') + '>' + esc(t('form.save')) + '</button></span>' +
      '</div></div></div>';
}

app.addEventListener('click', (e) => {
  const t = e.target;
  const hit = (sel) => t.closest(sel);
  let el;

  if ((el = hit('[data-authmode]'))) {
    state.auth.mode = el.dataset.authmode;
    state.auth.pin = state.auth.pin2 = state.auth.error = state.auth.notice = '';
    return render();
  }
  // 약관 전문 보기. data-agree 보다 먼저 본다 — 체크 행 바로 옆에 있는 버튼이다.
  if ((el = hit('[data-legal]'))) { state.legal = el.dataset.legal; return render(); }
  // 테마·언어. 설정 시트와 로그인 화면 양쪽에서 같은 핸들러를 쓴다.
  // 로그인 전이면 localStorage 까지만 — Firestore 쓰기는 setPref 안에서 막힌다.
  if ((el = hit('[data-pref]'))) return setPref(el.dataset.pref, el.dataset.val);
  if ((el = hit('[data-agree]'))) {
    const g = state.auth.agree, k = el.dataset.agree;
    if (k === 'all') {
      // 선택 항목(marketing)까지 포함해 전부 켜고, 다시 누르면 전부 끈다.
      const on = !(g.terms && g.privacy && g.age && g.marketing);
      g.terms = g.privacy = g.marketing = on;
      g.age = on ? 'over14' : '';
    } else if (k === 'age') {
      // 배타 선택: 같은 걸 다시 누르면 해제, 다른 걸 누르면 교체된다.
      g.age = g.age === el.dataset.val ? '' : el.dataset.val;
    } else {
      g[k] = !g[k];
    }
    return render();
  }
  if ((el = hit('[data-approve]'))) return decide(el.dataset.approve, 'approved');
  if ((el = hit('[data-reject]'))) return decide(el.dataset.reject, 'rejected');
  if ((el = hit('[data-resetpin]'))) return resetPin(el.dataset.resetpin);
  if ((el = hit('[data-delacct]'))) return removeAccount(el.dataset.delacct);
  // 년·월 점프. 탭은 **임시 선택**만 옮긴다 — 달력은 [이동] 을 눌러야 움직인다.
  // 스크롤 위치는 render() 진입부의 saveJumpScroll() 이 챙기므로 여기서 안 만진다.
  if ((el = hit('[data-jy]'))) { state.jump.y = Number(el.dataset.jy); return render(); }
  if ((el = hit('[data-jm]'))) { state.jump.m = Number(el.dataset.jm); return render(); }
  if ((el = hit('[data-view]'))) { state.view = el.dataset.view; return render(); }
  // 연간 뷰의 12칸 요약. 그 달의 **할 일** 화면으로 간다 — 목표는 연간 뷰에만 있다.
  // [data-day] 와 같이 cy/cm/selected 셋을 함께 옮긴다(안 그러면 하단 목록이 어긋난다).
  if ((el = hit('[data-ym]'))) {
    state.cm = Number(el.dataset.ym);
    state.selected = fmt(new Date(state.cy, state.cm, 1));
    state.view = 'month';
    return render();
  }
  if ((el = hit('[data-nav]'))) {
    const dir = el.dataset.nav;
    if (dir === 'today') {
      const n = new Date();
      state.cy = n.getFullYear(); state.cm = n.getMonth(); state.selected = fmt(n);
    } else {
      const step = dir === 'prev' ? -1 : 1;
      // 연간 뷰의 축은 cy 하나다 — 월·선택한 날은 그대로 두고 해만 넘긴다.
      if (state.view === 'year') {
        state.cy += step;
      } else if (state.view === 'month') {
        const m = new Date(state.cy, state.cm + step, 1);
        state.cy = m.getFullYear(); state.cm = m.getMonth();
      } else {
        state.selected = addDays(state.selected, step * (state.view === 'week' ? 7 : 1));
      }
    }
    return render();
  }
  if ((el = hit('[data-toggle]'))) { e.stopPropagation(); return toggleDone(el.dataset.toggle, state.selected); }
  if ((el = hit('[data-open]'))) { e.stopPropagation(); return openForm(el.dataset.open, el.dataset.ds); }
  if ((el = hit('[data-day]'))) {
    const ds = el.dataset.day, d = parse(ds);
    state.selected = ds; state.cy = d.getFullYear(); state.cm = d.getMonth();
    return render();
  }
  if ((el = hit('[data-cat]'))) { state.form.categoryId = el.dataset.cat; return render(); }
  // 필터 칩. '' 는 전체 — state.filter 는 null 로 눕힌다(itemsOn 이 falsy 로 본다).
  if ((el = hit('[data-filter]'))) { state.filter = el.dataset.filter || null; return render(); }
  // 종류 칩(전체/할 일/일정). filter 와 같은 방식이다 — '' 를 null 로 눕힌다.
  if ((el = hit('[data-kind]'))) { state.kind = el.dataset.kind || null; return render(); }
  // 카테고리 시트: 목록 줄 탭 → 편집기, 색 스와치 탭 → 초안의 색만 바꾼다.
  if ((el = hit('[data-catedit]'))) return editCat(el.dataset.catedit);
  if ((el = hit('[data-catcolor]'))) { state.catDraft.color = el.dataset.catcolor; return render(); }
  // 목표: 줄 탭 → 편집 시트, 체크 버튼 → 완료 토글.
  // ★ [data-gtoggle] 이 [data-goal] 보다 먼저다 — 체크 버튼이 줄 안에 들어 있어서
  //   순서가 뒤집히면 체크할 때마다 시트가 열린다(할 일의 toggle/open 과 같은 함정).
  if ((el = hit('[data-gtoggle]'))) { e.stopPropagation(); return toggleGoal(el.dataset.gtoggle); }
  if ((el = hit('[data-goal]'))) { e.stopPropagation(); return openGoal(el.dataset.goal); }
  if ((el = hit('[data-gscope]'))) { state.goalDraft.scope = el.dataset.gscope; return render(); }
  if ((el = hit('[data-gm]'))) { state.goalDraft.m = Number(el.dataset.gm); return render(); }
  if ((el = hit('[data-gcat]'))) { state.goalDraft.categoryId = el.dataset.gcat; return render(); }
  // 종류 seg(할 일 / 일정). 할 일로 돌아가면 기간을 끈다 — span 은 일정 전용이라
  // 켠 채로 두면 화면에는 안 보이는데 저장값에는 남는다.
  if ((el = hit('[data-fkind]'))) {
    state.form.kind = el.dataset.fkind;
    if (state.form.kind !== 'event') state.form.hasSpan = false;
    return render();
  }
  if ((el = hit('[data-repeat]'))) {
    state.form.repeat = el.dataset.repeat;
    // '매주' 를 고르면 시작일 요일 하나가 켜진 채로 열린다 — 아무것도 더 안 고르고
    // 저장하면 예전 '매주' 와 결과가 같다.
    if (state.form.repeat === 'weekly' && !state.form.days.length) {
      state.form.days = defaultDays(state.form.date);
    }
    state.repeatOpen = false;
    return render();
  }
  if ((el = hit('[data-dow]'))) {
    const n = Number(el.dataset.dow), d = state.form.days;
    state.form.days = d.includes(n) ? d.filter((x) => x !== n) : d.concat(n).sort((a, b) => a - b);
    return render();
  }
  if ((el = hit('[data-act]'))) {
    switch (el.dataset.act) {
      case 'login': return login();
      case 'signup': return signup();
      case 'logout': return logout();
      case 'toggleRemember': state.auth.remember = !state.auth.remember; return render();
      case 'closeLegal': state.legal = null; return render();
      case 'admin': state.showAdmin = true; return render();
      case 'closeAdmin': state.showAdmin = false; return render();
      case 'settings': state.showSettings = true; state.del = null; return render();
      case 'closeSettings': state.showSettings = false; state.del = null; return render();
      // 카테고리 관리. 설정 시트에서 들어오고, 닫으면 밀린 스냅샷이 반영된다.
      case 'cats': return openCats();
      case 'closeCats': return closeCats();
      case 'catNew': return newCat();
      case 'catCancel': state.catDraft = null; return render();
      case 'catSave': return saveCatDraft();
      case 'catDel': return delCat();
      // 목표. 연간 뷰의 + 버튼이 goalNew 로 들어온다 (월/주/일에서는 open 이다).
      case 'goalNew': return openGoal(null);
      case 'closeGoal': return closeGoal();
      case 'goalSave': return saveGoalDraft();
      case 'goalDel': return delGoal();
      case 'goalDayToggle': state.goalDraft.hasDay = !state.goalDraft.hasDay; return render();
      // 탈퇴는 두 단계다 — 버튼 한 번으로는 절대 지워지지 않는다.
      case 'askDelete': state.del = { pin: '', error: '', busy: false }; return render();
      case 'cancelDelete': state.del = null; return render();
      case 'confirmDelete': return removeSelf();
      case 'migrate': return migrateLocal();
      // 이미지 내보내기. 여는 순간 캔버스와 Blob 을 다 만들고, 공유·저장은
      // 시트 안의 **새 제스처**로 받는다 (export.js 의 2단 흐름).
      case 'export': return openExport();
      case 'closeExport': return closeExport();
      case 'expMemo': return toggleExportMemo();
      case 'expDetail': return toggleExportDetail();
      case 'expGrid': return toggleExportGrid();
      case 'jump': return openJump();
      case 'closeJump': return closeJump();
      case 'jumpGo': return applyJump();
      case 'jumpToday': return jumpNow();
      case 'expShare': return shareImage();
      case 'expSave': return saveImage();
      // ★ '일정' 만 보고 있으면 + 는 일정을 만든다 — blankForm 의 카테고리 기본값과
      //   같은 이유다. 할 일로 태어나면 저장하자마자 지금 화면에서 사라진다.
      case 'open': return openForm(null, null, state.kind === 'event' ? 'event' : 'todo');
      case 'close': return closeForm();
      case 'save': return saveForm();
      case 'delete': {
        const id = state.editingId;
        state.showForm = false;
        state.editingId = null;
        state.form = null;
        return commit(state.items.filter((it) => it.id !== id), () => fb.removeTodo(id));
      }
      case 'toggleTime': state.form.hasTime = !state.form.hasTime; return render();
      case 'toggleSpan': {
        const f = state.form;
        f.hasSpan = !f.hasSpan;
        // 켤 때 종료가 시작보다 앞이면(처음 켜면 둘이 같다) 다음 날로 맞춘다 —
        // 스위치를 켜자마자 빨간 경고가 뜨는 화면은 고장으로 읽힌다.
        if (f.hasSpan && f.date && !(f.endDate > f.date)) f.endDate = addDays(f.date, 1);
        return render();
      }
      case 'repeatToggle': state.repeatOpen = !state.repeatOpen; return render();
    }
  }
  // click outside an open repeat menu closes it
  if (state.repeatOpen && !hit('.picker')) { state.repeatOpen = false; render(); }
});

// Form fields stay uncontrolled so typing never re-renders (and never loses the
// caret); state is updated in place and read back on the next render.
app.addEventListener('input', (e) => {
  const auth = e.target.closest('[data-a]');
  if (auth) { state.auth[auth.dataset.a] = auth.value; return; }
  // 탈퇴 확인 PIN. state.auth 와 섞지 않는다 — 로그인 폼과 수명이 다르다.
  const del = e.target.closest('[data-d]');
  if (del) { if (state.del) state.del[del.dataset.d] = del.value; return; }
  // 카테고리 이름. state.form 과 섞지 않는다 — 시트도 수명도 다르다.
  const cn = e.target.closest('[data-cn]');
  if (cn) { if (state.catDraft) { state.catDraft.name = cn.value; syncCatSheet(); } return; }
  // 목표 시트의 제목·메모·일. state.form 과 섞지 않는다 — 시트도 수명도 다르다.
  // 일 칸만 숫자다: 지우는 도중 '' 가 오는데, 그때 NaN 을 넣으면 goalDay() 가
  // Number(NaN)||1 로 1을 돌려주므로 화면과 저장이 둘 다 안 깨진다.
  const gf = e.target.closest('[data-g]');
  if (gf) {
    if (state.goalDraft) {
      const k = gf.dataset.g;
      state.goalDraft[k] = k === 'd' ? Number(gf.value) : gf.value;
      syncGoalSheet();
    }
    return;
  }
  const el = e.target.closest('[data-f]');
  if (!el || !state.form) return;
  state.form[el.dataset.f] = el.value;
  // ★ 필드를 가리지 않고 부른다. 예전에는 title 일 때만, 그것도 formOk() 가 아니라
  //   제목만 보고 버튼을 켰다 — 그래서 종료 시간을 잘못 넣어도 화면이 그대로였다.
  syncSheet();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // 약관 모달이 제일 위에 뜬다 — 먼저 닫는다.
    if (state.legal) { state.legal = null; return render(); }
    if (state.showForm) return closeForm();
    // 목표 시트도 본문 위에서만 열린다 — 입력 시트와 같은 층이라 바로 닫는다.
    if (state.goalDraft) return closeGoal();
    // 이미지 미리보기·점프는 다른 시트 위에 뜨지 않는다 — 본문 위에서만 열린다.
    if (state.exp) return closeExport();
    if (state.jump) return closeJump();
    // 카테고리 시트는 두 겹이다 — 편집기가 열려 있으면 그것만 닫는다.
    if (state.showCats) {
      if (state.catDraft) { state.catDraft = null; return render(); }
      return closeCats();
    }
    if (state.showAdmin) { state.showAdmin = false; return render(); }
    // 삭제 중에는 Esc 로 닫지 않는다 — 진행 중인 요청을 취소하지 못한다.
    if (state.showSettings && !(state.del && state.del.busy)) {
      state.showSettings = false; state.del = null; return render();
    }
  }
  // Enter submits the login / signup form.
  if (e.key === 'Enter' && !state.user && e.target.closest('[data-a]')) {
    return state.auth.mode === 'login' ? login() : signup();
  }
});
// theme:'system' 일 때만 의미가 있다. render() 안의 applyTheme() 이 저장값을
// 먼저 보므로, 밝은/어두운으로 고정해 둔 사람은 OS 를 바꿔도 흔들리지 않는다.
darkMQ.addEventListener('change', render);
// 일간 뷰가 스스로 다시 그려야 하는 자리가 둘이다 — 1분마다 움직이는 "지금" 표시선과,
// 화면을 돌렸을 때의 열 폭 재계산(표시 단계가 열 폭 px 으로 갈린다. 안 걸면 세로에서
// 4열이던 것이 가로로 돌려도 색 블록으로 남는다). 조건이 같으므로 함수 하나로 묶는다 —
// 한쪽만 고치는 사고를 막는다. 시트가 열려 있으면 미루고, closeForm() 이 그때 반영한다.
// ★ state.user 를 반드시 같이 본다. 로그아웃해도 state.view 는 안 지워지고
//   (applyLoggedOut 은 뷰를 사용자 설정으로 보고 그대로 둔다) 부팅 때 localStorage 에서
//   'day' 가 실려 온다. 그 상태로 **로그인 화면**에서 폰 키보드를 열면 resize 가 오고,
//   여기서 render() 가 돌아 누르고 있던 입력 칸이 문서에서 통째로 사라진다 — 포커스가
//   죽으니 키보드가 올라왔다 바로 닫히고, 이름도 PIN 도 칠 수가 없다. 로그인 화면에는
//   애초에 다시 그릴 일간 뷰가 없다.
const dayTick = () => { if (state.user && state.view === 'day' && !sheetBusy()) render(); };
setInterval(dayTick, 60000);
// 요소별 리스너가 아니라 위 setInterval·darkMQ 와 같은 층의 창 단위 리스너 하나다.
// 150ms 로 합치는 이유는 데스크톱 창 드래그다 — 안 합치면 #app 을 초당 수십 번 새로 만든다.
let resizeT = null;
window.addEventListener('resize', () => {
  if (resizeT) return;
  resizeT = setTimeout(() => { resizeT = null; dayTick(); }, 150);
});

// 세션 복원은 firebase.js 의 onAuthStateChanged 가 한다. 여기서는 로딩 화면만
// 띄우고, 모듈이 끝내 오지 않으면(오프라인·CDN 차단) 사용자를 붙잡아 두지 않는다.
render();
setTimeout(() => {
  if (!state.booting) return;
  state.booting = false;
  state.auth.error = t('app.offline');
  render();
}, 10000);

// ---------------------------------------------------------------- self-check
// Run with ?selftest in the URL. Covers recurrence + per-date completion +
// ordering — the logic that silently corrupts the calendar if it breaks.
if (location.search.includes('selftest')) {
  // ★ 첫 실패에서 throw 하지 않는다. 이유가 둘이다 —
  //   1) 남은 검사 결과를 못 본다. 하나 고치고 다시 돌리는 왕복이 실패 개수만큼 생긴다.
  //   2) 더 나쁜 것: 아래 state 복원(kv·kForm·kDay)이 통째로 건너뛰어 **selftest 픽스처가
  //      화면에 그대로 남는다.** 실패한 화면을 들여다보면 자기 데이터가 아니다.
  //   그래서 전부 돌리고 끝에서 목록으로 보고한다.
  const fails = [];
  let checks = 0;
  // info 는 **실제 값**이다. 이름만 적힌 실패 메시지는 무엇이 틀렸는지 못 알려 준다 —
  // 새로 추가하는 단언은 반드시 값을 같이 넘기거나, 아래 eq() 를 쓸 것.
  const ok = (cond, msg, info) => {
    checks++;
    if (!cond) fails.push(msg + (info === undefined ? '' : ' — ' + info));
  };
  const eq = (actual, expected, msg) => ok(actual === expected, msg,
    'got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
  const w = { id: 'w', date: '2026-01-05', repeat: 'weekly', time: '', pri: 'none', doneDates: ['2026-01-12'] };
  const m = { id: 'm', date: '2026-01-31', repeat: 'monthly', time: '09:00', pri: 'none', doneDates: [] };
  const o = { id: 'o', date: '2026-01-05', repeat: 'none', time: '08:00', pri: 'high', done: true };

  ok(!occursOn(w, '2026-01-04'), 'no occurrence before start date');
  ok(occursOn(w, '2026-01-05') && occursOn(w, '2026-01-12'), 'weekly repeats on same weekday');
  ok(!occursOn(w, '2026-01-13'), 'weekly skips other weekdays');
  ok(occursOn(m, '2026-03-31'), 'monthly repeats on same day-of-month');
  ok(!occursOn(m, '2026-02-28'), 'monthly skips months without that day');
  ok(occursOn(o, '2026-01-05') && !occursOn(o, '2026-01-06'), 'one-off occurs only on its date');

  ok(isDone(w, '2026-01-12') && !isDone(w, '2026-01-05'), 'repeating completion is per-date');
  ok(isDone(o, '2026-01-05'), 'one-off completion uses the done flag');

  ok(itemsOn([w, m, o], '2026-01-05', true).map((x) => x.id).join() === 'w,o',
    'all-day sorts before timed items');
  ok(itemsOn([w, m, o], '2026-01-05', false).map((x) => x.id).join() === 'w',
    'completed items are filtered out when hidden');

  // --- 요일 반복 (weekly + days) ---
  // 2026-01-05 는 월요일이다: 05 월 · 06 화 · 07 수 · 08 목 · 09 금 · 10 토 · 11 일.
  const wd = { id: 'wd', date: '2026-01-05', repeat: 'weekly', days: [1, 3, 5], time: '', pri: 'none' };
  ok(occursOn(wd, '2026-01-05') && occursOn(wd, '2026-01-07') && occursOn(wd, '2026-01-09'),
    'a weekly item with days occurs on every selected weekday');
  ok(!occursOn(wd, '2026-01-06') && !occursOn(wd, '2026-01-08') && !occursOn(wd, '2026-01-11'),
    'a weekly item with days skips the weekdays that were not selected');
  ok(!occursOn(wd, '2026-01-02'), 'days never pull an item earlier than its start date');
  const sunOnly = { id: 'su', date: '2026-01-05', repeat: 'weekly', days: [0] };
  ok(occursOn(sunOnly, '2026-01-11') && !occursOn(sunOnly, '2026-01-05'),
    'days:[0] is Sundays only — the index is getDay(), not an offset from the start');
  const allDays = { id: 'ad', date: '2026-01-05', repeat: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] };
  ok([0, 1, 2, 3, 4, 5, 6].every((i) => occursOn(allDays, addDays('2026-01-05', i))),
    'all seven weekdays selected occurs on every day');
  // 빈 배열은 '없음'과 같이 다룬다. 저장은 막지만, 어쩌다 들어온 문서가 화면에서
  // 사라지는 것보다 옛 동작으로 도는 편이 안전하다.
  const emptyDays = { id: 'ed', date: '2026-01-05', repeat: 'weekly', days: [] };
  ok(occursOn(emptyDays, '2026-01-12') && !occursOn(emptyDays, '2026-01-13'),
    'an empty days array falls back to the start weekday instead of disappearing');

  // --- 매년 반복 ---
  const y1 = { id: 'y1', date: '2026-03-14', repeat: 'yearly' };
  ok(occursOn(y1, '2027-03-14') && occursOn(y1, '2030-03-14'),
    'a yearly item repeats on the same month and day');
  ok(!occursOn(y1, '2027-03-15') && !occursOn(y1, '2027-04-14'), 'and on no other day');
  ok(!occursOn(y1, '2025-03-14'), 'and never before its start date');
  const feb29 = { id: 'f29', date: '2028-02-29', repeat: 'yearly' };
  ok(occursOn(feb29, '2032-02-29') && !occursOn(feb29, '2029-02-28'),
    'Feb 29 lands only on leap years — the same rule monthly uses for the 31st');

  // --- 기간 (span) ---
  // ★ 기간은 **일정만** 갖는다. 할 일에 span 이 들어와도 하루로 본다 — 그래야
  //   "5일짜리의 3일째에 체크하면 그 하루만 지워지는" 문제가 생길 자리가 없다.
  const ev = (o) => Object.assign({ id: 'e', kind: 'event', date: '2026-08-05', repeat: 'none' }, o);
  const e4 = ev({ span: 4 });                       // 2026-08-05(수) ~ 08-08(토)
  ok([0, 1, 2, 3].every((i) => occursOn(e4, addDays('2026-08-05', i))),
    'a four-day event covers four days');
  ok(!occursOn(e4, '2026-08-04') && !occursOn(e4, '2026-08-09'),
    'and not one day more at either end');
  eq(spanOf({ kind: 'todo', span: 5 }), 1, 'a to-do is one day however long its span field claims');
  eq(spanOf(ev({ span: 0 })), 1, 'a broken span falls back to one day rather than making it vanish');
  eq(occStart(e4, '2026-08-07'), '2026-08-05',
    'a day inside the span reports which occurrence it belongs to');
  eq(occStart(e4, '2026-08-09'), null, 'a day outside reports nothing');

  // ★ span 이 없는 항목은 occursOn 과 startsOn 이 **모든 날짜에서** 같아야 한다.
  //   다르면 기간을 도입하면서 기존 반복 할 일의 동작을 건드린 것이다.
  let sameAsStart = true;
  [w, m, o, wd, sunOnly, allDays, emptyDays, y1].forEach((it) => {
    for (let i = -3; i < 40; i++) {
      const d = addDays('2026-01-05', i);
      if (occursOn(it, d) !== startsOn(it, d)) sameAsStart = false;
    }
  });
  ok(sameAsStart, 'without a span, occursOn is still exactly startsOn — no existing item moved');

  // --- 주 격자의 막대 ---
  // 2026-08-02 는 일요일이다. 칸 색인은 요일과 같다 (0=일 … 6=토).
  const ws2 = '2026-08-02', ws3 = '2026-08-09', ws4 = '2026-08-16';
  const b1 = weekBars(e4, ws2);
  eq(b1.length, 1, 'an event that fits in one week draws one segment');
  eq(b1[0].from + ',' + b1[0].to, '3,6', 'Wednesday through Saturday is columns 3 to 6');
  ok(!b1[0].cutL && !b1[0].cutR, 'and neither end is marked as continuing');

  const vac = ev({ id: 'v', date: '2026-08-13', span: 6 });   // 08-13(목) ~ 08-18(화)
  const v3 = weekBars(vac, ws3)[0];
  eq(v3.from + ',' + v3.to, '4,6', 'a span crossing a week boundary stops at Saturday');
  ok(!v3.cutL && v3.cutR, 'with only its right end marked as continuing');
  const v4 = weekBars(vac, ws4)[0];
  eq(v4.from + ',' + v4.to, '0,2', 'and resumes at Sunday in the next week');
  ok(v4.cutL && !v4.cutR, 'with only its left end marked');
  eq(weekBars(vac, ws2).length, 0, 'a week the event never touches draws nothing');

  // ★ 한 주에 회차가 둘 이상 들어올 수 있다 — 매주 월·목 2일짜리가 그렇다.
  //   하나만 돌려주면 목·금 회차가 화면에서 조용히 사라진다.
  const twice = ev({ id: 't2', date: '2026-08-03', span: 2, repeat: 'weekly', days: [1, 4] });
  const bt = weekBars(twice, ws2);
  eq(bt.length, 2, 'a weekly event on two weekdays draws two segments in the same week');
  eq(bt.map((b) => b.from + '-' + b.to).join(), '1-2,4-5', 'Mon–Tue and Thu–Fri, not one merged bar');

  // 층 배정. 안 겹치면 같은 층을 다시 쓰고, 겹치면 쌓는다 (dayLayout 과 같은 방식).
  eq(laneBars([{ from: 1, to: 5 }, { from: 4, to: 6 }, { from: 0, to: 0 }])
      .map((r) => r.from + ':' + r.lane).join(), '0:0,1:0,4:1',
    'bars that do not overlap share a lane; overlapping ones stack');

  // ★ 옛 항목(days 없음)과, 편집 시트가 days 를 채워 저장한 뒤의 같은 항목이
  //   모든 날짜에서 한 칸도 다르지 않아야 한다. 이게 깨지면 기존 반복 할 일이
  //   편집 한 번에 다른 날로 옮겨간다.
  const migrated = Object.assign({}, w, { days: defaultDays(w.date) });
  let sameAsOld = true;
  for (let i = -3; i < 40; i++) {
    const d = addDays('2026-01-05', i);
    if (occursOn(w, d) !== occursOn(migrated, d)) sameAsOld = false;
  }
  ok(sameAsOld, 'filling days in from the start weekday changes no occurrence, on any date');

  // --- 시작·종료 시간 (endTime) ---
  // ★ 제일 중요한 것은 첫 세 줄이다: endTime 키가 아예 없는 옛 항목의 표시가
  //   한 글자도 변하면 안 된다. 변하면 기존 사용자의 화면과 내보낸 이미지가
  //   조용히 전부 달라진다.
  const e0 = { id: 'e0', title: '회의', date: '2026-01-05', repeat: 'none', time: '07:00', pri: 'none' };
  const e1 = Object.assign({}, e0, { id: 'e1', endTime: '08:00' });
  ok(timeRange('07:00', '') === timeLabel('07:00'), 'an empty end time renders exactly like the old start-only label');
  ok(pill(e0, '2026-01-05').range === timeLabel('07:00'),
    'an item with no endTime key still reads exactly as it did before endTime existed');
  ok(exRow(e0, '2026-01-05', false).time === timeLabel('07:00'),
    'and unchanged in the exported image');
  ok(timeRange('07:00', '08:00') === timeLabel('07:00') + ' – ' + timeLabel('08:00'),
    'a range is the two labels joined by an en dash');
  ok(pill(e1, '2026-01-05').range === timeRange('07:00', '08:00') &&
     exRow(e1, '2026-01-05', false).time === timeRange('07:00', '08:00'),
    'an item with an end time shows the range everywhere it is drawn wide');
  // ★ 주간 칸에는 시간을 아예 안 적는다(사용자 요청). 좁은 칸용이던 시작-only 라벨은
  //   쓰는 곳이 없어져 pill() 에서 지웠다 — 다시 넣으면 WEEK_FIT 를 다시 재야 한다.
  ok(pill(e1, '2026-01-05').timeLabel === undefined,
    'pill() no longer carries a start-only label — nothing draws one');
  ok(pill({ id: 'a', date: '2026-01-05', repeat: 'none', time: '', pri: 'none' }, '2026-01-05').range
     === t('item.allDay'), 'an all-day item has no time at either end');

  // ★ 자정 넘김 금지.
  ok(endOk({ hasTime: true, time: '07:00', end: '08:00' }), 'an end after the start is accepted');
  ok(!endOk({ hasTime: true, time: '23:00', end: '01:00' }), 'a range that crosses midnight is refused');
  ok(!endOk({ hasTime: true, time: '07:00', end: '07:00' }), 'an end equal to the start is refused');
  ok(endOk({ hasTime: true, time: '07:00', end: '' }), 'leaving the end empty is always allowed');
  ok(endOk({ hasTime: false, time: '23:00', end: '01:00' }), 'an all-day item ignores both times');

  // 하루 종일로 바꾸면 시작·종료가 함께 비워진다.
  const cleared = formTimes({ hasTime: false, time: '07:00', end: '08:00' });
  ok(cleared.time === '' && cleared.endTime === '', 'switching to all-day clears the start and the end together');
  ok(formTimes({ hasTime: true, time: '07:00', end: '' }).endTime === '',
    'a missing end is stored as an empty string, never undefined');
  ok(formTimes({ hasTime: true, time: '07:00', end: '08:00' }).endTime === '08:00',
    'the end time is stored as the plain HH:MM string it came in as');

  // 정렬은 endTime 을 안 본다 — 시작이 같으면 넣은 순서를 지킨다 (안정 정렬).
  const q1 = { id: 'q1', date: '2026-01-05', repeat: 'none', time: '09:00', endTime: '23:00', pri: 'none' };
  const q2 = { id: 'q2', date: '2026-01-05', repeat: 'none', time: '09:00', pri: 'none' };
  ok(sortItems([q1, q2]).map((x) => x.id).join() === 'q1,q2' &&
     sortItems([q2, q1]).map((x) => x.id).join() === 'q2,q1',
    'endTime never reorders items that start at the same time');

  // ko/en 양쪽 형식. 문자열을 통째로 박아 두지 않는다 — Intl 이 AM/PM 앞에 좁은
  // 공백(U+202F)을 넣는 브라우저가 있어서, 구조만 본다.
  const lk = SETTINGS.lang;
  setSettings({ lang: 'ko' });
  const koR = timeRange('07:00', '08:00');
  setSettings({ lang: 'en' });
  const enR = timeRange('07:00', '08:00');
  ok(koR.indexOf(' – ') > 0 && enR.indexOf(' – ') > 0, 'both languages use the same separator');
  ok(koR !== enR && koR.indexOf('오전') === 0 && enR.indexOf('AM') > 0,
    'the range is localised on both sides, not just the first');
  ok(timeRange('07:00', '') === timeLabel('07:00'), 'a start-only label stays start-only in English too');
  setSettings({ lang: lk });

  // --- accounts ---
  // 계정은 이제 Firebase 가 들고 있다. 여기서 검사할 수 있는 건 서버에 보내기
  // 전의 입력 규칙뿐 — PIN은 Firebase Auth 비밀번호라 6자리여야 한다.
  ok(validPin('123456'), 'a 6-digit PIN is accepted');
  ok(!validPin('4943') && !validPin('1234567'), 'PINs shorter or longer than 6 digits are rejected');
  ok(!validPin('12a456') && !validPin('') && !validPin(null), 'non-numeric and empty PINs are rejected');
  ok(validEmail('a@b.co') && !validEmail('a@b') && !validEmail(''), 'signup requires a real email address');
  ok(normName('  이준호  ') === '이준호', 'the name is trimmed before it is used as a key');

  // --- 약관 동의 ---
  // 여기가 뚫리면 동의 없이 가입 신청이 나간다. 서버(firestore.rules)가 한 번 더
  // 막지만, 그때는 Auth 계정만 만들어졌다 지워지는 낭비가 생긴다.
  const ag = (o) => Object.assign(blankAuth().agree, o);
  ok(agreeMissing(ag({ terms: true, privacy: true, age: 'over14' })) === '', 'all required consents pass');
  ok(agreeMissing(ag({ terms: true, privacy: true, age: 'under14_guardian' })) === '',
    'under-14 with guardian consent passes');
  ok(agreeMissing(ag({ privacy: true, age: 'over14' })), 'missing terms consent is rejected');
  ok(agreeMissing(ag({ terms: true, age: 'over14' })), 'missing privacy consent is rejected');
  ok(agreeMissing(ag({ terms: true, privacy: true })), 'missing age confirmation is rejected');
  ok(agreeMissing(ag({ terms: true, privacy: true, age: 'yes' })), 'an unknown age value is rejected');
  ok(agreeMissing(blankAuth().agree), 'a fresh signup form has nothing agreed yet');
  // marketing 은 선택이다 — 꺼져 있어도 통과해야 한다.
  ok(agreeMissing(ag({ terms: true, privacy: true, age: 'over14', marketing: false })) === '',
    'the optional marketing consent never blocks signup');

  // --- 탈퇴 ---
  // 관리자가 스스로 지우면 서비스가 관리자 없이 잠긴다. 보안 규칙에도 같은
  // 조건이 있지만, 화면에서 버튼을 감추는 판정도 여기서 지킨다.
  ok(!canDeleteSelf({ role: 'admin' }), 'an admin cannot delete their own account');
  ok(canDeleteSelf({ role: 'user' }), 'a normal user can delete their own account');
  ok(!canDeleteSelf(null), 'no session means there is nothing to delete');

  // --- 설정 값 ---
  ok(okTheme('light') && okTheme('dark') && okTheme('system'), 'the three themes are accepted');
  ok(!okTheme('Dark') && !okTheme('') && !okTheme(null), 'unknown theme values are rejected');
  ok(okLang('ko') && okLang('en') && !okLang('jp'), 'only the two supported languages are accepted');
  ok(okView('year') && okView('month') && okView('week') && okView('day'),
    'the four first-screen values are accepted');
  ok(!okView('Month') && !okView('decade') && !okView(''), 'unknown first-screen values are rejected');

  // 원격에 있는 키는 Firestore 가 이기고, 빠진 키는 로컬 값이 살아남는다 —
  // 로그인 화면에서 고른 언어가 첫 로그인 때 사라지지 않게 하는 규칙이다.
  // ★ '완전한 맵' 은 SETTINGS 의 키 전부다 — view 를 늘렸을 때 여기를 같이 안 고쳐서
  //   실제로 이 검사가 깨졌다. 키를 늘리면 아래 세 픽스처를 다 손볼 것.
  const keep = { theme: SETTINGS.theme, lang: SETTINGS.lang, view: SETTINGS.view };
  setSettings({ theme: 'dark', lang: 'en', view: 'day' });
  ok(adoptSettings({ theme: 'light', lang: 'ko', view: 'week' }) === true &&
     SETTINGS.theme === 'light' && SETTINGS.lang === 'ko' && SETTINGS.view === 'week',
    'a complete remote settings map wins');
  setSettings({ theme: 'dark', lang: 'en', view: 'day' });
  ok(adoptSettings({ theme: 'light' }) === false && SETTINGS.lang === 'en' && SETTINGS.view === 'day',
    'a missing remote key keeps the local value and asks to be promoted');
  ok(adoptSettings(undefined) === false, 'an account with no settings field asks to be promoted');
  ok(adoptSettings({ theme: 'neon', lang: 'jp' }) === false && SETTINGS.lang === 'en',
    'garbage from the server is ignored, not adopted');

  // --- ★ 언어를 바꿔도 날짜 데이터 키는 그대로여야 한다 ---
  // 여기가 뚫리면 Intl 이 저장 경로로 새어 들어간 것이고, 할 일이 하루씩 밀린다.
  // 표시 문자열은 달라지고 데이터는 안 달라진다 — 그 둘을 한 번에 본다.
  const probe = new Date(2026, 6, 25);            // 로컬 자정, 토요일
  setSettings({ lang: 'ko' });
  const koDate = fmt(probe), koDay = dayTitle(probe), koDow = dow().join();
  const koOcc = [occursOn(w, '2026-01-12'), occursOn(m, '2026-03-31'), occursOn(o, '2026-01-05')].join();
  const koDone = [isDone(w, '2026-01-12'), isDone(w, '2026-01-05'), isDone(o, '2026-01-05')].join();
  setSettings({ lang: 'en' });
  ok(fmt(probe) === koDate && fmt(probe) === '2026-07-25', 'fmt() is byte-identical in English');
  ok(fmt(parse('2026-07-25')) === '2026-07-25', 'the date key survives a parse/format round trip');
  ok(addDays('2026-07-25', 1) === '2026-07-26' && addDays('2026-12-31', 1) === '2027-01-01',
    'addDays stays on the local-string calendar across a year boundary');
  ok([occursOn(w, '2026-01-12'), occursOn(m, '2026-03-31'), occursOn(o, '2026-01-05')].join() === koOcc,
    'occursOn does not depend on the language');
  ok([isDone(w, '2026-01-12'), isDone(w, '2026-01-05'), isDone(o, '2026-01-05')].join() === koDone,
    'isDone does not depend on the language');
  ok(itemsOn([w, m, o], '2026-01-05', true).map((x) => x.id).join() === 'w,o',
    'ordering does not depend on the language');
  // 반대쪽도 확인한다 — 표시 문자열까지 안 바뀌면 Intl 이 아예 안 걸린 것이다.
  ok(dayTitle(probe) !== koDay && dow().join() !== koDow, 'the displayed month and weekday names do change');
  ok(dow().length === 7 && dow('long')[0] === 'Sunday', 'the weekday array is Sunday-first');
  // days 판정도 언어를 안 탄다 — 위 한국어 구간에서 단언한 것과 같은 값이어야 한다.
  ok(occursOn(wd, '2026-01-07') && !occursOn(wd, '2026-01-08'),
    'occursOn with days gives the same answer in English');
  // 라벨은 반대로 반드시 언어를 타야 한다. 숫자 days → 이름은 dow() 만 지난다.
  ok(repLabel('weekly', [1, 3, 5]) === 'Every Mon, Wed, Fri', 'the weekday label is translated');
  ok(repLabel('weekly', [3]) === 'Every Wednesday', 'a single weekday uses the long English name');
  ok(repLabel('weekly', [0, 1, 2, 3, 4, 5, 6]) === 'Weekly (all days)' && repLabel('daily') === 'Daily',
    'all seven weekdays get their own label, distinct from Daily');

  setSettings({ lang: 'ko' });
  ok(repLabel('weekly') === '매주' && repLabel('weekly', []) === '매주',
    'an old weekly item with no days still shows the plain label');
  ok(repLabel('weekly', [1, 3, 5]) === '매주 월·수·금', 'the label lists the selected weekdays');
  ok(repLabel('weekly', [3]) === '매주 수요일', 'a single weekday gets the long name');
  ok(repLabel('weekly', [0, 1, 2, 3, 4, 5, 6]) === '매주 (매일)' && repLabel('daily') === '매일',
    'seven weekdays read as 매주 (매일), which is not 매일');
  setSettings(keep);   // ?selftest 가 저장된 설정을 건드리고 끝나지 않게 되돌린다

  // --- 이미지 내보내기 ---
  // 캔버스 픽셀은 검증이 어렵다. 순수 함수로 뽑아 둔 네 가지만 본다 —
  // 줄바꿈·말줄임 / 뷰별 레이아웃 좌표 / 파일명 / 메모 제외.

  // 가짜 측정기. 글자 하나가 10px 이라고 치면 계산을 손으로 검산할 수 있다.
  const mm = (s) => s.length * 10;
  ok(exEllipsize('가나다라마', 50, mm) === '가나다라마', 'text that already fits is left alone');
  ok(exEllipsize('가나다라마바사', 50, mm) === '가나다라…', 'an overlong string is cut and gets an ellipsis');
  ok(exWrap('가나다라마바사아자차', 50, 1, mm).join('|') === '가나다라…',
    'a single-line box ellipsises a long Korean title');
  ok(exWrap('가나다라마바사아자차', 50, 2, mm).join('|') === '가나다라마|바사아자차',
    'Korean wraps per character when there is no space to break on');
  ok(exWrap('hello world foo', 100, 2, mm).join('|') === 'hello|world foo',
    'English breaks on the last space, not mid-word');
  ok(exWrap('', 100, 2, mm).length === 0, 'an empty title produces no lines');
  ok(exWrap('   ', 100, 2, mm).length === 0, 'a whitespace-only title produces no lines');
  ok(exWrap('가나다', 5, 1, mm).length === 1, 'a box too narrow for one glyph still terminates');

  // 2026-07-01 은 수요일(offset 3) + 31일 → 5주. 2026-08-01 은 토요일(offset 6) → 6주.
  // 2026-02-01 은 일요일(offset 0) + 28일 → 정확히 4주, 격자 경계 케이스다.
  const jul = exMonthLayout(2026, 6), aug = exMonthLayout(2026, 7), feb = exMonthLayout(2026, 1);
  ok(jul.weeks === 5 && jul.h === 1150, 'a 5-week month is 1080x1150');
  ok(aug.weeks === 6 && aug.h === 1326, 'a 6-week month is one row taller');
  ok(feb.weeks === 4 && feb.offset === 0, 'a month that starts on Sunday and ends on Saturday is exactly 4 weeks');
  ok(aug.h - jul.h === 176 && jul.w === 1080 && aug.w === 1080, 'only the height changes with the week count');
  ok(Math.abs(jul.cellW * 7 - 1020) < 1e-9, 'the seven columns fill the grid exactly');

  // 주·일은 데이터가 높이를 정하므로 위아래를 클램프한다.
  // ★ 하한(총 598px)은 **안 움직인다** — 텅 빈 주의 이미지 크기가 갑자기 달라지면
  //   예전에 내보낸 그림과 나란히 놨을 때 어긋난다. 대신 그 하한이 담는 칸 수가
  //   W_ITEM 에 따라 변한다: 시간 라벨을 빼면서 88 → 52 가 되어 3칸 → 5칸이 됐다.
  ok(exWeekLayout(0).h === 598 && exWeekLayout(0).fit >= 1, 'a sparse week produces a short image');
  ok(exWeekLayout(5).h === 598, 'the week floor swallows five slots before it has to grow');
  ok(exWeekLayout(6).h > 598, 'past the floor the week grows with the data');
  ok(exWeekLayout(99).h === 1700, 'a packed week is clamped instead of growing forever');
  ok(exWeekLayout(99).fit < 99, 'a packed week hides the overflow behind a +N line');
  ok(exDayLayout([]).h === 700 && exDayLayout([]).shown === 0, 'an empty day still renders a card');
  const many = exDayLayout(new Array(120).fill(110));
  ok(many.h <= EX_MAX_H && many.hidden > 0 && many.shown + many.hidden === 120,
    'a day with too many rows is clamped and reports what it hid');
  ok(exDayLayout(new Array(40).fill(110)).hidden === 0,
    '40 rows now fit — the day ceiling was raised from 1800 to the shared 8000 cap');

  // 파일명. 주는 ISO 주차가 아니라 **그 주 일요일**로 적는다 — 이 앱의 주는
  // 일요일 시작이고 ISO 는 월요일 시작이라 섞으면 반드시 어긋난다.
  ok(exportFilename('month', '2026-07-26', 2026, 6) === 'todo-calendar-month-2026-07.png',
    'the month filename is zero-padded');
  ok(exportFilename('day', '2026-07-26', 2026, 6) === 'todo-calendar-day-2026-07-26.png',
    'the day filename is the selected date');
  ok(exportFilename('week', '2026-07-29', 2026, 6) === 'todo-calendar-week-2026-07-26.png',
    'the week filename normalises any weekday to that week’s Sunday');

  // --- 메모는 끄면 데이터에 아예 없어야 한다 ---
  // 빈 문자열로 두면 나중에 누가 `row.memo != null` 로 검사할 때 새어 나간다.
  const secret = [{ id: 's', title: '병원', date: '2026-07-26', time: '', pri: 'none',
    repeat: 'none', memo: '진료 기록 열람', done: false }];
  const withMemo = exportModel('day', secret, '2026-07-26', 2026, 6, true);
  const noMemo = exportModel('day', secret, '2026-07-26', 2026, 6, false);
  ok(withMemo.rows[0].memo === '진료 기록 열람', 'the note is carried when the toggle is on');
  ok(!('memo' in noMemo.rows[0]), 'the note key is absent entirely when the toggle is off');
  ok(JSON.stringify(noMemo).indexOf('진료 기록 열람') === -1,
    'the note text appears nowhere in the exported model when the toggle is off');
  // 월 뷰도 같은 경로를 지난다 — 셀에 메모를 안 그린다고 모델에 남겨 두면 안 된다.
  const mNo = exportModel('month', secret, '2026-07-26', 2026, 6, false);
  ok(JSON.stringify(mNo).indexOf('진료 기록 열람') === -1,
    'the month model drops the note too');
  ok(mNo.days.length === 35 && mNo.days.filter((d) => d.inMonth).length === 31,
    'the month model covers 5 weeks and 31 days of July 2026');

  // --- 상세 목록 (월·주 격자 아래) ---
  // 셀 폭 154px 에서 잘리는 제목을 폭 1080 으로 다시 싣는 영역이다.
  const g1 = [{ ds: '2026-07-26', rows: [{ title: '가', done: false }] }];
  ok(exDetailLayout([], 5000).h === 0, 'no days with to-dos means no detail section at all');
  ok(exDetailLayout(g1, 5000).h === 56 + 110 + 20,
    'one day with one row is a date header plus a row plus the gap');
  ok(exDetailLayout(g1, 5000).hidden === 0 && exDetailLayout(g1, 5000).shown === 1,
    'nothing is hidden when it fits');
  ok(exDetailLayout([{ ds: 'x', rows: [{ title: 'a' }, { title: 'b', memo: 'm' }] }], 5000).h
     === 56 + 110 + (110 + 62) + 20, 'a row carrying a note reserves two extra lines');
  const gMany = [];
  for (let i = 0; i < 60; i++) gMany.push({ ds: '2026-07-' + pad((i % 28) + 1), rows: [{ title: 'a' }] });
  const dm = exDetailLayout(gMany, 1000);
  ok(dm.hidden > 0 && dm.shown + dm.hidden === 60, 'an over-budget detail list reports what it cut');
  ok(dm.h <= 1000, 'the +N line is counted inside the budget, not added on top of it');

  // 상세를 끄면 월 이미지는 지금과 바이트 동일해야 한다 — 높이가 안 변해야 성립한다.
  const busy = [];
  for (let d = 1; d <= 28; d++) {
    busy.push({ id: 'x' + d, title: '항목 ' + d, date: '2026-07-' + pad(d), time: '',
      pri: 'none', repeat: 'none', memo: '메모 ' + d, done: false });
  }
  const off = exportModel('month', busy, '2026-07-26', 2026, 6, true, false);
  const on = exportModel('month', busy, '2026-07-26', 2026, 6, true, true);
  ok(off.layout.h === 1150 && !off.layout.detail,
    'with the detail list off the month image keeps its exact old height');
  ok(on.layout.h > off.layout.h && on.layout.detail.shown === 28,
    'with it on the image grows and every day that has to-dos gets a header');
  ok(on.layout.h <= EX_MAX_H, 'the detail list never pushes the image past the canvas ceiling');
  // 앞뒤 달에서 넘어온 칸은 격자에만 있고 상세에는 안 실린다.
  ok(on.layout.detail.groups.every((g) => g.ds.slice(0, 7) === '2026-07'),
    'the month detail lists only days belonging to that month');

  // ★ 두 토글의 상호작용: 상세는 나오되 메모 줄은 없어야 한다.
  const dOnMOff = exportModel('month', busy, '2026-07-26', 2026, 6, false, true);
  ok(dOnMOff.layout.detail.shown === 28, 'detail=true still produces the list when memo=false');
  ok(dOnMOff.layout.detail.groups.every((g) => g.rows.every((r) => !('memo' in r))),
    'detail=true + memo=false leaves no note on any detail row');
  ok(JSON.stringify(dOnMOff).indexOf('메모 ') === -1,
    'no note text survives anywhere in the model when memo is off');
  ok(dOnMOff.layout.h < on.layout.h, 'dropping the notes makes the detail list shorter');

  // --- 년·월 점프 ---
  const ys = jumpYears(2026, 2026);
  ok(ys.length === 21 && ys[0] === 2016 && ys[20] === 2036, 'the year range is today ±10');
  ok(jumpYears(2026, 2040).indexOf(2040) >= 0 && jumpYears(2026, 2040).length === 22,
    'a year outside the range is added so the current view is always selectable');
  ok(jumpYears(2026, 2016).length === 21, 'a year already at the boundary is not duplicated');

  // 말일 클램프 — 없는 날을 고르면 그 달 마지막 날로 내려앉는다.
  ok(clampDay(2026, 1, 31) === '2026-02-28', 'Jan 31 → February lands on the 28th');
  ok(clampDay(2028, 1, 31) === '2028-02-29', 'a leap year keeps the 29th');
  ok(clampDay(2026, 3, 31) === '2026-04-30', '31st → a 30-day month lands on the 30th');
  ok(clampDay(2026, 6, 15) === '2026-07-15', 'a day that exists is left alone');

  // ★ 점프는 cy/cm/selected 를 함께 쓴다. `<` `>` 는 축이 갈리지만(월간은 cy/cm 만),
  //   점프는 [data-day]·[today] 계열이다 — 안 그러면 하단 리스트가 이전 달을 가리킨다.
  const jm = jumpTo('month', 2026, 1, '2026-07-26');
  ok(jm.cy === 2026 && jm.cm === 1 && jm.selected === '2026-02-01',
    'jumping in month view moves the selection to the 1st of the target month');
  ok(jumpTo('week', 2027, 11, '2026-07-26').selected === '2027-12-01',
    'week view jumps to the 1st as well');
  ok(jumpTo('day', 2026, 1, '2026-01-31').selected === '2026-02-28',
    'day view keeps the day-of-month and clamps it to the last day');
  ok(jumpTo('day', 2026, 1, '2026-01-15').selected === '2026-02-15',
    'day view keeps the day-of-month when it exists');
  // 어느 뷰든 선택된 날은 반드시 점프한 달 안에 있어야 한다.
  ['month', 'week', 'day'].forEach((v) => {
    const r = jumpTo(v, 2026, 1, '2026-07-31');
    ok(r.selected.slice(0, 7) === '2026-02' && parse(r.selected).getMonth() === r.cm,
      'the selected date always lands inside the month that was jumped to (' + v + ')');
  });

  // --- [캘린더 포함] 토글 ---
  // 격자를 빼면 그 높이가 통째로 빠지고 제목(150)·꼬리말(64)만 남는다.
  const gOn = exportModel('month', busy, '2026-07-26', 2026, 6, true, true, true);
  const gOff = exportModel('month', busy, '2026-07-26', 2026, 6, true, true, false);
  const gridOnly = exportModel('month', busy, '2026-07-26', 2026, 6, true, false, true);
  ok(gridOnly.layout.h === 1150, 'grid on + detail off is the unchanged 1150 baseline');
  ok(gOn.layout.h === on.layout.h, 'grid on + detail on matches what it was before the toggle existed');
  ok(gOff.layout.h === gOn.layout.h - 936, 'dropping the grid removes exactly its 936px (56 + 176x5)');
  ok(gOff.layout.gridH === 0 && gOff.layout.grid === false, 'the grid contributes no height when off');
  ok(exMonthLayout(2026, 6).h === 1150, 'omitting the flag keeps the grid — old call sites still mean what they meant');
  ok(exMonthLayout(2026, 6, 0).gridH === 0, 'any falsy value turns the grid off, not just a literal false');
  ok(gOff.layout.detail.shown === 28, 'the detail list survives with the grid off');
  ok(gOff.title === gOn.title && gOff.sub === gOn.sub,
    'the heading stays so the image still says which month it is');
  // 주간도 같은 규칙 — 격자 높이만 빠진다.
  const wOn = exportModel('week', busy, '2026-07-26', 2026, 6, true, true, true);
  const wOff = exportModel('week', busy, '2026-07-26', 2026, 6, true, true, false);
  ok(wOn.layout.h - wOff.layout.h === wOn.layout.gridH, 'the week loses exactly its grid height');
  ok(wOff.layout.h > 214, 'the week keeps its heading, footer and detail list');

  // ★ 마지막 남은 하나는 끌 수 없다. 양방향 대칭이어야 한다.
  ok(expCanToggle({ grid: true, detail: true }, 'grid'), 'either can be turned off while both are on');
  ok(expCanToggle({ grid: true, detail: true }, 'detail'), 'symmetric for the other one');
  ok(!expCanToggle({ grid: true, detail: false }, 'grid'), 'the last remaining one cannot be turned off');
  ok(!expCanToggle({ grid: false, detail: true }, 'detail'), 'and the same the other way round');
  ok(expCanToggle({ grid: false, detail: true }, 'grid'), 'an already-off toggle can always be turned back on');
  ok(expCanToggle({ grid: true, detail: false }, 'detail'), 'symmetric for turning the other back on');
  // ★ memo 는 내용이 아니라 개인정보 장치다. 무엇이 꺼져 있든 항상 끌 수 있어야 한다.
  ok(expCanToggle({ grid: false, detail: true, memo: true }, 'memo'),
    'the note switch never locks just because the calendar is off');
  ok(expCanToggle({ grid: true, detail: false, memo: true }, 'memo'),
    'nor because the detail list is off');

  // --- 점프 팝오버: 임시 선택 ---
  // ★ 탭은 임시 선택만 옮긴다. [이동] 을 누르기 전에는 달력이 안 움직인다.
  const kv = { view: state.view, cy: state.cy, cm: state.cm, selected: state.selected, jump: state.jump };
  state.view = 'month'; state.cy = 2026; state.cm = 6; state.selected = '2026-07-26';

  openJump();
  ok(state.jump.y === 2026 && state.jump.m === 6, 'the picker opens on the month currently shown');
  ok(state.jump.sy === null && state.jump.sm === null, 'scroll offsets start unset so the first render centres them');
  state.jump.y = 2030; state.jump.m = 11;      // 탭 두 번과 같다
  ok(state.cy === 2026 && state.cm === 6 && state.selected === '2026-07-26',
    'staging a year and month does not move the calendar');
  closeJump();
  ok(state.jump === null && state.cy === 2026 && state.cm === 6 && state.selected === '2026-07-26',
    'cancelling the picker throws the staged selection away');

  openJump();
  state.jump.y = 2030; state.jump.m = 11;
  applyJump();
  ok(state.cy === 2030 && state.cm === 11 && state.selected === '2030-12-01' && state.jump === null,
    'Go commits all three at once and closes the picker');

  // 일간은 같은 '일' 을 유지하고 없으면 말일로 내려앉는다.
  state.view = 'day'; state.cy = 2026; state.cm = 0; state.selected = '2026-01-31';
  openJump(); state.jump.y = 2026; state.jump.m = 1; applyJump();
  ok(state.selected === '2026-02-28', 'day view clamps Jan 31 to the last day of February');
  state.cy = 2028; state.cm = 0; state.selected = '2028-01-31';
  openJump(); state.jump.y = 2028; state.jump.m = 1; applyJump();
  ok(state.selected === '2028-02-29', 'a leap year keeps the 29th');

  // 스크롤 오프셋: 선택 항목이 5칸 중 3번째에 온다. 맨 위 두 개는 0 으로 눌린다.
  ok(jumpOffset(0) === 0 && jumpOffset(2) === 0, 'the first entries do not scroll past the top');
  ok(jumpOffset(10) === 8 * J_ITEM, 'a mid-list entry is scrolled to the third visible slot');
  ok(jumpOffset(jumpYears(2026, 2026).indexOf(2026)) === 8 * J_ITEM,
    'opening on the current year does not leave the list sitting at 2016');

  Object.assign(state, kv);   // 검사 때문에 달력이 옮겨진 채 끝나지 않게 되돌린다

  // --- 저장 버튼: 조건이 아니라 **그려진 화면**을 본다 ---
  // ★ formOk() 만 검사하면 갤럭시에서 나온 버그를 못 잡는다 — 그때도 저장은
  //   막혔고(조건은 옳았고) 버튼만 진한 파란색으로 남아 있었다. 그래서 실제로
  //   렌더된 #saveBtn 의 disabled 와 안내 문구의 표시 여부를 본다.
  const kForm = { showForm: state.showForm, editingId: state.editingId, form: state.form,
    user: state.user, booting: state.booting, items: state.items };
  state.booting = false;
  state.items = [];
  state.user = { uid: 'u', name: 'selftest', email: 'a@b.co', role: 'user', status: 'approved' };
  const renderForm = (patch) => {
    state.showForm = true;
    state.editingId = null;
    state.form = Object.assign(blankForm('2026-01-05'), patch);
    render();
    return document.getElementById('saveBtn');
  };
  ok(renderForm({ title: '회의' }) && !renderForm({ title: '회의' }).disabled,
    'a valid form renders an enabled save button');
  // 입력칸 높이의 기준값. 아래 카테고리 시트가 이것과 같은지 본다 — 카테고리 이름
  // 칸만 .field 를 맨몸으로 써서(패딩이 없다) 브라우저 기본 높이로 납작했다.
  const refFieldH = document.querySelector('[data-f="title"]').getBoundingClientRect().height;
  ok(renderForm({ title: '   ' }).disabled, 'an empty title renders the save button disabled');
  ok(renderForm({ title: '회의', repeat: 'weekly', days: [] }).disabled,
    'weekly with no weekday selected renders the save button disabled');
  ok(renderForm({ title: '회의', hasTime: true, time: '07:00', end: '06:00' }).disabled,
    'an end time before the start renders the save button disabled');
  ok(renderForm({ title: '회의', hasTime: true, time: '07:00', end: '07:00' }).disabled,
    'an end time equal to the start renders the save button disabled');
  ok(!document.getElementById('formEndWarn').hidden,
    'the end-time hint is on screen while the end time is invalid');

  // ★ 버그 재현 경로: 입력 위임은 render() 를 안 부르므로 syncSheet() 가 화면을
  //   맞춰야 한다. 제목을 치는 것만으로 버튼이 다시 켜지면 안 된다.
  state.form.title = '회의록';
  syncSheet();
  ok(document.getElementById('saveBtn').disabled,
    'typing in the title never re-enables the button while the end time is still invalid');
  state.form.end = '08:00';
  syncSheet();
  ok(!document.getElementById('saveBtn').disabled && document.getElementById('formEndWarn').hidden,
    'fixing the end time clears the hint and enables the button without a full re-render');
  state.form.date = '2026-01-07';   // 수요일
  syncSheet();
  ok(document.getElementById('formDow').textContent === '(' + dow()[3] + ')',
    'the weekday beside the date follows the date field without a full re-render');

  Object.assign(state, kForm);
  render();

  // --- 일간 뷰: 겹침 배치 + 유동 시간축 ---
  const dItem = (id, time, endTime) => ({ id: id, title: id, date: '2026-01-05', time: time,
    endTime: endTime === undefined ? '' : endTime, pri: 'none', repeat: 'none', days: [], memo: '' });
  const lay = (list) => { const r = dayRange(list); return { r: r, out: dayLayout(list, r) }; };
  const byId = (out) => { const m = {}; out.forEach((o) => { m[o.id] = o; }); return m; };

  // 2개 겹침 → 두 열
  const ov2 = lay([dItem('a', '10:00', '11:00'), dItem('b', '10:30', '11:30')]);
  ok(byId(ov2.out).a.col === 0 && byId(ov2.out).b.col === 1 &&
     ov2.out.every((o) => o.cols === 2), 'two overlapping items get one column each');
  // 3개 겹침 → 세 열
  const ov3 = lay([dItem('a', '10:00', '12:00'), dItem('b', '10:30', '11:30'), dItem('c', '11:00', '11:45')]);
  ok(ov3.out.every((o) => o.cols === 3) && byId(ov3.out).c.col === 2,
    'three mutually overlapping items get three columns');
  // ★ 안 겹치는 연속은 한 열이고, 같은 열을 재사용한다
  const seq = lay([dItem('a', '10:00', '11:00'), dItem('b', '11:00', '12:00')]);
  ok(seq.out.every((o) => o.cols === 1 && o.col === 0),
    'back-to-back items do not overlap — the column is reused, not split');
  // 완전 포함 — 긴 것이 먼저(왼쪽), 안에 든 것이 옆 열
  const nest = lay([dItem('in', '13:00', '14:00'), dItem('out', '09:00', '18:00')]);
  ok(byId(nest.out).out.col === 0 && byId(nest.out).in.col === 1 &&
     nest.out.every((o) => o.cols === 2), 'a contained item sits beside its container, longest first');
  // 종료 없는 항목: 겹침은 30분으로 치고, 높이는 지어내지 않는다
  const mk = lay([dItem('m', '10:00'), dItem('n', '10:15', '11:00')]);
  ok(byId(mk.out).m.marker === true && byId(mk.out).m.height === MARK_H,
    'an item with no end time is a fixed-height marker, not a block');
  ok(byId(mk.out).m.cols === 2, 'but it still occupies 30 minutes for overlap purposes');
  ok(lay([dItem('m', '10:00'), dItem('n', '10:30', '11:00')]).out.every((o) => o.cols === 1),
    'and exactly 30 minutes — an item starting at the 30-minute mark does not overlap it');

  // ★ 겹침은 시간이 아니라 픽셀로 본다 — BLOCK_MIN_H 로 부푼 블록이 같은 열에서 서로를
  //   덮던 버그. 16시간 축(pxPerHour 하한 40)에서 20분짜리 두 개를 5분 띄워 놓는다.
  const long16 = dItem('z', '08:00', '24:00');
  const shorts = lay([dItem('a', '10:00', '10:20'), dItem('b', '10:25', '10:45'), long16]);
  eq(shorts.r.pxPerHour, HOUR_MIN_H, 'a 16-hour axis sits at the minimum scale');
  eq(byId(shorts.out).a.height, BLOCK_MIN_H, 'a 20-minute block is inflated to the minimum height');
  const sameColOverlap = (out) => out.some((x, i) => out.some((y, j) =>
    j > i && x.col === y.col && x.top < y.top + y.height && y.top < x.top + x.height));
  ok(sameColOverlap(shorts.out) === false,
    'blocks sharing a column never overlap in pixel space',
    'a=' + JSON.stringify(byId(shorts.out).a) + ' b=' + JSON.stringify(byId(shorts.out).b));
  ok(byId(shorts.out).a.col !== byId(shorts.out).b.col,
    'time-wise they do not overlap, but the inflated blocks do — so they get separate columns',
    'a.col=' + byId(shorts.out).a.col + ' b.col=' + byId(shorts.out).b.col);
  // ★ 그래서 판정이 pxPerHour 에 의존한다 — 의도된 동작이다. 같은 두 항목이라도 축이
  //   짧아 배율이 커지면(72px/h) 30px 이 25분밖에 안 돼 다시 한 열에 들어간다.
  const shortsTight = lay([dItem('a', '10:00', '10:20'), dItem('b', '10:25', '10:45')]);
  eq(shortsTight.r.pxPerHour, HOUR_MAX_H, 'the same two items on their own get the maximum scale');
  ok(shortsTight.out.every((o) => o.cols === 1),
    'and at that scale the same two items fit one column — the verdict follows pxPerHour by design',
    'cols=' + shortsTight.out.map((o) => o.cols).join(','));

  // 범위: 정시로 내리고/올리고, 최소 3시간, pxPerHour 상·하한
  ok(dayRange([]) === null, 'a day with no timed items has no axis at all');
  const r1 = dayRange([dItem('a', '09:20', '09:40')]);
  ok(r1.startMin === 540 && r1.endMin === 720 && r1.hours === 3,
    'a short day is floored to the hour and stretched to the 3-hour minimum');
  ok(r1.pxPerHour === HOUR_MAX_H && r1.h === 3 * HOUR_MAX_H, 'a 3-hour axis is capped at the max scale');
  const r24 = dayRange([dItem('a', '00:00', '23:59')]);
  ok(r24.startMin === 0 && r24.endMin === 1440 && r24.pxPerHour === HOUR_MIN_H && r24.h === 24 * HOUR_MIN_H,
    'a full day is floored to the min scale, not squeezed into the target height');
  const r12 = dayRange([dItem('a', '08:00', '20:00')]);
  ok(r12.pxPerHour === 52 && r12.h === 624, 'a 12-hour axis keeps the old 52px-per-hour feel');
  ok(dayRange([dItem('a', '23:30')]).startMin === 1260,
    'a late item pulls the range start back so the axis never runs past midnight');

  // 표시 단계는 개수가 아니라 폭으로 갈린다
  ok(blockTier(T_FULL, TWO_LINE_H) === 'full' && blockTier(T_FULL - 1, TWO_LINE_H) === 'title',
    'the full tier needs the whole time-range label to fit');
  ok(blockTier(T_FULL, TWO_LINE_H - 1) === 'title',
    'a block too short for two lines drops the time label even when it is wide');
  ok(blockTier(T_TITLE, 200) === 'title' && blockTier(T_TITLE - 1, 200) === 'bar',
    'below the two-character title width only the colour bar is left');
  ok(dayColW(360, 2) === 116 && dayColW(390, 2) === 131,
    'the phone column width is arithmetic, not measured');
  // 실기기 폭: 갤럭시가 많이 쓰는 360 은 2열부터 시간 라벨을 버린다. 폰에서 겹치면
  // 제목만 남는 것이 정상 동작이고, 축을 깎아 억지로 넘기지 않는다.
  ok(blockTier(dayColW(360, 2), 100) === 'title' && blockTier(dayColW(360, 5), 100) === 'bar',
    'a 360px phone drops the time label at two columns and keeps only colour at five');
  ok(blockTier(dayColW(412, 2), 100) === 'full',
    'a wider phone still shows the range at two columns');
  ok(blockTier(dayColW(1024, 4), 100) === 'full',
    'the same four columns keep the range on a wide screen — the threshold is px, not count');

  // --- 그려진 결과 ---
  const kDay = { view: state.view, selected: state.selected, items: state.items,
    user: state.user, booting: state.booting };
  state.booting = false;
  state.user = { uid: 'u', name: 'selftest', email: 'a@b.co', role: 'user', status: 'approved' };
  state.view = 'day';
  state.selected = '2026-01-05';
  const drawDay = (list) => { state.items = list; render(); return document.getElementById('app'); };

  let app2 = drawDay([dItem('a', '10:00', '11:00'), dItem('b', '10:30', '11:30')]);
  const blocks = app2.querySelectorAll('[data-block]');
  ok(blocks.length === 2, 'both overlapping items are actually drawn');
  ok(blocks[0].style.left === '0%' && blocks[0].style.width === '50%' &&
     blocks[1].style.left === '50%' && blocks[1].style.width === '50%',
    'two columns are drawn as an even 50% split');
  // ★ style.borderRightWidth 로 보면 안 된다 — var() 를 쓴 단축 속성은 CSSOM 롱핸드가
  //   빈 문자열이다(pending-substitution). 계산값이 곧 그려진 결과다.
  // ★ 그 계산값은 **사용값**이라 브라우저 확대에서 소수로 나온다 — 180% 에서 2px 이
  //   1.11111px 이었다(실제로 밟았다). px 리터럴로 단언하면 확대한 사용자 화면에서 깨진다.
  //   여기서 볼 것은 굵기가 아니라 **구분선이 붙었나 안 붙었나**뿐이다(굵기 2 의 소스는
  //   calendar.js 한 곳이다). 실패 메시지에는 실제 값을 그대로 남긴다.
  const gapPx = (el) => parseFloat(getComputedStyle(el).borderRightWidth);
  const okGap = (el, col, cols, want, msg) => ok(want ? gapPx(el) > 0 : gapPx(el) === 0, msg,
    'col ' + col + '/' + cols + ' borderRightWidth=' + gapPx(el) + ', expected ' + (want ? '> 0' : '0'));
  okGap(blocks[0], 0, 2, true, 'the non-last column carries the separating gap');
  okGap(blocks[1], 1, 2, false, 'the last column carries no gap');
  // ★ 축 높이는 조건이 아니라 **그려진 마지막 눈금**과 맞아야 한다
  const rr = dayRange([dItem('a', '10:00', '11:00'), dItem('b', '10:30', '11:30')]);
  const ticks = app2.querySelectorAll('[data-hr]');
  ok(ticks.length === rr.hours, 'one tick per hour of the range is drawn');
  ok(parseFloat(ticks[ticks.length - 1].style.top) + rr.pxPerHour === rr.h,
    'the last drawn tick plus one hour lands exactly on the axis height');
  ok(app2.querySelectorAll('[data-now]').length === 0,
    'a day that is not today draws no current-time line, even when the clock is inside the range');

  app2 = drawDay([dItem('a', '10:00', '11:00'), dItem('b', '10:30', '11:30'), dItem('c', '10:40', '11:10')]);
  const b3 = app2.querySelectorAll('[data-block]');
  eq(b3[2].style.left, '66.6667%', 'three columns split into exact thirds');
  okGap(b3[0], 0, 3, true, 'the first of three columns carries the gap');
  okGap(b3[1], 1, 3, true, 'the middle column carries the gap too — it is not the last one');
  okGap(b3[2], 2, 3, false, 'only the last of three columns drops the gap');

  // ★ cols === 1 — 겹치지 않는 날. 여기가 검사에 없었다. 화면에 시간 항목이 하나뿐인
  //   보통의 하루가 바로 이 경우이고, 구분선이 붙으면 블록 오른쪽이 카드색으로 깎인다.
  app2 = drawDay([dItem('solo', '07:00', '08:00')]);
  const solo = app2.querySelectorAll('[data-block]');
  eq(solo.length, 1, 'a day with a single timed item draws one block');
  eq(solo[0].style.width, '100%', 'a lone block spans the whole width');
  okGap(solo[0], 0, 1, false, 'a lone column carries no gap — cols === 1 is never split');
  // 붙어 있지만 안 겹치는 두 개도 같은 열이라 cols === 1 이다.
  app2 = drawDay([dItem('x', '09:00', '10:00'), dItem('y', '10:00', '11:00')]);
  const b2s = app2.querySelectorAll('[data-block]');
  okGap(b2s[0], 0, 1, false, 'back-to-back items share one column and neither gets a gap');
  okGap(b2s[1], 0, 1, false, 'including the second one');

  // ★ 짧은 블록은 제목 한 줄만 그리고, 그 한 줄이 블록을 넘지 않는다.
  //   높이는 BLOCK_MIN_H 로 고정인데 글자 높이는 글꼴이 정하므로(line-height 미지정)
  //   폴백 글꼴이면 넘칠 수 있다 — overflow:hidden 이 최후의 방어선이다.
  app2 = drawDay([dItem('a', '10:00', '10:30'), dItem('z', '08:00', '24:00')]);
  const drawn = [...app2.querySelectorAll('[data-block]')];
  const shortEl = drawn.filter((el) => el.getAttribute('data-block') === 'a')[0];
  eq(shortEl.style.height, BLOCK_MIN_H + 'px',
    'a 30-minute block at the minimum scale is drawn at the minimum height');
  eq(shortEl.children.length, 1,
    'and carries the title only — it is too short for the time label');
  eq(getComputedStyle(shortEl).overflow, 'hidden',
    'every block clips its content — text must never escape the block');
  // 넘침 단언. overflow:hidden 이어도 scrollHeight 는 넘치는 콘텐츠를 그대로 보고하므로
  // (확인함: clientHeight 28 에 scrollHeight 50) 잘라 놓고 통과하는 가짜 초록이 아니다.
  drawn.forEach((el) => {
    ok(el.scrollHeight <= el.clientHeight,
      'block "' + el.getAttribute('data-block') + '" does not overflow its own box',
      'scrollHeight=' + el.scrollHeight + ' clientHeight=' + el.clientHeight);
  });

  // 하루 종일만 있는 날 / 아무것도 없는 날 — 시간축을 아예 그리지 않는다
  app2 = drawDay([{ id: 'z', title: '휴가', date: '2026-01-05', time: '', endTime: '',
    pri: 'none', repeat: 'none', days: [], memo: '' }]);
  ok(app2.querySelectorAll('[data-hr]').length === 0 && app2.querySelectorAll('[data-block]').length === 0,
    'a day with only all-day items draws no axis');
  ok(app2.innerHTML.indexOf(t('day.noTimed')) > 0 && app2.innerHTML.indexOf('휴가') > 0,
    'the all-day band and the empty-axis message are both there');
  app2 = drawDay([]);
  ok(app2.querySelectorAll('[data-hr]').length === 0 && app2.innerHTML.indexOf(t('day.noTimed')) > 0,
    'an empty day draws the message and nothing else');

  // ★ endTime 이 없는 옛 항목의 표시는 한 글자도 안 바뀐다
  app2 = drawDay([dItem('old', '09:00')]);
  const marker = app2.querySelector('[data-block]');
  ok(marker.style.height === MARK_H + 'px' && marker.textContent === 'old',
    'an item with no end time draws as a marker carrying just its title');
  ok(timeRange('09:00', '') === timeLabel('09:00'),
    'and its label is byte-identical to the start-only label it has always had');

  // --- 카테고리 + 필터: 조건 함수가 아니라 **그려진 화면**을 본다 ---
  // ★ 이 기능의 핵심 약속은 "카테고리를 지워도 할 일은 안 지워진다" 하나다.
  //   죽은 id 를 '없음' 으로 떨어뜨리는 폴백이 그 약속을 지키는 유일한 장치이고,
  //   삭제는 되돌릴 수 없으니 사람 눈이 아니라 여기서 묶어 둔다.
  //   위 kDay 블록이 이미 booting=false + 가짜 user + selected='2026-01-05' 를 세워 뒀다.
  const kCat = { cats: state.cats, filter: state.filter,
    showCats: state.showCats, catDraft: state.catDraft };
  const cItem = (id, cid) => ({ id: id, title: id, date: '2026-01-05', time: '',
    categoryId: cid, repeat: 'none', days: [], memo: '' });
  const four = () => [cItem('work', 'c1'), cItem('run', 'c2'), cItem('bare', ''), cItem('dead', 'GONE')];
  const drawCat = (list) => { state.items = list; render(); return document.getElementById('app'); };
  const titles = (el) => [...el.querySelectorAll('.row-title')].map((x) => x.textContent);
  const chips = (el) => [...el.querySelectorAll('[data-filter]')];

  state.cats = [{ id: 'c1', name: '업무', color: '#007AFF' },
                { id: 'c2', name: '운동', color: '#34C759' }];
  state.filter = null;
  state.view = 'month';
  state.showCats = false;
  state.catDraft = null;
  let app3 = drawCat(four());

  eq(catOf({ categoryId: 'GONE' }).color, CAT_NONE.color,
    'an item pointing at a deleted category falls back to the none colour');
  eq(catOf({ categoryId: '' }).color, CAT_NONE.color, 'so does an item with no category at all');
  eq(catOf({ categoryId: 'c1' }).color, '#007AFF', 'a live category keeps its own colour');
  eq(titles(app3).length, 4, 'all four items are drawn — a dead category id hides nothing');

  // 칩은 '전체' + 카테고리 2개 = 3개. state.cats.length 로 적으면 항등식이 된다.
  eq(chips(app3).length, 3, 'the filter row draws All plus one chip per category');
  eq(chips(app3)[0].dataset.filter, '', 'the first chip is All and carries an empty filter value');

  state.filter = 'c1';
  eq(titles(drawCat(four())).join(), 'work',
    'a category filter narrows the drawn list to that category');
  // 아무 항목도 안 쓰는 id 로 필터가 걸리면 **아무것도** 안 그려야 한다. 전부
  // 그리면 필터가 조용히 무시된 것이고, 그건 필터가 없는 것과 구분이 안 된다.
  // ('GONE' 을 쓰면 안 된다 — 위 픽스처에 그 id 를 가진 항목이 실제로 있다.)
  state.filter = 'NOBODY';
  eq(titles(drawCat(four())).length, 0,
    'filtering by an id no item carries draws nothing rather than everything');
  state.filter = null;

  // 카테고리가 0개면 줄 자체를 안 그린다 — '전체' 칩만 있는 줄은 정보가 0이다.
  state.cats = [];
  eq(chips(drawCat(four())).length, 0, 'with no categories the filter row is not drawn at all');

  // ★ 긴 이름은 **찌부러지지 말고 넘쳐야** 한다. .seg-wrap 이 flex 라 칩은 기본으로
  //   줄어드는데, 그러면 이름이 두 줄로 접혀 height:32px 에 잘리고(폰에서 실제로
  //   그랬다) 다 찌부러져 들어가니 옆으로 밀 것도 안 남는다.
  //   창 폭에 안 기대려고 상한 개수 × 상한 길이로 채운다 — 창이 이보다 넓으면
  //   애초에 안 줄어들어 검사가 헛돌지만(4K), 폰·노트북 폭에서는 확실히 걸린다.
  state.cats = CAT_COLORS.map((c, i) => ({ id: 'w' + i, color: c,
    name: '가나다라마바사아자차카타파하거너더러'.slice(0, CAT_NAME_MAX - 1) + i }));
  const wideRow = [...drawCat([]).querySelectorAll('.seg-wrap')].find((w) => w.querySelector('[data-filter]'));
  const wide = [...wideRow.querySelectorAll('[data-filter]')];
  // ★ 넘치는 축은 **세로**다. 접힌 글자는 옆으로 안 새고 height:32px 아래로 새므로
  //   scrollWidth 를 보면 두 줄로 접혀도 통과한다(실제로 여기서 한 번 헛돌았다).
  ok(wide.every((c) => c.scrollHeight <= c.clientHeight),
    'a long category name never overflows its own chip',
    'worst=' + Math.max.apply(null, wide.map((c) => c.scrollHeight - c.clientHeight)));
  // 찌부러졌는지 = 제 이름이 요구하는 폭보다 좁게 그려졌는지. 창 크기에 안 기대려고
  // 같은 칩을 떼어내 자연 폭을 재서 비교한다 — 큰 모니터에서도 판정이 같다.
  const natW = (c) => {
    const n = c.cloneNode(true);
    n.style.position = 'absolute'; n.style.left = '-9999px'; n.style.width = 'max-content';
    document.body.appendChild(n);
    const w = n.getBoundingClientRect().width;
    n.remove();
    return w;
  };
  ok(wide.every((c) => c.getBoundingClientRect().width >= natW(c) - 1),
    'and no chip is squeezed below the width its label needs — the row overflows instead, so it can be swiped',
    'worst=' + Math.max.apply(null, wide.map((c) => natW(c) - c.getBoundingClientRect().width)));

  // --- 카테고리 시트 ---
  state.cats = [{ id: 'c1', name: '업무', color: '#007AFF' }];
  state.showCats = true;
  let app4 = drawCat([]);
  eq(app4.querySelectorAll('[data-catedit]').length, 1, 'the sheet lists one row per category');
  ok(!!app4.querySelector('[data-act="catNew"]'), 'and offers the add button below it');

  // 편집기. 저장 가능 여부는 catOk() 가 정하지만, 검사는 **그려진 버튼**을 본다 —
  // 조건만 맞고 버튼이 안 따라오던 갤럭시 버그가 우선순위 시절에 실제로 있었다.
  state.catDraft = { id: '', name: '', color: CAT_COLORS[0] };
  app4 = drawCat([]);
  eq(app4.querySelectorAll('[data-catcolor]').length, 10,
    'the editor offers exactly the ten palette colours — there is no free colour input');
  ok(document.getElementById('catSaveBtn').disabled, 'an empty name cannot be saved');
  eq(app4.querySelector('[data-cn]').getBoundingClientRect().height, refFieldH,
    'the name field is the same height as the other input fields — .field on its own has no padding');
  // 여기부터는 render() 를 부르지 않는다 — 이름 칸이 uncontrolled 라 입력 위임이
  // syncCatSheet() 로 DOM 만 맞추는 경로를 그대로 탄다.
  state.catDraft.name = '업무';
  syncCatSheet();
  ok(document.getElementById('catSaveBtn').disabled, 'a duplicate name cannot be saved either');
  ok(!document.getElementById('catDupe').hidden,
    'and the duplicate hint appears without a full re-render');
  state.catDraft.name = '공부';
  syncCatSheet();
  ok(!document.getElementById('catSaveBtn').disabled, 'a fresh name enables the button');
  ok(document.getElementById('catDupe').hidden, 'and clears the hint — again without a re-render');

  // 상한. 규칙으로는 못 세니 화면이 유일한 방어선이다.
  state.catDraft = null;
  state.cats = CAT_COLORS.map((c, i) => ({ id: 'k' + i, name: 'c' + i, color: c }));
  app4 = drawCat([]);
  ok(!app4.querySelector('[data-act="catNew"]'), 'at the palette limit the add button is gone');
  ok(app4.innerHTML.indexOf(esc(t('cat.max', CAT_MAX))) > 0,
    'and the limit is spelled out in its place');

  // ★ 삭제. fb 는 firebase.js(모듈)가 아직 안 떠서 undefined 다 — 쓰기만 흉내내고
  //   원래대로 돌려놓는다. confirm 도 같이 갈아 두고 문구까지 확인한다.
  const kFb = window.fb, kConfirm = window.confirm;
  let asked = '';
  window.fb = { removeCat: () => Promise.resolve(), fail: () => {} };
  window.confirm = (m) => { asked = m; return true; };
  state.cats = [{ id: 'c1', name: '업무', color: '#007AFF' }];
  state.items = [cItem('work', 'c1'), cItem('bare', '')];
  state.filter = 'c1';
  state.showCats = true;
  state.catDraft = { id: 'c1', name: '업무', color: '#007AFF' };
  delCat();
  window.fb = kFb;
  window.confirm = kConfirm;
  eq(state.items.length, 2, 'deleting a category does not delete the to-dos that used it');
  eq(state.cats.length, 0, 'the category document itself is the only thing removed');
  eq(state.filter, null, 'and the filter that was showing it falls back to All');
  eq(catOf(state.items[0]).color, CAT_NONE.color,
    'the orphaned item draws in the none colour from then on');
  ok(asked.indexOf('1') >= 0,
    'the confirmation names how many to-dos are affected', JSON.stringify(asked));

  // --- 목표 + 연간 뷰: 조건 함수가 아니라 **그려진 화면**을 본다 ---
  // ★ 이 기능의 약속은 둘이다 —
  //   1) 연간 뷰에는 **목표만** 나온다. 일일 할 일이 새면 365일치가 한 화면에 쏟아진다.
  //   2) 12칸 요약은 **그 달 목표만** 센다. 할 일이 섞이면 숫자가 조용히 부풀어
  //      "이번 달 목표 40개" 처럼 읽히고, 화면만 봐서는 틀린 줄을 모른다.
  //   반대 방향(목표가 월·주·일 달력으로 새는 것)도 같이 막는다 — occursOn 의
  //   '한 항목 = 한 날' 전제가 목표에는 성립하지 않아서 365일 전부에 뜬다.
  //
  // ★ showCats 를 여기서 끈다. 위 카테고리 블록이 시트를 연 채로 끝나서(delCat 은
  //   catDraft 만 지운다) 그냥 두면 아래 sheetBusy() 단언이 항상 참이 된다.
  const kGoal = { goals: state.goals, goalDraft: state.goalDraft,
    showCats: state.showCats, cy: state.cy, cm: state.cm };
  state.showCats = false;
  state.goalDraft = null;

  const G = (id, scope, m, d, cid, done) => ({ id: id, title: id, scope: scope, y: 2026,
    m: m, d: d, categoryId: cid || '', memo: '', done: !!done });
  state.cats = [{ id: 'c1', name: '업무', color: '#007AFF' }];
  state.filter = null;
  state.cy = 2026; state.cm = 0;
  state.goals = [
    G('year1', 'year', null, null, ''),     // 기한 없음 → 맨 뒤
    G('jun20', 'month', 5, 20, 'c1'),       // 6/20
    G('jun', 'month', 5, null, ''),         // 6월 (날짜 없음) → 같은 달에선 뒤
    G('mar', 'month', 2, null, ''),         // 3월
    Object.assign(G('old', 'year', null, null, ''), { y: 2025 })   // 다른 해 → 안 나온다
  ];
  // 1월(state.cm)에 할 일 일곱 개. 12칸 요약이 이걸 세면 안 된다.
  state.items = [1, 2, 3, 4, 5, 6, 7].map((n) => cItem('t' + n, ''));   // 전부 2026-01-05
  state.view = 'year';
  render();
  let app5 = document.getElementById('app');
  const gTitles = (el) => [...el.querySelectorAll('[data-goal] .row-title')].map((x) => x.textContent);
  // 칸 글자에서 월 이름을 걷어내면 개수 부분만 남는다 — 로케일을 안 타는 비교다.
  const ymCount = (el, i) =>
    el.querySelector('[data-ym="' + i + '"]').textContent.replace(monthShort(i), '');

  eq(gTitles(app5).join(), 'mar,jun20,jun,year1',
    'goals sort by deadline, a dated one beats a month-only one, and no-deadline goes last');
  eq(app5.querySelectorAll('[data-toggle]').length, 0,
    'the year view draws no daily to-dos at all, however many the month holds');
  eq(ymCount(app5, 5), t('goal.count', 2), 'the month summary counts that month\'s goals');
  ok(!/\d/.test(ymCount(app5, 0)),
    'and counts no to-dos — a month with seven to-dos and no goals shows no number',
    JSON.stringify(ymCount(app5, 0)));

  // 목표는 달력 세 뷰 어디에도 안 샌다.
  ['month', 'week', 'day'].forEach((v) => {
    state.view = v;
    render();
    const el = document.getElementById('app');
    ok(el.querySelectorAll('[data-goal]').length === 0 && el.innerHTML.indexOf('jun20') < 0,
      'a goal never appears in the ' + v + ' view — it is a period, not a date');
  });

  // 필터는 목록과 12칸 요약에 **같이** 걸린다. 한쪽만 걸리면 개수와 목록이 어긋난다.
  state.view = 'year'; state.filter = 'c1';
  render();
  app5 = document.getElementById('app');
  eq(gTitles(app5).join(), 'jun20', 'a category filter narrows the goal list');
  eq(ymCount(app5, 5), t('goal.count', 1),
    'and the summary follows the same filter instead of counting on its own');
  state.filter = null;

  // 하단 캡슐 바. 헤더에 있던 사본이 남아 있으면 같은 탭이 두 벌 그려진다.
  state.view = 'month'; render();
  app5 = document.getElementById('app');
  let bar = app5.querySelector('.tabbar');
  eq([...bar.querySelectorAll('[data-view]')].map((b) => b.dataset.view).join(), 'year,month,week,day',
    'the bottom bar carries the four views, year first');
  eq(app5.querySelectorAll('[data-view]').length, 4,
    'and they exist exactly once — the header copy is gone');
  ok(!bar.querySelector('[data-act]'),
    'the + sits outside the capsule, not inside it as a fifth tab');
  eq(bar.querySelectorAll('.seg > [aria-hidden="true"] svg').length, 4,
    'every tab carries an icon, and it is hidden from screen readers so the label is not read twice');
  // ★ 명시도 함정. `.seg-on`(0,1,0) 은 `.tabbar .seg`(0,2,0) 의 투명 배경을 못 이긴다 —
  //   `.tabbar` 를 안 붙이면 **고른 탭의 tint 판이 조용히 사라지고** 넷이 똑같아 보인다.
  //   색을 리터럴로 적지 않는다(테마·색 토큰이 바뀌면 낡는다). 다른지만 본다.
  // 판은 버튼 배경이 아니라 ::before 다 — 애니메이션이 아이콘·글자를 안 건드리게 하려고
  // 뺐다(style.css). 버튼 쪽 backgroundColor 를 보면 둘 다 투명이라 항상 통과한다.
  const onBg = getComputedStyle(bar.querySelector('.seg-on'), '::before').backgroundColor;
  const offBg = getComputedStyle([...bar.querySelectorAll('.seg')]
    .find((s) => !s.classList.contains('seg-on')), '::before').backgroundColor;
  ok(onBg !== offBg, 'the selected tab is filled and the others are not', onBg + ' vs ' + offBg);
  ok(/(, *0\)|\/ *0\))/.test(offBg) || offBg === 'transparent',
    'an unselected tab has no chip behind it at all', offBg);
  // 고른 탭의 판은 바깥 캡슐과 **동심**이어야 곡률이 이어져 보인다:
  //   바깥 반지름 − 캡슐 세로 패딩 == 안쪽 반지름.
  // ★ px 리터럴로 적지 않는다 — 브라우저 확대에서 셋이 같은 비율로 소수가 되므로
  //   **등식**은 살아 있지만 숫자는 달라진다(CLAUDE.md). 관심사는 관계 하나다.
  //   getComputedStyle 은 선언값(999px)을 주므로 CSS 명세의 축소 규칙을 적용해 쓴 값을 낸다.
  const usedR = (el) => {
    const r = el.getBoundingClientRect();
    const d = parseFloat(getComputedStyle(el).borderTopLeftRadius);
    return Math.min(d, d * Math.min(r.width / (d * 2), r.height / (d * 2)));
  };
  const padY = parseFloat(getComputedStyle(bar).paddingTop);
  ok(Math.abs((usedR(bar) - padY) - usedR(bar.querySelector('.seg-on'))) < 0.6,
    'the selected tab\'s pill is concentric with the capsule around it',
    'outer ' + usedR(bar).toFixed(2) + ' - pad ' + padY + ' vs inner ' +
      usedR(bar.querySelector('.seg-on')).toFixed(2));
  // 아이콘을 눌러도 탭이 먹혀야 한다 — 위임이 closest() 라 SVG 자식에서도 올라온다.
  bar.querySelector('[data-view="week"] svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  eq(state.view, 'week', 'tapping the icon inside a tab switches the view, not just the label');

  // ★ 애니메이션은 뷰가 **실제로 바뀐** 렌더에만 붙는다(calendar.js 의 lastView).
  //   이 가드가 빠지면 할 일 하나 체크할 때마다(=render()) 본문이 통째로 다시 튀어
  //   오른다 — 기능은 멀쩡한데 쓸 수 없는 앱이 된다. 조건식이 아니라 **그려진
  //   클래스**를 본다. 감싸는 div 자체는 늘 있고, 클래스만 붙었다 말았다 한다.
  state.view = 'day'; render();
  ok(!!document.querySelector('.view-in') && !!document.querySelector('.tabbar-anim'),
    'switching views animates the body and the tab pill');
  render();
  ok(!document.querySelector('.view-in') && !document.querySelector('.tabbar-anim'),
    're-rendering the same view does not — otherwise every checkbox tap would flash the screen');

  state.view = 'month'; render();
  app5 = document.getElementById('app');
  bar = app5.querySelector('.tabbar');
  eq(bar.parentElement.querySelector('.btn').dataset.act, 'open',
    'in a calendar view the + adds a to-do');
  state.view = 'year'; render();
  eq(document.getElementById('app').querySelector('.tabbar').parentElement.querySelector('.btn').dataset.act,
    'goalNew', 'in the year view it adds a goal — a to-do there would have no date to land on');

  // ★ 규칙(validGoal)이 hasOnly 를 보므로 여덟 키가 **정확히** 나가야 한다. 하나라도
  //   빠지거나 늘면 저장이 통째로 거부되는데, 낙관적 업데이트가 화면에는 이미
  //   그려 놔서 새로고침 전까지 아무도 모른다.
  const kFb2 = window.fb;
  let sent = null;
  window.fb = { newGoalId: () => 'NEW', saveGoal: (id, d) => { sent = d; return Promise.resolve(); },
    removeGoal: () => Promise.resolve(), setGoalDone: () => Promise.resolve(), fail: () => {} };
  openGoal(null);
  ok(sheetBusy(), 'an open goal sheet defers remote snapshot renders like every other sheet');
  ok(document.getElementById('goalSaveBtn').disabled, 'an empty title cannot be saved');
  state.goalDraft.title = '달리기';
  syncGoalSheet();
  ok(!document.getElementById('goalSaveBtn').disabled,
    'a title enables the button without a full re-render');
  Object.assign(state.goalDraft, { title: '  달리기  ', scope: 'month', m: 1, hasDay: true, d: 31 });
  saveGoalDraft();
  eq(Object.keys(sent).sort().join(), 'categoryId,d,done,m,memo,scope,title,y',
    'a saved goal carries exactly the eight keys the security rule allows');
  eq(sent.d, 28, 'the day is clamped to that month\'s last day — February never gets a 31st');
  eq(sent.title, '달리기', 'and the title is trimmed before it is stored');
  ok(!sheetBusy(), 'saving closes the sheet');

  // 편집이 완료 상태를 잃으면, 제목 한 글자 고쳤다고 체크가 풀린다.
  state.goals = [G('done1', 'year', null, null, '', true)];
  openGoal('done1');
  state.goalDraft.title = '고침';
  saveGoalDraft();
  eq(sent.done, true, 'editing a completed goal keeps it completed');
  window.fb = kFb2;

  // 첫 화면 설정. 값 집합은 firestore.rules 의 validSettings() 와 같아야 한다.
  const kView = SETTINGS.view;
  setSettings({ view: 'decade' });
  eq(SETTINGS.view, kView, 'an unknown first-screen value is refused rather than stored');
  ok(!adoptSettings({ theme: SETTINGS.theme, lang: SETTINGS.lang }),
    'remote settings with no view read as incomplete, so an old account gets promoted once');
  setSettings({ view: kView });

  // ------------------------------------------------------- 기간 일정 (그려진 화면)
  // ★ weekBars/laneBars 의 좌표는 위에서 이미 봤다. 여기서 보는 것은 "그 좌표가
  //   실제로 그렇게 그려지는가" 다 — 조건 함수가 아니라 DOM 을 읽는다.
  const kSpan = { view: state.view, items: state.items, cats: state.cats, cy: state.cy,
    cm: state.cm, selected: state.selected, filter: state.filter, kind: state.kind };
  const EV = (o) => Object.assign({ kind: 'event', span: 1, title: 'E', date: '2026-08-05',
    time: '', endTime: '', categoryId: 'c1', repeat: 'none', days: [], memo: '',
    done: false, doneDates: [] }, o);
  const APP = () => document.getElementById('app');
  state.cats = [{ id: 'c1', name: '업무', color: '#FF3B30' }];
  state.cy = 2026; state.cm = 7; state.selected = '2026-08-13';
  state.filter = null; state.kind = null; state.view = 'month';

  // 일정이 하나도 없으면 예전 격자 그대로다 — 막대 층도, 그 자리도 안 생긴다.
  state.items = [EV({ id: 'p', kind: 'todo', title: '할일' })];
  render();
  eq(APP().querySelectorAll('[data-bars]').length, 0, 'a month with no events draws no bar layer');
  eq(APP().querySelectorAll('[data-barspace]').length, 0,
    'and reserves no room for one — the grid is exactly the height it always was');

  // 5일짜리(수~일)는 토요일에서 잘려 두 조각이 된다. 한 조각으로 그리면 그 줄이
  // 다음 주까지 늘어져 격자를 뚫는다.
  state.items = [EV({ id: 'v', span: 5, title: '휴가' })];
  render();
  eq([...APP().querySelectorAll('[data-bars] .pill')]
      .map((b) => (b.getAttribute('style').match(/grid-column:([^;]+)/) || [])[1]).join(' | '),
    '4/8 | 1/2', 'an event crossing Saturday is drawn as two pieces, one per week');
  // ★ px 리터럴로 안 적는다. 막대 층의 시작 y 를 35.5 로 **적었다가** dpr 1 에서 실제
  //   36 이라 0.5px 어긋난 적이 있다(.5px 테두리 반올림). 지금은 같은 모양의 빈 칸이
  //   그 높이를 만들므로, 볼 것은 숫자가 아니라 "둘이 같은 자리에서 시작하는가" 다.
  const bRect = APP().querySelector('[data-bars] .pill').getBoundingClientRect();
  const sRect = APP().querySelector('[data-day="2026-08-05"] [data-barspace]').getBoundingClientRect();
  ok(Math.abs(bRect.top - sRect.top) < 0.05,
    'the bar layer starts exactly where the cell reserved room for it',
    bRect.top + ' vs ' + sRect.top);
  ok(bRect.bottom <= sRect.bottom + 0.05, 'and never spills onto the pills underneath');
  const spH = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    APP().querySelector('[data-day="' + addDays('2026-08-02', i) + '"] [data-barspace]')
      .getBoundingClientRect().height);
  ok(spH.every((h) => Math.abs(h - spH[0]) < 0.05),
    'every cell of that week reserves the same height, so the pill rows stay level');

  // 하루짜리 일정은 판 없이 글자만. ★ 기준이 "이 주에서 한 칸" 이 아니라 "회차가
  //   하루" 다 — 이틀짜리가 토/일로 갈리면 각 주에서 한 칸이지만 아직 안 끝났으므로
  //   판이 남아야 한다. 이걸 `from === to` 로 적으면 그 막대가 조용히 글자만 된다.
  const bgOf = (sel) => getComputedStyle(APP().querySelector(sel)).backgroundColor;
  const clear = (v) => /(, *0\)|\/ *0\))/.test(v) || v === 'transparent';
  state.items = [EV({ id: 'one', span: 1, title: '회의' })];
  render();
  ok(clear(bgOf('[data-bars] .pill')), 'a one-day event is drawn as bare text, with no chip behind it',
    bgOf('[data-bars] .pill'));
  state.items = [EV({ id: 'two', span: 2, title: '연수', date: '2026-08-08' })];   // 토→일
  render();
  eq(APP().querySelectorAll('[data-bars] .pill').length, 2,
    'a two-day event across Saturday becomes one piece per week');
  ok([...APP().querySelectorAll('[data-bars] .pill')].every((b) => !clear(getComputedStyle(b).backgroundColor)),
    'and both halves keep their chip — each covers one column, but the event is not over');

  // 일정을 할 일과 갈라 보이게 하는 것: 여러 날은 **원색 판**, 하루짜리는 **색 점**.
  // 할 일 알약은 같은 색의 16% 틴트 + 색 글자 그대로다.
  // ★ onColor 의 조건식(L > 0.179)을 기댓값으로 옮겨 적지 않는다 — 여기서 세는 것은
  //   WCAG 대비비고, 그건 onColor 가 어떤 규칙을 쓰든 독립적으로 성립해야 할 성질이다.
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  };
  const ratio = (bg, fg) => {
    const a = lum(bg) + 0.05, b = lum(fg) + 0.05;
    return a > b ? a / b : b / a;
  };
  const worst = CAT_COLORS.concat([CAT_NONE.color])
    .map((c) => ({ c: c, r: ratio(c, onColor(c)) })).sort((a, b) => a.r - b.r)[0];
  ok(worst.r >= 4.5, 'the label onColor() picks is readable on every category colour',
    worst.c + ' → ' + onColor(worst.c) + ' = ' + worst.r.toFixed(2) + ':1');
  // 흰색으로 고정했다면 어땠는지 — 이 검사가 onColor 의 존재 이유다.
  ok(CAT_COLORS.some((c) => ratio(c, '#FFFFFF') < 3),
    'a fixed white label would have been unreadable on the light half of the palette',
    CAT_COLORS.map((c) => ratio(c, '#FFFFFF').toFixed(1)).join(' '));

  state.items = [EV({ id: 'many', span: 3, title: '휴가', date: '2026-08-03' }),
    EV({ id: 'oneday', span: 1, title: '회의', date: '2026-08-19' })];
  render();
  const allBars = [...APP().querySelectorAll('[data-bars] .pill')];
  const multi = allBars.find((b) => b.textContent.indexOf('휴가') >= 0);
  const single = allBars.find((b) => b.textContent.indexOf('회의') >= 0);
  ok(!clear(getComputedStyle(multi).backgroundColor)
    && getComputedStyle(multi).color !== getComputedStyle(single).color,
    'a multi-day event fills its bar and flips the text colour — a to-do pill never does');
  ok(clear(getComputedStyle(single).backgroundColor) && !!single.querySelector('span'),
    'a one-day event keeps its bare text but gains a dot, so “dark colour = event” holds for both');

  // 칸은 할 일만, 막대는 일정만. 한 항목이 알약과 막대로 두 번 나오면 안 된다.
  state.items = [EV({ id: 'v', span: 5, title: '휴가' }), EV({ id: 'td', kind: 'todo', title: '할일' })];
  render();
  eq([...APP().querySelectorAll('[data-day="2026-08-05"] .pill')].map((p) => p.textContent).join(),
    '할일', 'a day cell lists to-dos only — the event is the bar above, not a second pill');

  // 층 상한을 넘긴 막대는 **조용히 사라지지 않는다** — 그 날의 `+N개` 로 넘어간다.
  state.items = [0, 1, 2, 3].map((i) => EV({ id: 'x' + i, span: 3, title: 'E' + i }));
  render();
  eq(APP().querySelectorAll('[data-bars] .pill').length, MONTH_LANES,
    'a week draws at most MONTH_LANES rows of bars however many overlap');
  ok(APP().querySelector('[data-day="2026-08-05"]').textContent.indexOf(t('cell.more', 1)) >= 0,
    'and the one that did not fit is counted in that day\'s +N instead of vanishing');

  // 종류 필터. 값은 지우지 않고 일간·연간에서만 무시한다(kindFilter).
  state.items = [EV({ id: 'v', span: 3, title: '휴가' }), EV({ id: 'td', kind: 'todo', title: '할일' })];
  state.kind = 'todo'; render();
  eq(APP().querySelectorAll('[data-bars]').length, 0, 'showing only to-dos hides the bar layer');
  ok(APP().querySelector('[data-day="2026-08-05"]').textContent.indexOf('할일') >= 0,
    'and keeps the pills');
  state.kind = 'event'; render();
  eq(APP().querySelectorAll('[data-day="2026-08-05"] .pill').length, 0,
    'showing only events empties the cells');
  ok(APP().querySelectorAll('[data-bars] .pill').length > 0, 'and leaves the bars standing');
  state.view = 'day'; render();
  eq(APP().querySelectorAll('[data-kind]').length, 0, 'the kind row is not drawn in the day view');
  eq(itemsOn(state.items, '2026-08-05', true).length, 2,
    'and that view shows both kinds even while the filter still says events only');
  state.kind = null;

  // 주간: 막대 띠는 요일 줄 **아래**, 칸 **위**의 별도 줄이다.
  state.view = 'week'; state.selected = '2026-08-05'; render();
  const wBand = APP().querySelector('[data-bars]');
  ok(wBand.getBoundingClientRect().top >=
      APP().querySelector('[data-day="2026-08-05"]').getBoundingClientRect().bottom - 0.5,
    'the week bar band sits below the weekday header row, not on top of it');

  // 주간 칸에는 시간을 아예 안 적는다. 46.6px 열에서 '하루 종일' 이 두 줄로 접혀
  // 자리를 두 배 먹었고, 그 줄이 준 정보만큼 갚지 못했다(사용자 요청).
  // 한 줄이 되면서 접기 기준을 5 → WEEK_FIT 로 다시 쟀다.
  state.items = Array.from({ length: WEEK_FIT + 1 }, (_, i) => ({ id: 'w' + i, kind: 'todo',
    span: 1, title: '항목' + i, date: '2026-08-05', time: '07:00', endTime: '08:00',
    categoryId: 'c1', repeat: 'none', days: [], memo: '', done: false, doneDates: [] }));
  render();
  const wcard = APP().querySelector('[data-day="2026-08-05"]').closest('.card');
  const wcol = [...wcard.querySelectorAll('[data-open]')];
  eq(wcol.length, WEEK_FIT, 'a week column folds at WEEK_FIT items');
  ok(wcard.textContent.indexOf(timeLabel('07:00')) < 0 && wcard.textContent.indexOf(t('item.allDay')) < 0,
    'and no cell prints a time — the week grid shows titles only now');
  ok(wcard.textContent.indexOf(t('cell.more', 1)) >= 0,
    'the one that did not fit is counted, not dropped');

  // 일간: 첫날은 시작 시각 마커, 마지막 날은 종료 시각 마커, 가운데는 하루 종일.
  const trip = EV({ id: 'trip', span: 3, title: '출장', date: '2026-08-13', time: '09:00', endTime: '18:00' });
  eq(dayShape(trip, '2026-08-13').endTime, '',
    'on its first day a multi-day event has no end — a marker, not a block with an invented length');
  eq(dayShape(trip, '2026-08-14').time, '', 'in the middle it is all-day');
  eq(dayShape(trip, '2026-08-15').time, '18:00', 'and on the last day it sits at the end time');
  eq(dayShape(EV({ span: 1, time: '09:00', endTime: '10:00' }), '2026-08-05').endTime, '10:00',
    'a one-day event is handed back untouched');
  eq(dayShape(Object.assign(EV({ span: 3, time: '09:00', endTime: '18:00' }), { kind: 'todo' }),
    '2026-08-06').endTime, '18:00',
    'and a to-do is never reshaped however long its span field claims');

  // 하단 목록: 일정에는 체크가 없고, 남은 개수도 일정을 안 센다.
  state.view = 'month'; state.selected = '2026-08-14';
  state.items = [trip, EV({ id: 'td', kind: 'todo', title: '할일', date: '2026-08-14' })];
  render();
  eq(APP().querySelectorAll('[data-toggle]').length, 1,
    'an event gets no completion circle — only the to-do can be checked');
  ok([...APP().querySelectorAll('[data-open="trip"]')].every((e) => e.dataset.ds === '2026-08-13'),
    'tapping the middle of a span opens the occurrence start, not the day that was tapped');
  state.items = [trip];
  render();
  ok(APP().innerHTML.indexOf(t('list.remain', 1)) < 0 && APP().innerHTML.indexOf(t('list.allDone')) < 0,
    'a day holding only events shows no remaining count — an event can never be finished');

  // 입력 시트의 판정. 저장 버튼·안내·saveForm 이 전부 이 둘만 본다.
  const F = (o) => Object.assign(blankForm('2026-08-05'), o);
  eq(formSpan(F({ kind: 'event', hasSpan: true, endDate: '2026-08-09' })), 5,
    'five calendar days inclusive is a span of five');
  eq(formSpan(F({ kind: 'todo', hasSpan: true, endDate: '2026-08-09' })), 1,
    'a to-do stays one day whatever the sheet still remembers');
  ok(!spanOk(F({ kind: 'event', hasSpan: true, endDate: '2026-08-04' })),
    'an end before the start cannot be saved');
  ok(!spanOk(F({ kind: 'event', hasSpan: true, endDate: '' })),
    'and neither can a cleared end date');
  ok(!spanOk(F({ kind: 'event', hasSpan: true, endDate: '2026-08-13', repeat: 'weekly', days: [3] })),
    'a nine-day weekly event would overlap its own next occurrence');
  ok(spanOk(F({ kind: 'event', hasSpan: true, endDate: '2026-08-11', repeat: 'weekly', days: [3] })),
    'seven days is exactly the weekly gap and still fits');
  ok(!endOk(F({ hasTime: true, time: '09:00', end: '08:00' })),
    'a one-day item may not end before it starts');
  ok(endOk(F({ kind: 'event', hasSpan: true, endDate: '2026-08-07', hasTime: true, time: '09:00', end: '08:00' })),
    'but a span may — that end time lands on the last day, not the first');

  // 내보내기 레이아웃. 막대가 없으면 예전 이미지와 한 픽셀도 안 달라야 한다.
  const exA = exMonthLayout(2026, 7, true);
  eq(exMonthLayout(2026, 7, true, [0, 0, 0, 0, 0, 0]).h, exA.h,
    'a month export with no bars is the exact size it always was');
  eq(exMonthLayout(2026, 7, true, [1, 2, 0, 0, 0, 0]).h - exA.h, 3 * M_BAR_ROW,
    'and grows by one bar row per lane, summed over every week');
  const exC = exMonthLayout(2026, 7, true, [1, 0, 0, 0, 0, 0]);
  eq(exC.rowY[1] - exC.rowY[0], M_ROW + M_BAR_ROW,
    'the second week starts below the first week\'s bars — the rows stack, they are not multiplied');
  // 이미지의 상세 줄이 일정과 할 일을 갈라 놓는가. ★ 실기기 이미지를 보고 나온 지적이다 —
  // 화면 아래 목록은 동그라미/네모로 가르는데 이미지에는 그 단서가 통째로 없었다.
  const exTrip = EV({ id: 'x', span: 4, title: '출장', date: '2026-08-13' });
  const rowEv = exRow(exTrip, '2026-08-14', false);
  const rowTd = exRow({ id: 'y', kind: 'todo', span: 1, title: '할일', date: '2026-08-14',
    time: '', endTime: '', categoryId: 'c1', repeat: 'none', days: [], memo: '' }, '2026-08-14', false);
  ok(rowEv.evt && !rowTd.evt, 'an exported row now says which kind it is');
  eq(rowEv.time, monthDay(parse('2026-08-13')) + ' – ' + monthDay(parse('2026-08-16')),
    'a spanning event prints its period, not “all day” repeated once per covered day');
  eq(rowTd.time, t('item.allDay'), 'and a to-do is untouched');
  eq(exRow(EV({ id: 'z', span: 1, title: '회의' }), '2026-08-05', false).time, t('item.allDay'),
    'a one-day event keeps the plain label — its square marker is what tells it apart');

  const wA = exWeekLayout(3, true), wB = exWeekLayout(3, true, 2);
  eq(exWeekLayout(3, true, 0).h, wA.h, 'the week export is untouched when there are no bars');
  eq(wB.bodyTop - wA.bodyTop, wB.barH, 'and its columns start below the bar band');

  // --- 로그인 화면은 스스로 다시 그려지면 안 된다 ---
  // 폰에서 칸을 누르면 키보드가 올라오며 화면이 줄고 resize 가 온다. 그때 render() 가
  // 돌면 누르고 있던 칸이 문서에서 통째로 사라져 포커스가 죽고 키보드가 바로 닫힌다 —
  // 이름도 PIN 도 칠 수가 없다. 로그아웃해도 state.view 는 'day' 로 남을 수 있으므로
  // 뷰만 보고 가드하면 이 화면이 걸린다. 조건이 아니라 **그 함수를 실제로 부른 뒤의
  // DOM** 을 본다 — setInterval·resize 가 부르는 것과 같은 dayTick 이다.
  state.user = null;
  state.booting = false;
  state.view = 'day';
  render();
  const nameEl = document.querySelector('[data-a="name"]');
  nameEl.focus();
  dayTick();
  ok(document.contains(nameEl) && document.activeElement === nameEl,
    'the login field survives a day-view tick — a phone keyboard fires resize',
    'inDoc=' + document.contains(nameEl) + ' active=' + document.activeElement.tagName);

  Object.assign(state, kSpan);
  Object.assign(state, kGoal);
  Object.assign(state, kCat);
  Object.assign(state, kDay);
  render();

  // 보고는 state 를 되돌린 **뒤에** 한다 — 여기서 던져도 화면은 사용자 데이터로 돌아가 있다.
  if (fails.length) {
    fails.forEach((f, i) => console.error('selftest FAIL ' + (i + 1) + '/' + fails.length + ': ' + f));
    throw new Error('selftest: ' + fails.length + ' of ' + checks + ' checks failed — see the list above');
  }
  console.log('selftest: all ' + checks + ' checks passed');
}
