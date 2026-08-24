'use strict';
// 로그인 화면 · 회원 승인 UI. calendar.js / todo.js 보다 먼저 로드된다.
// 실제 인증과 저장은 js/firebase.js(모듈)가 맡고 여기서는 window.fb 만 호출한다.

// ---------------------------------------------------------------- 검증
// PIN은 Firebase Auth 비밀번호로 그대로 쓰인다 — 최소 6자 규칙에 맞춰 6자리 고정.
const validPin = (p) => /^\d{6}$/.test(p || '');
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());
const normName = (n) => (n || '').trim();

const blankAuth = () => ({
  mode: 'login', name: '', email: '', pin: '', pin2: '',
  remember: false, error: '', notice: '', busy: false,
  // 약관 동의.
  // age 는 '' | 'over14' 뿐이다. 만 14세 미만은 가입 자체를 받지 않는다 —
  // 법정대리인 동의 절차를 두는 대신 아예 대상에서 뺐다(약관·처리방침도 같은 문장).
  agree: { terms: false, privacy: false, age: '', marketing: false }
});

// 필수 동의 검사. 미충족이면 안내 문구를, 다 됐으면 '' 를 돌려준다.
// 화면용이다 — 진짜 강제는 firestore.rules 의 users create 조건이 한다.
function agreeMissing(g) {
  if (!g.terms) return t('ag.needTerms');
  if (!g.privacy) return t('ag.needPrivacy');
  if (g.age !== 'over14') return t('ag.needAge');
  return '';
}

// ---------------------------------------------------------------- 화면 설정
// 즉시 적용 → 화면 갱신 → 서버 저장. 저장이 실패해도 화면은 되돌리지 않는다 —
// localStorage 에 이미 들어가 있어서 이 기기에서는 유효하고, 다음 로그인 때
// adoptSettings 가 다시 승격을 시도한다.
// 로그인 전에는 서버 쓰기를 건너뛴다. 그 값은 로그인 시점에 승격된다.
function setPref(key, val) {
  const patch = {};
  patch[key] = val;
  setSettings(patch);
  render();
  if (state.user) fb.saveSettings().catch((e) => fb.fail(t('err.settings'), e));
}

// 테마·언어 고르는 줄. 이미 있는 .seg-wrap / .seg 를 그대로 쓴다 (새 CSS 없음).
function prefRow(label, key, opts) {
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;' +
    'padding:11px 4px;border-top:.5px solid var(--separator);flex-wrap:wrap">' +
    '<span style="font-size:14px;color:var(--label-secondary)">' + esc(label) + '</span>' +
    '<div class="seg-wrap">' + opts.map((o) =>
      '<button class="seg' + (SETTINGS[key] === o[0] ? ' seg-on' : '') +
      '" data-pref="' + key + '" data-val="' + o[0] + '" aria-pressed="' + (SETTINGS[key] === o[0]) + '">' +
      esc(o[1]) + '</button>').join('') + '</div></div>';
}
const THEME_OPTS = () => [['light', t('set.themeLight')], ['dark', t('set.themeDark')], ['system', t('set.themeSystem')]];
// 언어 이름은 번역하지 않는다 — 읽을 수 없는 언어로 적히면 고를 수가 없다.
const LANG_OPTS = [['ko', '한국어'], ['en', 'English']];
// 첫 화면. 라벨은 하단 탭 바와 **같은 문자열**을 쓴다 (view.year/month/week/day) —
// 설정에서 고른 이름과 화면 아래 탭 이름이 다르면 같은 것으로 안 읽힌다.
const VIEW_OPTS = () => VIEWS.map((v) => [v, t('view.' + v)]);

// state.users 는 관리자로 로그인했을 때만 채워진다 (users 컬렉션 스냅샷).
const pendingUsers = () => state.users.filter((u) => u.status === 'pending');

// ---------------------------------------------------------------- 인증 동작
function authFail(msg) { state.auth.busy = false; state.auth.error = msg; render(); }

async function login() {
  const a = state.auth;
  a.error = ''; a.notice = '';
  if (!normName(a.name)) return authFail(t('auth.needName'));
  if (!validPin(a.pin)) return authFail(t('auth.pinRule'));
  a.busy = true; render();
  try {
    await fb.signIn(normName(a.name), a.pin, a.remember);
    // 성공하면 onAuthStateChanged 가 화면을 넘긴다. 여기서 render 하지 않는다.
  } catch (e) {
    authFail(e.message);
  }
}

