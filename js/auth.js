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
  // 약관 동의. age 는 '' | 'over14' | 'under14_guardian' — 배타 선택을 문자열
  // 하나로 들고 있어서 "하나 고르면 다른 하나 해제" 로직이 따로 필요 없다.
  agree: { terms: false, privacy: false, age: '', marketing: false }
});

// 필수 동의 검사. 미충족이면 안내 문구를, 다 됐으면 '' 를 돌려준다.
// 화면용이다 — 진짜 강제는 firestore.rules 의 users create 조건이 한다.
function agreeMissing(g) {
  if (!g.terms) return '이용약관에 동의해 주세요.';
  if (!g.privacy) return '개인정보 수집·이용에 동의해 주세요.';
  if (g.age !== 'over14' && g.age !== 'under14_guardian') return '나이 확인 항목을 선택해 주세요.';
  return '';
}

// state.users 는 관리자로 로그인했을 때만 채워진다 (users 컬렉션 스냅샷).
const pendingUsers = () => state.users.filter((u) => u.status === 'pending');

// ---------------------------------------------------------------- 인증 동작
function authFail(msg) { state.auth.busy = false; state.auth.error = msg; render(); }

async function login() {
  const a = state.auth;
  a.error = ''; a.notice = '';
  if (!normName(a.name)) return authFail('이름을 입력해 주세요.');
  if (!validPin(a.pin)) return authFail('PIN은 숫자 6자리입니다.');
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
  if (!name) return authFail('이름을 입력해 주세요.');
  if (!validEmail(email)) return authFail('이메일 주소를 정확히 입력해 주세요.');
  if (!validPin(a.pin)) return authFail('PIN은 숫자 6자리로 입력해 주세요.');
  if (a.pin !== a.pin2) return authFail('PIN이 서로 다릅니다.');
  // 버튼은 disabled 로 막지 않는다 — 눌렀을 때 무엇이 빠졌는지 알려주려는 것이다.
  const missing = agreeMissing(a.agree);
  if (missing) return authFail(missing);
  a.busy = true; render();
  try {
    await fb.signUp(name, email, a.pin, a.agree);
    state.auth = Object.assign(blankAuth(), { name,
      notice: '회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.' });
    render();
  } catch (e) {
    authFail(e.message);
  }
}

function logout() {
  state.auth = blankAuth();
  fb.signOutNow().catch((e) => fb.fail('로그아웃에 실패했습니다', e));
  // 화면 정리는 onAuthStateChanged 가 한다.
}

// 승인·거절. users 스냅샷이 돌아오면서 목록이 저절로 갱신된다.
function decide(uid, status) {
  fb.setStatus(uid, status).catch((e) => fb.fail('상태 변경에 실패했습니다', e));
}

function resetPin(uid) {
  const u = state.users.find((x) => x.uid === uid);
  if (!u || !u.email) return;
  if (!confirm(u.name + ' 님의 이메일(' + u.email + ')로 PIN 재설정 메일을 보낼까요?')) return;
  fb.resetPin(u.email)
    .then(() => alert('재설정 메일을 보냈습니다.'))
    .catch((e) => fb.fail('메일 발송에 실패했습니다', e));
}

// 관리자는 스스로 탈퇴할 수 없다. 자기 users 문서를 지우면 isAdmin() 이 거짓이
// 되어 남은 회원을 아무도 관리하지 못하는 상태로 서비스가 잠긴다.
// 보안 규칙에도 같은 조건이 들어 있다 — 화면만 믿지 않는다.
const canDeleteSelf = (u) => !!u && u.role !== 'admin';

