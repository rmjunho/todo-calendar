'use strict';
// 로그인 · PIN · 자동 로그인. calendar.js / todo.js 보다 먼저 로드된다.

// ---------------------------------------------------------------- constants
const USERS_KEY = 'todo-cal-users-v1';
// v2: sessions written before auto-login became opt-in must not sign anyone in.
const SESSION_KEY = 'todo-cal-session-v2';
const ADMIN = { name: '이준호', pin: '4943' };

// ---------------------------------------------------------------- accounts
// ponytail: PINs are stored in plain localStorage and verified in the browser,
// so this gates casual access between people sharing a device — it is NOT
// security. Anyone with devtools can read or bypass it. Move verification
// server-side (and hash the PIN there) the moment this leaves one machine.
const validPin = (p) => /^\d{4,8}$/.test(p || '');
const normName = (n) => (n || '').trim();
const findUser = (users, name) => users.find((u) => u.name === normName(name));

function loadUsers() {
  let users = null;
  try { users = JSON.parse(localStorage.getItem(USERS_KEY)); } catch (e) {}
  if (!Array.isArray(users) || !users.length) {
    users = [{ id: uid(), name: ADMIN.name, pin: ADMIN.pin, role: 'admin', status: 'approved', at: fmt(new Date()) }];
    saveUsers(users);
  }
  return users;
}
function saveUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
}