async function signup() {
  const a = state.auth;
  const name = normName(a.name), email = (a.email || '').trim();
  a.error = ''; a.notice = '';
  if (!name) return authFail(t('auth.needName'));
  if (!validEmail(email)) return authFail(t('auth.needEmail'));
  if (!validPin(a.pin)) return authFail(t('auth.pinRuleSignup'));
  if (a.pin !== a.pin2) return authFail(t('auth.pinMismatch'));
  // 버튼은 disabled 로 막지 않는다 — 눌렀을 때 무엇이 빠졌는지 알려주려는 것이다.
  const missing = agreeMissing(a.agree);
  if (missing) return authFail(missing);
  a.busy = true; render();
  try {
    await fb.signUp(name, email, a.pin, a.agree);
    // 승인제가 아니라서 가입하면 그대로 들어간다 — 화면 전환은 enterAccount() 가
    // 한다(로그인과 같은 경로). 여기서 render 하지 않는다.
  } catch (e) {
    authFail(e.message);
  }
}

function logout() {
  state.auth = blankAuth();
  fb.signOutNow().catch((e) => fb.fail(t('err.logout'), e));
  // 화면 정리는 onAuthStateChanged 가 한다.
}

// 승인·거절. users 스냅샷이 돌아오면서 목록이 저절로 갱신된다.
function decide(uid, status) {
  fb.setStatus(uid, status).catch((e) => fb.fail(t('err.status'), e));
}

function resetPin(uid) {
  const u = state.users.find((x) => x.uid === uid);
  if (!u || !u.email) return;
  if (!confirm(t('adm.askReset', u.name, u.email))) return;
  fb.resetPin(u.email)
    .then(() => alert(t('adm.resetSent')))
    .catch((e) => fb.fail(t('err.mail'), e));
}

// 관리자는 스스로 탈퇴할 수 없다. 자기 users 문서를 지우면 isAdmin() 이 거짓이
// 되어 남은 회원을 아무도 관리하지 못하는 상태로 서비스가 잠긴다.
// 보안 규칙에도 같은 조건이 들어 있다 — 화면만 믿지 않는다.
const canDeleteSelf = (u) => !!u && u.role !== 'admin';

// 본인 탈퇴. PIN 재입력이 실수 방지 확인이자 Auth 재인증을 겸한다.
function removeSelf() {
  const d = state.del;
  if (!d || d.busy || !canDeleteSelf(state.user)) return;
  if (!validPin(d.pin)) { d.error = t('auth.pinRule'); return render(); }
  d.busy = true; d.error = ''; render();
  fb.deleteSelf(d.pin)
    .then((n) => {
      // 여기 오면 계정이 이미 없다. onAuthStateChanged 가 로그인 화면을 그리는데
      // applyLoggedOut 은 state.auth 를 건드리지 않으므로 안내 문구가 남는다.
      state.del = null;
      state.showSettings = false;
      state.auth.notice = t('set.delDone', n);
      render();
    })
    .catch((e) => {
      d.busy = false;
      d.error = e.message || t('set.delFail');
      render();
    });
}

// 계정 완전 삭제. 버튼은 본인에게 안 보이지만 여기서 한 번 더 막는다 —
// 관리자가 자기 users 문서를 지우면 스스로 로그인 불능이 된다.
function removeAccount(uid) {
  const u = state.users.find((x) => x.uid === uid);
  if (!u || uid === state.user.uid) return;
  if (!confirm(t('adm.askDelete', u.name))) return;
  fb.deleteAccount(uid, u.name)
    .then((n) => alert(t('adm.deleteDone', u.name, n)))
    .catch((e) => fb.fail(t('err.delete'), e));
}

function migrateLocal() {
  if (!confirm(t('adm.askMigrate'))) return;
  fb.uploadLocal(state.user.name)
    .then((n) => alert(n ? t('adm.migrateDone', n) : t('adm.migrateNone')))
    .catch((e) => fb.fail(t('err.upload'), e));
}