// 본인 탈퇴. PIN 재입력이 실수 방지 확인이자 Auth 재인증을 겸한다.
function removeSelf() {
  const d = state.del;
  if (!d || d.busy || !canDeleteSelf(state.user)) return;
  if (!validPin(d.pin)) { d.error = 'PIN은 숫자 6자리입니다.'; return render(); }
  d.busy = true; d.error = ''; render();
  fb.deleteSelf(d.pin)
    .then((n) => {
      // 여기 오면 계정이 이미 없다. onAuthStateChanged 가 로그인 화면을 그리는데
      // applyLoggedOut 은 state.auth 를 건드리지 않으므로 안내 문구가 남는다.
      state.del = null;
      state.showSettings = false;
      state.auth.notice = '계정과 할 일 ' + n + '개를 모두 삭제했습니다. 그동안 감사했습니다.';
      render();
    })
    .catch((e) => {
      d.busy = false;
      d.error = e.message || '삭제에 실패했습니다.';
      render();
    });
}

// 계정 완전 삭제. 버튼은 본인에게 안 보이지만 여기서 한 번 더 막는다 —
// 관리자가 자기 users 문서를 지우면 스스로 로그인 불능이 된다.
function removeAccount(uid) {
  const u = state.users.find((x) => x.uid === uid);
  if (!u || uid === state.user.uid) return;
  if (!confirm(u.name + '님의 계정과 모든 할 일이 영구 삭제됩니다.\n' +
    '이 작업은 되돌릴 수 없습니다.')) return;
  fb.deleteAccount(uid, u.name)
    .then((n) => alert(u.name + '님의 계정과 할 일 ' + n + '개를 삭제했습니다.\n\n' +
      'Firebase 콘솔 Authentication에서 계정도 지워주세요.'))
    .catch((e) => fb.fail('삭제에 실패했습니다', e));
}

function migrateLocal() {
  if (!confirm('다른 기기에서 누르면 데이터가 덮어써집니다.\n\n' +
    '이 기기의 localStorage에 남아 있는 할 일을 Firestore로 올릴까요?')) return;
  fb.uploadLocal(state.user.name)
    .then((n) => alert(n ? n + '개를 업로드했습니다.' : '올릴 데이터가 없습니다.'))
    .catch((e) => fb.fail('업로드에 실패했습니다', e));
}

