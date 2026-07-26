// Firebase 연동 — 인증 · Firestore 동기화.
//
// 이 파일만 ESM 모듈이다. 모듈은 클래식 스크립트 3개(auth/calendar/todo)보다
// 나중에 실행되므로, 그 사이 화면은 state.booting 로딩 상태를 보여준다.
// 모듈 스코프에서 전역 렉시컬 바인딩(state, render, blankAuth …)을 그대로 읽을
// 수 있어서 나머지 세 파일은 손대지 않고 클래식 스크립트로 남는다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence,
  deleteUser, reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch,
  onSnapshot, arrayUnion, arrayRemove, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const todosCol = () => collection(db, 'users', auth.currentUser.uid, 'todos');
const todoRef = (id) => doc(db, 'users', auth.currentUser.uid, 'todos', id);

function fail(msg, e) {
  console.error(e);
  alert(msg + ': ' + ((e && e.message) || e));
}

// ---------------------------------------------------------------- 인증
const LOGIN_FAIL = '이름 또는 PIN이 올바르지 않습니다.';
const SIGNUP_ERR = {
  'auth/email-already-in-use': '이미 가입된 이메일 주소입니다.',
  'auth/invalid-email': '이메일 주소 형식이 올바르지 않습니다.',
  'auth/weak-password': 'PIN은 숫자 6자리여야 합니다.',
  // 필수 동의가 빠지면 보안 규칙이 users 문서 생성을 거부한다. 화면에서 이미
  // 걸러지므로 여기까지 왔다면 규칙과 클라이언트가 어긋났다는 뜻이다.
  'permission-denied': '필수 약관에 동의해야 가입할 수 있습니다.'
};

// 회원가입 중에는 인증 상태 변화를 무시한다 — 계정 생성 직후 자동 로그인이
// 걸리는데, 그 시점엔 users 문서가 아직 없어서 핸들러가 헛돈다.
let busy = false;
let unsubTodos = null, unsubUsers = null;

function stopWatch() {
  if (unsubTodos) { unsubTodos(); unsubTodos = null; }
  if (unsubUsers) { unsubUsers(); unsubUsers = null; }
}

async function signIn(name, pin, remember) {
  // "자동 로그인" 스위치를 Firebase 세션 지속성에 그대로 매핑한다.
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  // 로그인 전이라 Auth 토큰이 없다 — usernames 는 규칙에서 get 만 공개돼 있다.
  const snap = await getDoc(doc(db, 'usernames', name));
  if (!snap.exists()) throw new Error(LOGIN_FAIL);
  try {
    await signInWithEmailAndPassword(auth, snap.data().email, pin);
  } catch (e) {
    // 이름이 없는지 PIN이 틀렸는지 구분해서 알려주지 않는다.
    throw new Error(LOGIN_FAIL);
  }
  // 이후 화면 전환은 onAuthStateChanged 가 맡는다.
}

async function signUp(name, email, pin, agree) {
  // 이름 중복은 usernames 문서 존재 여부로 막는다.
  if ((await getDoc(doc(db, 'usernames', name))).exists()) throw new Error('이미 사용 중인 이름입니다.');
  busy = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pin);
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', cred.user.uid), {
      name, email, role: 'user', status: 'pending', createdAt: serverTimestamp(),
      // 동의 내역은 계정 문서와 같은 batch 로 들어간다. 보안 규칙이 필수 항목을
      // 다시 검사하므로, 동의 없이 만들어진 계정 문서는 존재할 수 없다.
      // 버전은 LEGAL(js/legal.js) 한 곳에서 온다 — 본문과 기록이 어긋나지 않는다.
      agreements: {
        terms:   { agreed: !!agree.terms,   version: LEGAL.version, at: serverTimestamp() },
        privacy: { agreed: !!agree.privacy, version: LEGAL.version, at: serverTimestamp() },
        age: agree.age,
        marketing: !!agree.marketing
      }
    });
    batch.set(doc(db, 'usernames', name), { uid: cred.user.uid, email });
    await batch.commit();
    await signOut(auth);
  } catch (e) {
    // 계정만 만들어지고 문서 생성이 실패하면 반쪽 상태로 남는다. 로그아웃해 두면
    // 다음 로그인 때 "계정 정보를 찾을 수 없습니다"로 걸려서 조용히 넘어가지 않는다.
    if (auth.currentUser) await signOut(auth).catch(() => {});
    throw new Error(SIGNUP_ERR[e.code] || ('가입에 실패했습니다. (' + (e.code || e.message) + ')'));
  } finally {
    busy = false;
  }
}