// ---------------------------------------------------------------- 약관 동의
// 회원가입 탭 하단, "가입 신청하기" 버튼 위에 붙는다.
function renderAgree() {
  const g = state.auth.agree;
  const allOn = g.terms && g.privacy && !!g.age && g.marketing;

  // 체크 표시는 색으로만 켜고 끈다 — 꺼져 있어도 자리를 차지해야 줄이 안 흔들린다.
  // aria-hidden: icon() 이 <svg aria-label="checkmark"> 를 만드는데, 그대로 두면
  // 체크박스 이름이 "checkmark 이용약관 동의" 로 읽힌다.
  const box = (on) => '<span aria-hidden="true" style="flex:none;width:22px;height:22px;border-radius:2px;display:flex;' +
    'align-items:center;justify-content:center;transition:all .15s ease;' +
    (on ? 'background-color:var(--tint);color:var(--on-tint)'
        : 'box-shadow:inset 0 0 0 1.5px var(--separator);color:transparent') + '">' +
    icon('checkmark', 13) + '</span>';

  const tag = (t, req) => '<span style="flex:none;font-size:11px;font-weight:700;padding:2px 6px;border-radius:2px;' +
    (req ? 'color:var(--tint);background:color-mix(in srgb, var(--tint) 14%, transparent)'
         : 'color:var(--label-tertiary);background:var(--fill-quaternary)') + '">' + t + '</span>';

  const check = (attrs, on, inner) => '<button type="button" role="checkbox" aria-checked="' + on + '" ' + attrs +
    ' style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:11px 2px;border:none;' +
    'background:none;cursor:pointer;text-align:left;font-family:inherit;color:var(--label)">' + box(on) + inner + '</button>';

  // "전문 보기" 는 체크 버튼 밖에 둔다 — 버튼 안의 버튼은 잘못된 HTML 이고,
  // 안에 넣으면 링크를 눌러도 체크가 같이 토글된다.
  const doc = (k) => '<button type="button" data-legal="' + k + '" style="flex:none;border:none;background:none;' +
    'cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;color:var(--tint);' +
    'text-decoration:underline;padding:11px 4px">' + esc(t('ag.doc')) + '</button>';

  const line = (inner) => '<div style="display:flex;align-items:center;gap:8px">' + inner + '</div>';
  const txt = (t) => '<span style="flex:1;min-width:0;font-size:14px;font-weight:500;line-height:1.4">' + t + '</span>';
  const hr = 'border-top:.5px solid var(--separator)';

  return '<div style="margin-top:20px;' + hr + ';padding-top:6px">' +

    line(check('data-agree="all"', allOn,
      '<span style="flex:1;font-size:15px;font-weight:700">' + esc(t('ag.all')) + '</span>')) +
    '<div style="font-size:12px;color:var(--label-tertiary);margin:0 0 6px 32px">' +
      esc(t('ag.allHint')) + '</div>' +

    '<div style="' + hr + ';padding-top:4px">' +
      line(check('data-agree="terms"', g.terms, txt(esc(t('ag.terms'))) + tag(esc(t('ag.required')), true)) + doc('terms')) +
      line(check('data-agree="privacy"', g.privacy, txt(esc(t('ag.privacy'))) + tag(esc(t('ag.required')), true)) + doc('privacy')) +
    '</div>' +

    // 나이 확인은 갈래 선택이 아니라 **체크 하나**다. 만 14세 미만은 가입 대상이
    // 아니므로 고를 항목 자체를 두지 않는다 — 고르게 해 놓고 막으면 왜 막혔는지
    // 모른 채 되돌아가게 된다. 아래 안내 한 줄이 그 이유를 대신한다.
    '<div style="display:flex;align-items:center;gap:6px;margin:14px 0 2px;flex-wrap:wrap">' +
      '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">' + esc(t('ag.ageTitle')) + '</span>' +
      tag(esc(t('ag.required')), true) + '</div>' +
    line(check('data-agree="age" data-val="over14"', g.age === 'over14', txt(esc(t('ag.over14'))))) +
    // ★ 안내로 끝내지 않고 갈 길을 같이 준다. 만 14세 미만은 막힌 게 아니라
    //   **계정 없이 쓰는 쪽**으로 가는 것이고, 그 버튼이 여기 없으면 화면 맨 아래까지
    //   내려가서 찾아야 한다.
    '<div style="font-size:12px;line-height:1.5;color:var(--label-tertiary);margin:0 0 2px 32px">' +
      esc(t('ag.under14No')) + '</div>' +
    '<div style="margin:0 0 4px 30px">' +
      '<button type="button" data-act="closeLogin" style="border:none;background:none;cursor:pointer;' +
        'font-family:inherit;font-size:12px;font-weight:700;color:var(--tint);' +
        'text-decoration:underline;padding:4px 2px">' + esc(t('auth.guestGo')) + '</button></div>' +

    '<div style="' + hr + ';margin-top:8px;padding-top:4px">' +
      line(check('data-agree="marketing"', g.marketing,
        txt(esc(t('ag.marketing'))) + tag(esc(t('ag.optional')), false))) +
    '</div></div>';
}