// ---------------------------------------------------------------- 약관 동의
// 회원가입 탭 하단, "가입 신청하기" 버튼 위에 붙는다.
function renderAgree() {
  const g = state.auth.agree;
  const allOn = g.terms && g.privacy && !!g.age && g.marketing;

  // 체크 표시는 색으로만 켜고 끈다 — 꺼져 있어도 자리를 차지해야 줄이 안 흔들린다.
  // aria-hidden: icon() 이 <svg aria-label="checkmark"> 를 만드는데, 그대로 두면
  // 체크박스 이름이 "checkmark 이용약관 동의" 로 읽힌다.
  const box = (on) => '<span aria-hidden="true" style="flex:none;width:22px;height:22px;border-radius:7px;display:flex;' +
    'align-items:center;justify-content:center;transition:all .15s ease;' +
    (on ? 'background-color:var(--tint);color:var(--on-tint)'
        : 'box-shadow:inset 0 0 0 1.5px var(--separator);color:transparent') + '">' +
    icon('checkmark', 13) + '</span>';

  const tag = (t, req) => '<span style="flex:none;font-size:11px;font-weight:700;padding:2px 6px;border-radius:5px;' +
    (req ? 'color:var(--tint);background:color-mix(in srgb, var(--tint) 14%, transparent)'
         : 'color:var(--label-tertiary);background:var(--fill-quaternary)') + '">' + t + '</span>';

  const check = (attrs, on, inner) => '<button type="button" role="checkbox" aria-checked="' + on + '" ' + attrs +
    ' style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:11px 2px;border:none;' +
    'background:none;cursor:pointer;text-align:left;font-family:inherit;color:var(--label)">' + box(on) + inner + '</button>';

  // "전문 보기" 는 체크 버튼 밖에 둔다 — 버튼 안의 버튼은 잘못된 HTML 이고,
  // 안에 넣으면 링크를 눌러도 체크가 같이 토글된다.
  const doc = (k) => '<button type="button" data-legal="' + k + '" style="flex:none;border:none;background:none;' +
    'cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;color:var(--tint);' +
    'text-decoration:underline;padding:11px 4px">전문 보기</button>';

  const line = (inner) => '<div style="display:flex;align-items:center;gap:8px">' + inner + '</div>';
  const txt = (t) => '<span style="flex:1;min-width:0;font-size:14px;font-weight:500;line-height:1.4">' + t + '</span>';
  const hr = 'border-top:.5px solid var(--separator)';

  return '<div style="margin-top:20px;' + hr + ';padding-top:6px">' +

    line(check('data-agree="all"', allOn,
      '<span style="flex:1;font-size:15px;font-weight:700">전체 동의하기</span>')) +
    '<div style="font-size:12px;color:var(--label-tertiary);margin:0 0 6px 32px">' +
      '선택 항목을 포함해 모두 동의합니다.</div>' +

    '<div style="' + hr + ';padding-top:4px">' +
      line(check('data-agree="terms"', g.terms, txt('이용약관 동의') + tag('필수', true)) + doc('terms')) +
      line(check('data-agree="privacy"', g.privacy, txt('개인정보 수집·이용 동의') + tag('필수', true)) + doc('privacy')) +
    '</div>' +

    '<div style="display:flex;align-items:center;gap:6px;margin:14px 0 2px;flex-wrap:wrap">' +
      '<span style="font-size:13px;font-weight:600;color:var(--label-secondary)">나이 확인</span>' + tag('필수', true) +
      '<span style="font-size:12px;color:var(--label-tertiary)">하나를 선택해 주세요</span></div>' +
    line(check('data-agree="age" data-val="over14"', g.age === 'over14', txt('만 14세 이상입니다'))) +
    line(check('data-agree="age" data-val="under14_guardian"', g.age === 'under14_guardian',
      txt('만 14세 미만이며, 보호자(법정대리인)의 동의를 받았습니다'))) +

    '<div style="' + hr + ';margin-top:8px;padding-top:4px">' +
      line(check('data-agree="marketing"', g.marketing, txt('서비스 알림·업데이트 수신') + tag('선택', false))) +
    '</div></div>';
}