function applyLoggedOut() {
  stopWatch();
  state.user = null;
  state.users = [];
  state.items = [];
  state.showForm = false;
  state.showAdmin = false;
  state.booting = false;
  // state.auth 는 건드리지 않는다 — 로그인 실패 사유·가입 완료 안내가 여기 남아 있다.
  render();
}

onAuthStateChanged(auth, async (u) => {
  if (busy) return;
  if (!u) return applyLoggedOut();

  let data = null;
  try {
    const snap = await getDoc(doc(db, 'users', u.uid));
    data = snap.exists() ? snap.data() : null;
  } catch (e) {
    fail('계정 정보를 불러오지 못했습니다', e);
  }

  // 승인 대기·거절 계정은 Auth 로그인 자체는 되지만 여기서 잘라낸다.
  // 데이터 접근은 보안 규칙이 따로 막는다 (화면 검사만 믿지 않는다).
  if (!data || data.status !== 'approved') {
    await signOut(auth).catch(() => {});
    state.auth.error = !data ? '계정 정보를 찾을 수 없습니다.'
      : data.status === 'pending' ? '관리자 승인을 기다리는 중입니다.'
      : '가입 신청이 거절된 계정입니다.';
    return applyLoggedOut();
  }

  state.user = { uid: u.uid, name: data.name, email: data.email, role: data.role, status: data.status };
  state.auth = blankAuth();
  state.booting = false;
  watch(state.user);
  render();
});

// ---------------------------------------------------------------- 실시간 동기화
function watch(user) {
  stopWatch();
  unsubTodos = onSnapshot(todosCol(), (snap) => {
    state.items = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    // 입력 시트가 열려 있는 동안은 렌더를 미룬다 — render() 는 #app 을 통째로
    // 다시 만들기 때문에 원격 변경이 올 때마다 시트가 튄다. 시트를 닫을 때의
    // render() 가 이미 갱신된 state.items 를 그대로 집어간다.
    if (!state.showForm) render();
  }, (e) => fail('할 일을 불러오지 못했습니다', e));

  if (user.role !== 'admin') return;
  unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
    state.users = snap.docs.map((d) => Object.assign({ uid: d.id }, d.data()));
    if (!state.showForm) render();
  }, (e) => fail('회원 목록을 불러오지 못했습니다', e));
}

// ---------------------------------------------------------------- 할 일 쓰기
// 문서 id 는 Firestore 가 만든다 — 예전 uid() 는 기기 간 충돌 가능성이 있었다.
const newId = () => doc(todosCol()).id;
const saveTodo = (id, data) => setDoc(todoRef(id), data, { merge: true });
const removeTodo = (id) => deleteDoc(todoRef(id));

// 완료 체크는 배열을 통째로 바꾸지 않는다. 두 기기에서 같은 날 체크하면 한쪽
// 갱신이 사라지기(lost update) 때문에 arrayUnion / arrayRemove 를 쓴다.
const setToggle = (id, ds, repeating, on) =>
  updateDoc(todoRef(id), repeating ? { doneDates: on ? arrayUnion(ds) : arrayRemove(ds) } : { done: on });

// ---------------------------------------------------------------- 관리자
const setStatus = (uid, status) => updateDoc(doc(db, 'users', uid), { status });
const resetPin = (email) => sendPasswordResetEmail(auth, email);