// 약관 전문 모달. 본문은 js/legal.js 한 곳에서 오고, 단독 페이지
// terms.html / privacy.html 도 같은 문자열을 쓴다.
function renderLegalSheet() {
  // 언어에 맞는 본문을 고른다. 영문본이 없으면 한국어로 떨어진다 (legal.js).
  const d = legalDoc(state.legal);
  if (!d) return '';
  return '<div data-act="closeLegal" style="position:fixed;inset:0;z-index:110;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:111;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" aria-label="' + esc(d.title) + '" style="pointer-events:auto;' +
      'width:min(560px,100vw);max-height:88vh;overflow:auto;background:var(--bg);border-radius:3px 3px 0 0;' +
      'box-shadow:var(--shadow-3);padding:12px 20px 30px;animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(d.title) + '</h3>' +
        '<button data-act="closeLegal" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;width:30px;height:30px;' +
          'border-radius:3px;background:var(--fill-tertiary);color:var(--label-secondary);display:flex;' +
          'align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +
      '<div class="legal">' + d.body + '</div>' +
      '<div style="margin-top:22px;text-align:center">' +
        '<a href="' + state.legal + '.html" target="_blank" rel="noopener" ' +
          'style="font-size:13px;font-weight:600">' + esc(t('legal.newWindow')) + '</a></div>' +
    '</div></div>';
}

// ---------------------------------------------------------------- 로그인 화면
function renderAuth() {
  const a = state.auth;
  const isLogin = a.mode === 'login';
  // 필수 동의가 덜 됐으면 버튼을 흐리게만 한다 — disabled 는 클릭 이벤트를 삼켜서
  // "무엇이 빠졌는지" 안내할 기회가 없어진다.
  const blocked = !isLogin && !!agreeMissing(a.agree);
  const tab = (mode, label) => {
    const on = a.mode === mode;
    return '<button class="seg' + (on ? ' seg-on' : '') + '" data-authmode="' + mode +
      '" style="flex:1;padding:0">' + label + '</button>';
  };
  const label = (t) => '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + t + '</div>';
  const pinField = (key, ph) => '<input class="field" type="password" data-a="' + key + '" inputmode="numeric" ' +
    'autocomplete="off" maxlength="6" placeholder="' + ph + '" value="' + esc(a[key]) + '" ' +
    'style="padding:12px 14px;font-size:16px;letter-spacing:.35em">';

  return '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px">' +
    '<div style="width:min(400px,100%)">' +
      '<div style="text-align:center;margin-bottom:22px">' +
        '<div style="font-size:13px;font-weight:600;color:var(--tint)">' + esc(t('app.tagline')) + '</div>' +
        '<h1 style="margin:4px 0 0;font-size:28px;font-weight:700;letter-spacing:.2px">' +
          esc(t(isLogin ? 'auth.login' : 'auth.signup')) + '</h1></div>' +
      '<div class="card" style="border:.5px solid var(--separator);padding:18px 20px 24px">' +
        '<div class="seg-wrap">' +
          tab('login', esc(t('auth.login'))) + tab('signup', esc(t('auth.signup'))) + '</div>' +

        label(esc(t('auth.name'))) +
        '<input class="field" type="text" data-a="name" placeholder="' + esc(t('auth.namePh')) + '" autocomplete="off" ' +
          'value="' + esc(a.name) + '" style="padding:12px 14px;font-size:16px">' +

        // 이메일은 가입할 때만 받는다. 계정 복구(PIN 재설정 메일)에 쓰이고
        // 로그인 화면에는 다시 노출하지 않는다.
        (isLogin ? '' : label(esc(t('auth.email'))) +
          '<input class="field" type="email" data-a="email" placeholder="you@example.com" ' +
            'autocomplete="email" value="' + esc(a.email) + '" style="padding:12px 14px;font-size:16px">' +
          '<div style="margin-top:6px;font-size:12px;color:var(--label-tertiary)">' +
            esc(t('auth.emailHint')) + '</div>') +

        label(esc(t('auth.pin') + (isLogin ? '' : t('auth.pinDigits')))) + pinField('pin', '••••••') +
        (isLogin ? '' : label(esc(t('auth.pin2'))) + pinField('pin2', '••••••')) +

        (isLogin ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px">' +
          '<div><div style="font-size:15px;font-weight:600">' + esc(t('auth.remember')) + '</div>' +
          '<div style="font-size:12px;color:var(--label-tertiary);margin-top:2px">' + esc(t('auth.rememberHint')) + '</div></div>' +
          '<button class="sw" role="switch" aria-checked="' + (a.remember ? 'true' : 'false') +
            '" data-act="toggleRemember" aria-label="' + esc(t('auth.remember')) + '"><span></span></button></div>' : '') +

        (isLogin ? '' : renderAgree()) +

        (a.error ? '<div role="alert" style="margin-top:14px;font-size:13px;font-weight:600;color:#FF3B30;' +
          'background:color-mix(in srgb, #FF3B30 12%, transparent);padding:10px 12px;border-radius:3px">' +
          esc(a.error) + '</div>' : '') +
        (a.notice ? '<div role="status" style="margin-top:14px;font-size:13px;font-weight:600;color:#34C759;' +
          'background:color-mix(in srgb, #34C759 14%, transparent);padding:10px 12px;border-radius:3px">' +
          esc(a.notice) + '</div>' : '') +

        '<div data-raise="tint" style="display:block;margin-top:20px">' +
          '<button class="btn btn-prominent btn-md" data-act="' + (isLogin ? 'login' : 'signup') + '" ' +
            'style="width:100%' + (blocked ? ';opacity:.45' : '') + '"' +
            (a.busy ? ' disabled' : '') + (blocked ? ' aria-disabled="true"' : '') + '>' +
            esc(a.busy ? t('auth.busy') : t(isLogin ? 'auth.login' : 'auth.submit')) + '</button></div>' +

        // 언어 전환은 로그인 화면에도 있어야 한다. 설정 시트는 로그인해야 열리는데,
        // 한국어를 못 읽는 사람은 그때까지 갈 수가 없다.
        // 여기서 고른 값은 localStorage 에 남고, 첫 로그인 때 승격 저장된다.
        '<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:18px;' +
          'padding-top:14px;border-top:.5px solid var(--separator)">' +
          LANG_OPTS.map((o, i) => (i ? '<span style="color:var(--label-quaternary)">·</span>' : '') +
            '<button type="button" data-pref="lang" data-val="' + o[0] + '" lang="' + o[0] + '" ' +
            'aria-pressed="' + (curLang() === o[0]) + '" style="border:none;background:none;cursor:pointer;' +
            'font-family:inherit;font-size:12px;padding:4px 8px;' +
            (curLang() === o[0] ? 'font-weight:700;color:var(--tint)' : 'font-weight:500;color:var(--label-tertiary)') +
            '">' + esc(o[1]) + '</button>').join('') +
        '</div>' +
      '</div>' +
      // 로그인하지 않아도 앱은 그대로 쓸 수 있다. 이 줄이 손님 화면으로 돌아가는
      // 유일한 길이다 — 지우면 로그인 화면에 들어온 사람이 갇힌다.
      '<div style="text-align:center;margin-top:16px">' +
        '<button type="button" data-act="closeLogin" style="border:none;background:none;cursor:pointer;' +
          'font-family:inherit;font-size:13px;font-weight:600;color:var(--tint);padding:8px 12px">' +
          esc(t('auth.guestGo')) + '</button></div>' +
    '</div></div>';
}