// 약관 전문 모달. 본문은 js/legal.js 한 곳에서 오고, 단독 페이지
// terms.html / privacy.html 도 같은 문자열을 쓴다.
function renderLegalSheet() {
  const d = LEGAL[state.legal];
  if (!d) return '';
  return '<div data-act="closeLegal" style="position:fixed;inset:0;z-index:110;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:111;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" aria-label="' + esc(d.title) + '" style="pointer-events:auto;' +
      'width:min(560px,100vw);max-height:88vh;overflow:auto;background:var(--bg);border-radius:20px 20px 0 0;' +
      'box-shadow:var(--shadow-3);padding:12px 20px 30px;animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">' + esc(d.title) + '</h3>' +
        '<button data-act="closeLegal" aria-label="닫기" style="border:none;cursor:pointer;width:30px;height:30px;' +
          'border-radius:50%;background:var(--fill-tertiary);color:var(--label-secondary);display:flex;' +
          'align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +
      '<div class="legal">' + d.body + '</div>' +
      '<div style="margin-top:22px;text-align:center">' +
        '<a href="' + state.legal + '.html" target="_blank" rel="noopener" ' +
          'style="font-size:13px;font-weight:600">새 창에서 열기</a></div>' +
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
        '<div style="font-size:13px;font-weight:600;color:var(--tint)">개인 할 일 캘린더</div>' +
        '<h1 style="margin:4px 0 0;font-size:28px;font-weight:700;letter-spacing:.2px">' +
          (isLogin ? '로그인' : '회원가입 신청') + '</h1></div>' +
      '<div class="card" style="border:.5px solid var(--separator);padding:18px 20px 24px">' +
        '<div class="seg-wrap">' +
          tab('login', '로그인') + tab('signup', '회원가입 신청') + '</div>' +

        label('이름') +
        '<input class="field" type="text" data-a="name" placeholder="이름을 입력하세요" autocomplete="off" ' +
          'value="' + esc(a.name) + '" style="padding:12px 14px;font-size:16px">' +

        // 이메일은 가입할 때만 받는다. 계정 복구(PIN 재설정 메일)에 쓰이고
        // 로그인 화면에는 다시 노출하지 않는다.
        (isLogin ? '' : label('이메일') +
          '<input class="field" type="email" data-a="email" placeholder="you@example.com" ' +
            'autocomplete="email" value="' + esc(a.email) + '" style="padding:12px 14px;font-size:16px">' +
          '<div style="margin-top:6px;font-size:12px;color:var(--label-tertiary)">' +
            'PIN을 잊었을 때 재설정 메일을 받는 주소입니다.</div>') +

        label('PIN 번호' + (isLogin ? '' : ' (숫자 6자리)')) + pinField('pin', '••••••') +
        (isLogin ? '' : label('PIN 번호 확인') + pinField('pin2', '••••••')) +

        (isLogin ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px">' +
          '<div><div style="font-size:15px;font-weight:600">자동 로그인</div>' +
          '<div style="font-size:12px;color:var(--label-tertiary);margin-top:2px">다음에 열 때 로그인 화면을 건너뜁니다</div></div>' +
          '<button class="sw" role="switch" aria-checked="' + (a.remember ? 'true' : 'false') +
            '" data-act="toggleRemember" aria-label="자동 로그인"><span></span></button></div>' : '') +

        (isLogin ? '' : renderAgree()) +

        (a.error ? '<div role="alert" style="margin-top:14px;font-size:13px;font-weight:600;color:#FF3B30;' +
          'background:color-mix(in srgb, #FF3B30 12%, transparent);padding:10px 12px;border-radius:10px">' +
          esc(a.error) + '</div>' : '') +
        (a.notice ? '<div role="status" style="margin-top:14px;font-size:13px;font-weight:600;color:#34C759;' +
          'background:color-mix(in srgb, #34C759 14%, transparent);padding:10px 12px;border-radius:10px">' +
          esc(a.notice) + '</div>' : '') +

        '<div data-raise="tint" style="display:block;margin-top:20px">' +
          '<button class="btn btn-prominent btn-md" data-act="' + (isLogin ? 'login' : 'signup') + '" ' +
            'style="width:100%' + (blocked ? ';opacity:.45' : '') + '"' +
            (a.busy ? ' disabled' : '') + (blocked ? ' aria-disabled="true"' : '') + '>' +
            (a.busy ? '잠시만요…' : isLogin ? '로그인' : '가입 신청하기') + '</button></div>' +
        (isLogin ? '' : '<div style="margin-top:12px;font-size:12px;line-height:1.5;color:var(--label-tertiary);text-align:center">' +
          '관리자가 신청을 수락하면 로그인할 수 있습니다.</div>') +
      '</div></div></div>';
}