// ---------------------------------------------------------------- auth
function startSession(user, remember) {
  state.user = user;
  state.items = load(user);
  state.auth = { mode: 'login', name: '', pin: '', pin2: '', remember: false, error: '', notice: '' };
  // Auto-login is opt-in: only a ticked switch lets the session survive a reload.
  try {
    if (remember) localStorage.setItem(SESSION_KEY, user.id);
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
  render();
}
function restoreSession() {
  let id = null;
  try { id = localStorage.getItem(SESSION_KEY); } catch (e) {}
  const u = id && state.users.find((x) => x.id === id && x.status === 'approved');
  if (u) { state.user = u; state.items = load(u); state.auth.remember = true; }
}
function logout() {
  state.user = null;
  state.items = [];
  state.showForm = false;
  state.showAdmin = false;
  // Logging out always clears the saved session, ticked or not, and unticks the
  // switch — whoever logs in next opts in for themselves.
  state.auth.remember = false;
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  render();
}
function login() {
  const a = state.auth;
  const u = findUser(state.users, a.name);
  a.notice = '';
  if (!u || u.pin !== a.pin) { a.error = '이름 또는 PIN이 올바르지 않습니다.'; return render(); }
  if (u.status === 'pending') { a.error = '관리자 승인을 기다리는 중입니다.'; return render(); }
  if (u.status === 'rejected') { a.error = '가입 신청이 거절된 계정입니다.'; return render(); }
  startSession(u, a.remember);
}
function signup() {
  const a = state.auth;
  const name = normName(a.name);
  a.notice = '';
  if (!name) { a.error = '이름을 입력해 주세요.'; return render(); }
  if (findUser(state.users, name)) { a.error = '이미 사용 중인 이름입니다.'; return render(); }
  if (!validPin(a.pin)) { a.error = 'PIN은 숫자 4~8자리로 입력해 주세요.'; return render(); }
  if (a.pin !== a.pin2) { a.error = 'PIN이 서로 다릅니다.'; return render(); }
  state.users = state.users.concat({
    id: uid(), name, pin: a.pin, role: 'user', status: 'pending', at: fmt(new Date())
  });
  saveUsers(state.users);
  state.auth = { mode: 'login', name, pin: '', pin2: '', error: '',
    notice: '회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.' };
  render();
}
function decide(id, status) {
  state.users = state.users.map((u) => (u.id === id ? Object.assign({}, u, { status }) : u));
  saveUsers(state.users);
  render();
}
const pendingUsers = () => state.users.filter((u) => u.status === 'pending');

// ---------------------------------------------------------------- login screen
function renderAuth() {
  const a = state.auth;
  const isLogin = a.mode === 'login';
  const tab = (mode, label) => {
    const on = a.mode === mode;
    return '<button class="seg' + (on ? ' seg-on' : '') + '" data-authmode="' + mode +
      '" style="flex:1;padding:0">' + label + '</button>';
  };
  const label = (t) => '<div style="font-size:13px;font-weight:600;color:var(--label-secondary);margin:14px 0 6px">' + t + '</div>';
  const pinField = (key, ph) => '<input class="field" type="password" data-a="' + key + '" inputmode="numeric" ' +
    'autocomplete="off" maxlength="8" placeholder="' + ph + '" value="' + esc(a[key]) + '" ' +
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

        label('PIN 번호' + (isLogin ? '' : ' (숫자 4~8자리)')) + pinField('pin', '••••') +
        (isLogin ? '' : label('PIN 번호 확인') + pinField('pin2', '••••')) +

        (isLogin ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px">' +
          '<div><div style="font-size:15px;font-weight:600">자동 로그인</div>' +
          '<div style="font-size:12px;color:var(--label-tertiary);margin-top:2px">다음에 열 때 로그인 화면을 건너뜁니다</div></div>' +
          '<button class="sw" role="switch" aria-checked="' + (a.remember ? 'true' : 'false') +
            '" data-act="toggleRemember" aria-label="자동 로그인"><span></span></button></div>' : '') +

        (a.error ? '<div role="alert" style="margin-top:14px;font-size:13px;font-weight:600;color:#FF3B30;' +
          'background:color-mix(in srgb, #FF3B30 12%, transparent);padding:10px 12px;border-radius:10px">' +
          esc(a.error) + '</div>' : '') +
        (a.notice ? '<div role="status" style="margin-top:14px;font-size:13px;font-weight:600;color:#34C759;' +
          'background:color-mix(in srgb, #34C759 14%, transparent);padding:10px 12px;border-radius:10px">' +
          esc(a.notice) + '</div>' : '') +

        '<div data-raise="tint" style="display:block;margin-top:20px">' +
          '<button class="btn btn-prominent btn-md" data-act="' + (isLogin ? 'login' : 'signup') + '" ' +
            'style="width:100%">' + (isLogin ? '로그인' : '가입 신청하기') + '</button></div>' +
        (isLogin ? '' : '<div style="margin-top:12px;font-size:12px;line-height:1.5;color:var(--label-tertiary);text-align:center">' +
          '관리자가 신청을 수락하면 로그인할 수 있습니다.</div>') +
      '</div></div></div>';
}

// ---------------------------------------------------------------- admin sheet
function renderAdminSheet() {
  const list = pendingUsers();
  const rows = list.length ? list.map((u, i) =>
    '<div style="display:flex;align-items:center;gap:12px;padding:14px 4px;border-top:' +
      (i === 0 ? 'none' : '.5px solid var(--separator)') + '">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:16px;font-weight:600">' + esc(u.name) + '</div>' +
        '<div style="font-size:13px;color:var(--label-secondary);margin-top:1px">' + esc(u.at) + ' 신청</div></div>' +
      '<button class="btn btn-gray btn-sm" data-reject="' + esc(u.id) + '" style="color:#FF3B30">거절</button>' +
      '<span data-raise="tint" style="display:inline-flex">' +
        '<button class="btn btn-prominent btn-sm" data-approve="' + esc(u.id) + '">수락</button></span>' +
    '</div>').join('')
    : '<div style="padding:34px 4px;text-align:center">' +
      '<div style="font-size:15px;font-weight:600;color:var(--label-secondary)">대기 중인 신청이 없습니다</div></div>';

  return '<div data-act="closeAdmin" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.35);animation:tcFade .2s ease-out"></div>' +
    '<div style="position:fixed;left:0;right:0;bottom:0;z-index:101;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="dialog" aria-modal="true" style="pointer-events:auto;width:min(560px,100vw);max-height:88vh;overflow:auto;' +
      'background:var(--bg);border-radius:20px 20px 0 0;box-shadow:var(--shadow-3);padding:12px 20px 30px;' +
      'animation:tcSheet .3s cubic-bezier(.34,1.3,.64,1)">' +
      '<div style="width:38px;height:5px;border-radius:3px;background:var(--fill-secondary);margin:0 auto 12px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<h3 style="margin:0;font-size:19px;font-weight:700">회원가입 신청</h3>' +
        '<button data-act="closeAdmin" aria-label="닫기" style="border:none;cursor:pointer;width:30px;height:30px;' +
          'border-radius:50%;background:var(--fill-tertiary);color:var(--label-secondary);display:flex;' +
          'align-items:center;justify-content:center;padding:0">' + icon('xmark', 14) + '</button></div>' +
      rows + '</div></div>';
}