// ---------------------------------------------------------------- 설정 시트
// 계정 정보 + 위험 구역(탈퇴). 관리자에게는 탈퇴 자리에 안내만 보여 준다.
function renderSettingsSheet() {
  const u = state.user, d = state.del;
  const row = (k, v) => '<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 4px;' +
    'border-top:.5px solid var(--separator)">' +
    '<span style="font-size:14px;color:var(--label-secondary)">' + k + '</span>' +
    '<span class="trunc" style="font-size:14px;font-weight:600">' + esc(v) + '</span></div>';

  // ★ 손님은 계정이 없다 — 계정 정보도 탈퇴도 없고, 대신 로그인 입구가 선다.
  //   u.role 이 'user' 라서 canDeleteSelf(u) 가 true 로 나오므로 여기서 먼저 자른다.
  const guestMode = isGuest();

  // 탈퇴 확인: PIN 을 다시 받는다. 실수로 누른 사람은 여기서 멈춘다.
  const danger = !canDeleteSelf(u)
    ? '<div style="font-size:13px;line-height:1.6;color:var(--label-tertiary);padding:4px">' +
        esc(t('set.adminNoDelete')) + '</div>'
    : d
      ? '<div style="font-size:13px;line-height:1.6;color:var(--label-secondary);padding:2px 4px 10px">' +
          t('set.delConfirm') +   // <strong>/<br> 이 들어 있는 문자열이라 esc 하지 않는다
          '</div>' +
        '<input class="field" type="password" data-d="pin" inputmode="numeric" autocomplete="off" ' +
          'maxlength="6" placeholder="••••••" value="' + esc(d.pin) + '" ' +
          'style="padding:12px 14px;font-size:16px;letter-spacing:.35em">' +
        (d.error ? '<div role="alert" style="margin-top:10px;font-size:13px;font-weight:600;color:#FF3B30;' +
          'background:color-mix(in srgb, #FF3B30 12%, transparent);padding:10px 12px;border-radius:3px">' +
          esc(d.error) + '</div>' : '') +
        '<div style="display:flex;gap:10px;margin-top:14px">' +
          '<button class="btn btn-gray btn-md" data-act="cancelDelete" style="flex:1"' +
            (d.busy ? ' disabled' : '') + '>' + esc(t('set.delCancel')) + '</button>' +
          '<button class="btn btn-gray btn-md" data-act="confirmDelete" style="flex:1;color:#FF3B30"' +
            (d.busy ? ' disabled' : '') + '>' + esc(t(d.busy ? 'set.delBusy' : 'set.delGo')) + '</button></div>'
      : '<button class="btn btn-gray btn-md" data-act="askDelete" style="width:100%;color:#FF3B30">' +
          esc(t('set.delOpen')) + '</button>' +
        '<div style="font-size:12px;line-height:1.5;color:var(--label-tertiary);margin-top:8px;padding:0 4px">' +
          esc(t('set.delHint')) + '</div>';

  return '<div data-act="closeSettings" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" aria-label="설정" style="pointer-events:auto;width:min(560px,100vw);' +
      'max-height:88vh;overflow:auto;background:var(--bg);border-radius:3px 3px 0 0;box-shadow:var(--shadow-3);' +
      'padding:12px 20px 30px;animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(t('set.title')) + '</h3>' +
        '<button data-act="closeSettings" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;width:30px;height:30px;' +
          'border-radius:3px;background:var(--fill-tertiary);color:var(--label-secondary);display:flex;' +
          'align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +

      '<div style="font-size:13px;font-weight:700;color:var(--label-secondary);margin:18px 4px 2px">' +
        esc(t('set.account')) + '</div>' +
      (guestMode
        ? '<div style="font-size:13px;line-height:1.6;color:var(--label-secondary);padding:6px 4px 12px">' +
            esc(t('guest.hint')) + '</div>' +
          '<button class="btn btn-prominent btn-md" data-act="openLogin" style="width:100%">' +
            esc(t('guest.login')) + '</button>'
        : row(t('auth.name'), u.name) + row(t('auth.email'), u.email || '') +
          row(t('set.role'), t(u.role === 'admin' ? 'set.roleAdmin' : 'set.roleUser'))) +

      // 테마·언어. users/{uid}.settings 로 저장되어 기기 간에 따라온다.
      '<div style="font-size:13px;font-weight:700;color:var(--label-secondary);margin:22px 4px 2px">' +
        esc(t('set.display')) + '</div>' +
      prefRow(t('set.theme'), 'theme', THEME_OPTS()) +
      prefRow(t('set.lang'), 'lang', LANG_OPTS) +
      // ★ 지금 화면을 바꾸지 않는다 — **다음에 열 때** 처음 뜨는 화면이다.
      //   지금 보는 화면은 아래 탭 바로 바꾼다. setPref 가 state.view 를 안 건드리는
      //   것이 이 뜻이고, 눌린 칩 자체가 저장됐다는 표시다.
      prefRow(t('set.view'), 'view', VIEW_OPTS()) +

      // 카테고리 관리 진입점. ★ 여기가 **유일한 입구**다 — 카테고리가 0개면 헤더의
      // 필터 칩 줄 자체가 안 그려지므로, 이 줄을 지우면 아무도 카테고리를 못 만든다.
      '<div style="font-size:13px;font-weight:700;color:var(--label-secondary);margin:22px 4px 8px">' +
        esc(t('cat.title')) + '</div>' +
      '<button class="btn btn-gray btn-md" data-act="cats" style="width:100%">' +
        esc(t('cat.manage')) + '</button>' +

      (guestMode ? ''
        : '<div style="font-size:13px;font-weight:700;color:#FF3B30;margin:22px 4px 8px">' +
          esc(t('set.danger')) + '</div>' + danger) +

      '<div style="font-size:12px;line-height:1.6;color:var(--label-tertiary);margin-top:22px;padding:0 4px">' +
        '<a href="terms.html" target="_blank" rel="noopener">' + esc(t('legal.terms')) + '</a> · ' +
        '<a href="privacy.html" target="_blank" rel="noopener">' + esc(t('legal.privacy')) + '</a></div>' +
    '</div></div>';
}