// ---------------------------------------------------------------- 설정 시트
// 계정 정보 + 위험 구역(탈퇴). 관리자에게는 탈퇴 자리에 안내만 보여 준다.
function renderSettingsSheet() {
  const u = state.user, d = state.del;
  const row = (k, v) => '<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 4px;' +
    'border-top:.5px solid var(--separator)">' +
    '<span style="font-size:14px;color:var(--label-secondary)">' + k + '</span>' +
    '<span class="trunc" style="font-size:14px;font-weight:600">' + esc(v) + '</span></div>';

  // 탈퇴 확인: PIN 을 다시 받는다. 실수로 누른 사람은 여기서 멈춘다.
  const danger = !canDeleteSelf(u)
    ? '<div style="font-size:13px;line-height:1.6;color:var(--label-tertiary);padding:4px">' +
        '관리자 계정은 여기에서 삭제할 수 없습니다. 다른 관리자에게 요청하거나, ' +
        'Firebase 콘솔에서 직접 처리하세요.</div>'
    : d
      ? '<div style="font-size:13px;line-height:1.6;color:var(--label-secondary);padding:2px 4px 10px">' +
          '계정과 할 일이 <strong>영구 삭제</strong>되며 되돌릴 수 없습니다.<br>' +
          '계속하려면 PIN 6자리를 다시 입력하세요.</div>' +
        '<input class="field" type="password" data-d="pin" inputmode="numeric" autocomplete="off" ' +
          'maxlength="6" placeholder="••••••" value="' + esc(d.pin) + '" ' +
          'style="padding:12px 14px;font-size:16px;letter-spacing:.35em">' +
        (d.error ? '<div role="alert" style="margin-top:10px;font-size:13px;font-weight:600;color:#FF3B30;' +
          'background:color-mix(in srgb, #FF3B30 12%, transparent);padding:10px 12px;border-radius:10px">' +
          esc(d.error) + '</div>' : '') +
        '<div style="display:flex;gap:10px;margin-top:14px">' +
          '<button class="btn btn-gray btn-md" data-act="cancelDelete" style="flex:1"' +
            (d.busy ? ' disabled' : '') + '>취소</button>' +
          '<button class="btn btn-gray btn-md" data-act="confirmDelete" style="flex:1;color:#FF3B30"' +
            (d.busy ? ' disabled' : '') + '>' + (d.busy ? '삭제 중…' : '영구 삭제') + '</button></div>'
      : '<button class="btn btn-gray btn-md" data-act="askDelete" style="width:100%;color:#FF3B30">' +
          '계정 삭제</button>' +
        '<div style="font-size:12px;line-height:1.5;color:var(--label-tertiary);margin-top:8px;padding:0 4px">' +
          '계정과 모든 할 일이 영구 삭제됩니다. 되돌릴 수 없습니다.</div>';

  return '<div data-act="closeSettings" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" aria-label="설정" style="pointer-events:auto;width:min(560px,100vw);' +
      'max-height:88vh;overflow:auto;background:var(--bg);border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);' +
      'padding:12px 20px 30px;animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">설정</h3>' +
        '<button data-act="closeSettings" aria-label="닫기" style="border:none;cursor:pointer;width:30px;height:30px;' +
          'border-radius:50%;background:var(--fill-tertiary);color:var(--label-secondary);display:flex;' +
          'align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +

      '<div style="font-size:13px;font-weight:700;color:var(--label-secondary);margin:18px 4px 2px">계정</div>' +
      row('이름', u.name) + row('이메일', u.email || '') +
      row('권한', u.role === 'admin' ? '관리자' : '일반 회원') +

      '<div style="font-size:13px;font-weight:700;color:#FF3B30;margin:22px 4px 8px">위험 구역</div>' +
      danger +

      '<div style="font-size:12px;line-height:1.6;color:var(--label-tertiary);margin-top:22px;padding:0 4px">' +
        '<a href="terms.html" target="_blank" rel="noopener">이용약관</a> · ' +
        '<a href="privacy.html" target="_blank" rel="noopener">개인정보 처리방침</a></div>' +
    '</div></div>';
}

// ---------------------------------------------------------------- 관리자 시트
const STATUS_LABEL = { pending: '승인 대기', approved: '승인됨', rejected: '거절됨' };

// 나이 구분 배지. 승인을 누르기 전에 만 14세 미만인지 보라고 붙인다.
// 약관 도입(1.0) 전에 가입한 계정에는 agreements 가 아예 없다 — 그 계정의 로그인은
// 그대로 되고(규칙은 create 만 검사한다) 여기서 "약관 미동의" 로 식별만 한다.
const AGE_BADGE = {
  over14: ['만 14세 이상', 'var(--label-secondary)'],
  under14_guardian: ['만 14세 미만 · 보호자 동의', '#FF9500']
};
function ageBadge(u) {
  const b = (u.agreements && AGE_BADGE[u.agreements.age]) || ['약관 미동의', 'var(--label-tertiary)'];
  return '<span style="flex:none;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;color:' +
    b[1] + ';background:color-mix(in srgb, ' + b[1] + ' 14%, transparent)">' + b[0] + '</span>';
}