// 계정 완전 삭제. 되돌릴 수 없다.
//
// 부모 문서를 지워도 서브컬렉션은 그대로 남는다 — 클라이언트 SDK 에 재귀 삭제가
// 없어서 todos 를 직접 훑어 지운다. writeBatch 가 500개 한계라 나눠 커밋한다.
//
// ponytail: Auth 계정은 여기서 못 지운다. 남의 계정 삭제는 Admin SDK(=Cloud
// Function) 가 있어야 하는데, 그것 하나 때문에 함수를 띄우는 대신 콘솔에서
// 지우라고 안내한다. 지우지 않아도 users 문서가 없어서 로그인은 막힌다.
async function deleteAccount(uid, name) {
  const todos = await getDocs(collection(db, 'users', uid, 'todos'));
  for (let i = 0; i < todos.docs.length; i += 400) {
    const chunk = writeBatch(db);
    todos.docs.slice(i, i + 400).forEach((d) => chunk.delete(d.ref));
    await chunk.commit();
  }
  // 계정 문서는 맨 마지막에 지운다. 중간에 끊겨도 목록에 남아 있어서 다시
  // 누르면 이어서 정리된다 — 먼저 지우면 흔적 없는 고아 데이터가 된다.
  //
  // usernames 를 users 보다 앞에 적는다. 배치 안에서는 규칙이 커밋 전 상태로
  // 평가되므로 이 순서가 결과를 바꾸지는 않지만, 규칙이 참조하는 문서(users)를
  // 나중에 지우는 형태로 읽히는 편이 안전하다. 진짜 방어는 규칙 쪽의 exists()
  // 검사와 usernames delete 의 본인-우선 조건이다.
  //
  // 둘을 한 배치로 묶는 건 의도적이다. 쪼개서 usernames 만 지워지고 끊기면 계정은
  // 살아 있는데 이름 색인이 없어져 본인이 로그인조차 못 하고(signIn 이
  // usernames/{name} 을 먼저 찾는다) 그 이름을 남이 선점할 수 있다.
  const last = writeBatch(db);
  if (name) last.delete(doc(db, 'usernames', name));
  last.delete(doc(db, 'users', uid));
  await last.commit();
  return todos.docs.length;
}

// localStorage → Firestore 1회 업로드. 계정 도입 전 데이터(todo-cal-v1)와
// 계정별 데이터(todo-cal-v1:<옛 id>) 중 지금 로그인한 이름과 맞는 쪽을 올린다.
function localItems(name) {
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const old = read('todo-cal-users-v1');
  const me = Array.isArray(old) ? old.find((u) => u.name === name) : null;
  const items = (me && read('todo-cal-v1:' + me.id)) || read('todo-cal-v1');
  return Array.isArray(items) ? items : [];
}

async function uploadLocal(name) {
  const items = localItems(name).filter((it) => it && it.title && it.date);
  if (!items.length) return 0;
  // ponytail: writeBatch 는 500개가 한계다. 개인 할 일 목록이 거기 닿을 일은
  // 없어서 쪼개지 않았다. 넘칠 일이 생기면 500개씩 나눠 커밋할 것.
  const batch = writeBatch(db);
  items.forEach((it) => batch.set(todoRef(it.id || newId()), {
    title: it.title, date: it.date, time: it.time || '',
    pri: it.pri || 'none', repeat: it.repeat || 'none', memo: it.memo || '',
    done: !!it.done, doneDates: it.doneDates || []
  }));
  await batch.commit();
  return items.length;
}

// 본인 탈퇴. 관리자 삭제와 달리 Auth 계정까지 완전히 사라진다 — 본인 계정은
// deleteUser 로 클라이언트에서 지울 수 있어서 Cloud Function 이 필요 없다.
async function deleteSelf(pin) {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요합니다.');
  // Auth 는 계정 삭제 같은 민감한 작업에 최근 인증을 요구한다(requires-recent-login).
  // PIN 재입력을 여기에 물려서 실수 방지 확인과 재인증을 한 번에 끝낸다.
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pin));
  } catch (e) {
    throw new Error('PIN이 올바르지 않습니다.');
  }
  // Firestore 를 먼저 지운다. Auth 를 먼저 지우면 그 순간 권한을 잃어서 데이터가
  // 주인 없이 남는다 — 아무도 읽지도 지우지도 못하는 쓰레기가 된다.
  const n = await deleteAccount(u.uid, state.user && state.user.name);
  await deleteUser(u);
  // onAuthStateChanged 가 로그아웃 화면으로 넘긴다.
  return n;
}

// 클래식 스크립트 3개가 쓸 수 있게 전역으로 내보낸다.
window.fb = {
  signIn, signUp, signOutNow: () => signOut(auth),
  newId, saveTodo, removeTodo, setToggle,
  setStatus, resetPin, deleteAccount, deleteSelf, uploadLocal, fail
};