// ---------------------------------------------------------------- 관리자 시트
const statusLabel = (s) =>
  s === 'pending' ? t('adm.stPending') : s === 'approved' ? t('adm.stApproved') :
  s === 'rejected' ? t('adm.stRejected') : (s || '');

// 나이 구분 배지. 승인을 누르기 전에 만 14세 미만인지 보라고 붙인다.
// 약관 도입(1.0) 전에 가입한 계정에는 agreements 가 아예 없다 — 그 계정의 로그인은
// 그대로 되고(규칙은 create 만 검사한다) 여기서 "약관 미동의" 로 식별만 한다.
const AGE_BADGE = {
  over14: ['adm.ageOver14', 'var(--label-secondary)'],
  under14_guardian: ['adm.ageUnder14', '#FF9500']
};
function ageBadge(u) {
  const b = (u.agreements && AGE_BADGE[u.agreements.age]) || ['adm.ageNone', 'var(--label-tertiary)'];
  return '<span style="flex:none;font-size:11px;font-weight:700;padding:2px 7px;border-radius:2px;color:' +
    b[1] + ';background:color-mix(in srgb, ' + b[1] + ' 14%, transparent)">' + esc(t(b[0])) + '</span>';
}

// 표시 전용이라 dateLabel(Intl)을 쓴다. fmt() 는 저장 키 전용으로 남겨 둔다.
const admJoined = (u) => (u.createdAt && u.createdAt.toDate ? t('adm.joined', dateLabel(u.createdAt.toDate())) : '');