function renderAdminSheet() {
  const joined = (u) => (u.createdAt && u.createdAt.toDate ? fmt(u.createdAt.toDate()) + ' 신청' : '');
  const heading = (t) => '<div style="font-size:13px;font-weight:700;color:var(--label-secondary);' +
    'margin:20px 4px 2px;letter-spacing:.2px">' + t + '</div>';
  const empty = (t) => '<div style="padding:28px 4px;text-align:center;font-size:15px;font-weight:600;' +
    'color:var(--label-secondary)">' + t + '</div>';
  const row = (i, inner) => '<div style="display:flex;align-items:center;gap:12px;padding:14px 4px;border-top:' +
    (i === 0 ? 'none' : '.5px solid var(--separator)') + '">' + inner + '</div>';

  const pend = pendingUsers();
  const pendRows = pend.length ? pend.map((u, i) => row(i,
    '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
        '<span style="font-size:16px;font-weight:600">' + esc(u.name) + '</span>' + ageBadge(u) + '</div>' +
      '<div class="trunc" style="font-size:13px;color:var(--label-secondary);margin-top:1px">' +
        esc(u.email || '') + (joined(u) ? ' · ' + esc(joined(u)) : '') + '</div></div>' +
    '<button class="btn btn-gray btn-sm" data-reject="' + esc(u.uid) + '" style="color:#FF3B30">거절</button>' +
    '<span data-raise="tint" style="display:inline-flex">' +
      '<button class="btn btn-prominent btn-sm" data-approve="' + esc(u.uid) + '">수락</button></span>'
  )).join('') : empty('대기 중인 신청이 없습니다');

  const all = state.users.slice().sort((x, y) => (x.name || '').localeCompare(y.name || ''));
  const allRows = all.length ? all.map((u, i) => row(i,
    '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
        '<span style="font-size:16px;font-weight:600">' + esc(u.name) + '</span>' +
        (u.role === 'admin' ? '<span style="font-size:11px;font-weight:600;color:var(--tint)">관리자</span>' : '') +
        ageBadge(u) + '</div>' +
      '<div class="trunc" style="font-size:13px;color:var(--label-secondary);margin-top:1px">' +
        esc(u.email || '') + ' · ' + esc(STATUS_LABEL[u.status] || u.status || '') + '</div></div>' +
    '<button class="btn btn-gray btn-sm" data-resetpin="' + esc(u.uid) + '">PIN 재설정 메일</button>' +
    // 본인 계정에는 삭제 버튼을 아예 그리지 않는다.
    (u.uid === state.user.uid ? '' :
      '<button class="btn btn-gray btn-sm" data-delacct="' + esc(u.uid) + '" ' +
        'style="color:#FF3B30">완전 삭제</button>')
  )).join('') : empty('회원이 없습니다');

  return '<div data-act="closeAdmin" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" style="pointer-events:auto;width:min(560px,100vw);max-height:88vh;overflow:auto;' +
      'background:var(--bg);border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">회원 관리</h3>' +
        '<button data-act="closeAdmin" aria-label="닫기" style="border:none;cursor:pointer;width:30px;height:30px;' +
          'border-radius:50%;background:var(--fill-tertiary);color:var(--label-secondary);display:flex;' +
          'align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +

      heading('회원가입 신청') + pendRows +
      heading('전체 회원') + allRows +

      heading('데이터 이전') +
      '<div style="font-size:12px;line-height:1.5;color:var(--label-tertiary);margin:6px 4px 10px">' +
        '이 기기의 localStorage에 남아 있는 할 일을 내 계정으로 한 번 올립니다.</div>' +
      '<button class="btn btn-gray btn-md" data-act="migrate" style="width:100%">' +
        'localStorage → Firestore 업로드</button>' +
    '</div></div>';
}