// 약관 동의 기록. 지금까지 저장만 하고 화면에 안 보여 주던 값이다.
// ★ 옛 계정에는 agreements 자체가 없다(약관 도입 전 가입) — 없음으로 표시한다.
function admAgree(u) {
  const g = u.agreements;
  if (!g) return esc(t('adm.agreeNone'));
  const at = g.terms && g.terms.at && g.terms.at.toDate ? dateLabel(g.terms.at.toDate()) : '';
  return [esc(t('adm.agreeVer', (g.terms && g.terms.version) || '?')), esc(at),
    esc(t(g.marketing ? 'adm.agreeMktOn' : 'adm.agreeMktOff'))].filter(Boolean).join(' · ');
}

// 목록만 따로 만든다 — 검색칸을 칠 때 render() 를 부르면 캐럿이 날아가므로
// syncAdmSheet() 가 이 결과만 갈아 끼운다(syncCatSheet 과 같은 방식).
function admRows() {
  const q = (state.admQ || '').trim().toLowerCase();
  const hit = (u) => !q || (u.name || '').toLowerCase().indexOf(q) >= 0 ||
    (u.email || '').toLowerCase().indexOf(q) >= 0;
  const at = (u) => (u.createdAt && u.createdAt.toDate ? u.createdAt.toDate().getTime() : 0);
  const list = state.users.filter(hit).sort((x, y) => (state.admSort === 'name'
    ? (x.name || '').localeCompare(y.name || '')
    : at(y) - at(x)));           // 기본은 최근 가입 먼저

  if (!list.length) {
    return '<div style="padding:28px 4px;text-align:center;font-size:15px;font-weight:600;' +
      'color:var(--label-secondary)">' + esc(t(q ? 'adm.noMatch' : 'adm.noUsers')) + '</div>';
  }
  return list.map((u, i) => {
    const blocked = u.status !== 'approved';
    return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 4px;border-top:' +
      (i === 0 ? 'none' : '.5px solid var(--separator)') + '">' +
      '<div style="flex:1;min-width:180px">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
          '<span style="font-size:16px;font-weight:600">' + esc(u.name) + '</span>' +
          (u.role === 'admin' ? '<span style="font-size:11px;font-weight:600;color:var(--tint)">' +
            esc(t('hdr.admin')) + '</span>' : '') +
          ageBadge(u) +
          (blocked ? '<span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:2px;color:#FF3B30;' +
            'background:color-mix(in srgb, #FF3B30 14%, transparent)">' + esc(statusLabel(u.status)) +
            '</span>' : '') + '</div>' +
        '<div class="trunc" style="font-size:13px;color:var(--label-secondary);margin-top:1px">' +
          esc(u.email || '') + (admJoined(u) ? ' · ' + esc(admJoined(u)) : '') + '</div>' +
        '<div class="trunc" style="font-size:12px;color:var(--label-tertiary);margin-top:2px">' +
          admAgree(u) + '</div></div>' +
      '<button class="btn btn-gray btn-sm" data-resetpin="' + esc(u.uid) + '">' +
        esc(t('adm.resetPin')) + '</button>' +
      // 본인 계정은 잠그지도 지우지도 못한다 — 스스로 갇히는 길을 아예 안 그린다.
      (u.uid === state.user.uid ? '' :
        (blocked
          ? '<button class="btn btn-gray btn-sm" data-approve="' + esc(u.uid) + '" style="color:var(--tint)">' +
            esc(t('adm.unblock')) + '</button>'
          : '<button class="btn btn-gray btn-sm" data-reject="' + esc(u.uid) + '" style="color:#FF9500">' +
            esc(t('adm.block')) + '</button>') +
        '<button class="btn btn-gray btn-sm" data-delacct="' + esc(u.uid) + '" ' +
          'style="color:#FF3B30">' + esc(t('adm.delete')) + '</button>') +
      '</div>';
  }).join('');
}

// 목록만 갈아 끼운다. 검색칸(uncontrolled)은 건드리지 않아 캐럿이 살아 있는다.
function syncAdmSheet() {
  const el = document.getElementById('admList');
  if (el) el.innerHTML = admRows();
}

function renderAdminSheet() {
  const heading = (t) => '<div style="font-size:13px;font-weight:700;color:var(--label-secondary);' +
    'margin:20px 4px 2px;letter-spacing:.2px">' + t + '</div>';
  const allRows = admRows();

  // 한눈에 보는 숫자. users 스냅샷만으로 계산한다 — 읽기가 더 늘지 않는다.
  const week = Date.now() - 7 * 86400000;
  const isNew = (u) => !!(u.createdAt && u.createdAt.toDate && u.createdAt.toDate().getTime() >= week);
  const stat = (label, n, color) =>
    '<div style="flex:1;min-width:0;background-color:var(--bg-secondary);border-radius:3px;padding:12px 14px">' +
      '<div style="font-size:22px;font-weight:800;letter-spacing:-.5px;color:' + color + '">' + n + '</div>' +
      '<div class="trunc" style="font-size:12px;font-weight:600;color:var(--label-secondary);margin-top:2px">' +
        esc(label) + '</div></div>';
  const stats = '<div style="display:flex;gap:8px;margin:14px 0 4px">' +
    stat(t('adm.statAll'), state.users.length, 'var(--label)') +
    stat(t('adm.statNew'), state.users.filter(isNew).length, 'var(--tint)') +
    stat(t('adm.statBlocked'), state.users.filter((u) => u.status !== 'approved').length, '#FF3B30') +
    '</div>';

  // 검색·정렬. 검색칸은 uncontrolled 라 입력할 때 render() 를 부르면 캐럿이 날아간다 —
  // 목록만 갈아 끼우는 syncAdmSheet() 를 쓴다(카테고리 시트와 같은 방식).
  const tools = '<div style="display:flex;gap:8px;margin:14px 0 2px">' +
    '<input class="field" data-admq style="flex:1;padding:10px 12px;font-size:16px" ' +
      'placeholder="' + esc(t('adm.search')) + '" value="' + esc(state.admQ) + '">' +
    '<button class="btn btn-gray btn-md" data-act="admSort" style="flex:none;white-space:nowrap">' +
      esc(t(state.admSort === 'name' ? 'adm.sortName' : 'adm.sortJoined')) + '</button></div>';

  return '<div data-act="closeAdmin" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" style="pointer-events:auto;width:min(560px,100vw);max-height:88vh;overflow:auto;' +
      'background:var(--bg);border-radius:3px 3px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(t('adm.title')) + '</h3>' +
        '<button data-act="closeAdmin" aria-label="' + esc(t('a.close')) + '" style="border:none;cursor:pointer;width:30px;height:30px;' +
          'border-radius:3px;background:var(--fill-tertiary);color:var(--label-secondary);display:flex;' +
          'align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +

      stats + tools +
      '<div id="admList">' + allRows + '</div>' +

      heading(esc(t('adm.migrate'))) +
      '<div style="font-size:12px;line-height:1.5;color:var(--label-tertiary);margin:6px 4px 10px">' +
        esc(t('adm.migrateHint')) + '</div>' +
      '<button class="btn btn-gray btn-md" data-act="migrate" style="width:100%">' +
        esc(t('adm.migrateBtn')) + '</button>' +
    '</div></div>';
}
