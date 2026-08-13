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
const catsCol = () => collection(db, 'users', auth.currentUser.uid, 'categories');
const catRef = (id) => doc(db, 'users', auth.currentUser.uid, 'categories', id);

function fail(msg, e) {
  console.error(e);
  alert(msg + ': ' + ((e && e.message) || e));
}

// ---------------------------------------------------------------- 인증
// 문자열은 i18n.js 에서 온다. 상수로 굳혀 두면 로드 시점의 언어에 고정되므로
// 값이 아니라 키만 들고 있다가 던질 때 t() 로 푼다.
const SIGNUP_ERR = {
  'auth/email-already-in-use': 'err.emailUsed',
  'auth/invalid-email': 'err.emailBad',
  'auth/weak-password': 'err.weakPin',
  // 필수 동의가 빠지면 보안 규칙이 users 문서 생성을 거부한다. 화면에서 이미
  // 걸러지므로 여기까지 왔다면 규칙과 클라이언트가 어긋났다는 뜻이다.
  'permission-denied': 'err.needAgree'
};

// 회원가입 중에는 인증 상태 변화를 무시한다 — 계정 생성 직후 자동 로그인이
// 걸리는데, 그 시점엔 users 문서가 아직 없어서 핸들러가 헛돈다.
let busy = false;
let unsubTodos = null, unsubUsers = null, unsubCats = null;

function stopWatch() {
  if (unsubTodos) { unsubTodos(); unsubTodos = null; }
  if (unsubUsers) { unsubUsers(); unsubUsers = null; }
  if (unsubCats) { unsubCats(); unsubCats = null; }
}

async function signIn(name, pin, remember) {
  // "자동 로그인" 스위치를 Firebase 세션 지속성에 그대로 매핑한다.
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  // 로그인 전이라 Auth 토큰이 없다 — usernames 는 규칙에서 get 만 공개돼 있다.
  const snap = await getDoc(doc(db, 'usernames', name));
  if (!snap.exists()) throw new Error(t('err.login'));
  try {
    await signInWithEmailAndPassword(auth, snap.data().email, pin);
  } catch (e) {
    // 이름이 없는지 PIN이 틀렸는지 구분해서 알려주지 않는다.
    throw new Error(t('err.login'));
  }
  // 이후 화면 전환은 onAuthStateChanged 가 맡는다.
}

async function signUp(name, email, pin, agree) {
  // 이름 중복은 usernames 문서 존재 여부로 막는다.
  if ((await getDoc(doc(db, 'usernames', name))).exists()) throw new Error(t('err.nameTaken'));
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
    throw new Error(SIGNUP_ERR[e.code] ? t(SIGNUP_ERR[e.code]) : t('err.signup', e.code || e.message));
  } finally {
    busy = false;
  }
}

function applyLoggedOut() {
  stopWatch();
  state.user = null;
  state.users = [];
  state.items = [];
  state.cats = [];
  state.filter = null;
  state.showForm = false;
  state.showAdmin = false;
  state.showCats = false;
  state.catDraft = null;
  state.booting = false;
  // ★ 열려 있던 시트를 전부 닫는다. 안 닫으면 sheetBusy() 가 영영 true 로 남아
  //   재로그인 후 원격 스냅샷이 화면에 절대 안 들어온다. exp 는 objectURL 도 샌다.
  if (state.exp && state.exp.url) URL.revokeObjectURL(state.exp.url);
  state.exp = null;
  state.jump = null;
  state.showSettings = false;
  state.del = null;
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
    fail(t('err.loadProfile'), e);
  }

  // 승인 대기·거절 계정은 Auth 로그인 자체는 되지만 여기서 잘라낸다.
  // 데이터 접근은 보안 규칙이 따로 막는다 (화면 검사만 믿지 않는다).
  if (!data || data.status !== 'approved') {
    await signOut(auth).catch(() => {});
    state.auth.error = !data ? t('err.noProfile')
      : data.status === 'pending' ? t('err.pending')
      : t('err.rejected');
    return applyLoggedOut();
  }

  state.user = { uid: u.uid, name: data.name, email: data.email, role: data.role, status: data.status };
  state.auth = blankAuth();
  state.booting = false;
  // 원격 설정이 로컬을 덮는다. 다만 원격에 없는 키는 로컬 값이 살아남고,
  // 그때는 곧바로 승격해 저장한다 — 로그인 화면에서 고른 언어가 사라지지 않고,
  // settings 필드가 아예 없는 옛 계정도 다음 로그인부터는 갖추게 된다.
  //
  // 실패해도 로그인은 막지 않는다. localStorage 에 남아 있어 이 기기에서는
  // 그대로 동작하고, 다음 로그인 때 다시 승격을 시도한다.
  if (!adoptSettings(data.settings)) {
    saveSettings().catch((e) => console.warn('설정 승격 실패 (로컬 값은 유효):', e));
  }
  watch(state.user);
  render();
});

// ---------------------------------------------------------------- 실시간 동기화
function watch(user) {
  stopWatch();
  unsubTodos = onSnapshot(todosCol(), (snap) => {
    state.items = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    // 시트(입력·이미지 미리보기)가 열려 있는 동안은 렌더를 미룬다 — render() 는
    // #app 을 통째로 다시 만들기 때문에 원격 변경이 올 때마다 시트가 튄다.
    // 시트를 닫을 때의 render() 가 이미 갱신된 state.items 를 그대로 집어간다.
    if (!sheetBusy()) render();
  }, (e) => fail(t('err.loadTodos'), e));

  // 카테고리. 이름순으로 세워 두는 것은 **여기 한 곳**이다 — 필터 칩 줄과 관리
  // 시트와 폼 칩이 같은 배열을 그대로 쓰므로 순서가 세 군데서 갈리지 않는다.
  // localeCompare 는 화면 순서용이라 써도 된다(정렬 결과가 저장 키가 되지 않는다).
  unsubCats = onSnapshot(catsCol(), (snap) => {
    state.cats = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    // ★ 보고 있던 카테고리가 다른 기기에서 지워졌으면 필터를 푼다. 안 풀면
    //   빈 화면만 남고 되돌릴 칩도 사라져 사용자가 갇힌다.
    if (state.filter && !state.cats.some((c) => c.id === state.filter)) state.filter = null;
    if (!sheetBusy()) render();
  }, (e) => fail(t('err.loadTodos'), e));

  if (user.role !== 'admin') return;
  unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
    state.users = snap.docs.map((d) => Object.assign({ uid: d.id }, d.data()));
    if (!sheetBusy()) render();
  }, (e) => fail(t('err.loadUsers'), e));
}

// 화면 설정. 규칙이 hasOnly(['settings']) 를 보므로 다른 필드를 같이 보내면
// 통째로 거부된다 — theme/lang 두 키만 담은 맵을 통으로 교체한다.
//
// 세션이 없으면 조용히 넘어간다. 로그아웃 직후·탈퇴 직후처럼 state.user 는 아직
// 남아 있는데 auth.currentUser 가 먼저 비는 순간이 있는데, 여기서 currentUser.uid
// 를 그냥 읽으면 promise 가 아니라 동기 TypeError 가 나서 호출부의 .catch 가
// 아예 붙지 못한다. 값은 이미 localStorage 에 있고 다음 로그인 때 승격되므로
// 이 경우 할 일이 없는 게 맞다.
const saveSettings = () =>
  auth.currentUser
    ? updateDoc(doc(db, 'users', auth.currentUser.uid),
        { settings: { theme: SETTINGS.theme, lang: SETTINGS.lang } })
    : Promise.resolve();

// ---------------------------------------------------------------- 할 일 쓰기
// 문서 id 는 Firestore 가 만든다 — 예전 uid() 는 기기 간 충돌 가능성이 있었다.
const newId = () => doc(todosCol()).id;
const saveTodo = (id, data) => setDoc(todoRef(id), data, { merge: true });
const removeTodo = (id) => deleteDoc(todoRef(id));

// 카테고리 쓰기. 규칙이 hasOnly(['name','color']) 를 보므로 다른 키를 섞으면
// 통째로 거부된다 — merge 를 쓰지 않고 두 키짜리 문서를 통으로 교체한다.
//
// ★ removeCat 은 **카테고리 문서 하나만** 지운다. 그 카테고리를 쓰던 할 일은
//   건드리지 않는다 — 죽은 id 는 catOf() 가 '없음' 으로 떨어뜨린다(calendar.js).
//   일괄 재작성을 안 하는 이유: batch 500 한계 · 부분 실패 · 오프라인이던 다른
//   기기가 나중에 올린 항목은 어차피 죽은 id 를 가리켜 폴백이 필요하다.
const newCatId = () => doc(catsCol()).id;
const saveCat = (id, name, color) => setDoc(catRef(id), { name, color });
const removeCat = (id) => deleteDoc(catRef(id));

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
  // ★ categories 도 서브컬렉션이라 같은 이유로 직접 훑어 지운다 — 빠뜨리면
  //   계정을 지워도 카테고리 문서가 고아로 남는다. 개수가 팔레트 크기(10)로
  //   묶여 있어 배치를 나눌 필요는 없지만, 형태는 todos 와 같게 둔다.
  const cats = await getDocs(collection(db, 'users', uid, 'categories'));
  if (cats.docs.length) {
    const cb = writeBatch(db);
    cats.docs.forEach((d) => cb.delete(d.ref));
    await cb.commit();
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
    categoryId: '', repeat: it.repeat || 'none', memo: it.memo || '',
    done: !!it.done, doneDates: it.doneDates || []
  }));
  await batch.commit();
  return items.length;
}

// 본인 탈퇴. 관리자 삭제와 달리 Auth 계정까지 완전히 사라진다 — 본인 계정은
// deleteUser 로 클라이언트에서 지울 수 있어서 Cloud Function 이 필요 없다.
async function deleteSelf(pin) {
  const u = auth.currentUser;
  if (!u) throw new Error(t('err.needLogin'));
  // Auth 는 계정 삭제 같은 민감한 작업에 최근 인증을 요구한다(requires-recent-login).
  // PIN 재입력을 여기에 물려서 실수 방지 확인과 재인증을 한 번에 끝낸다.
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pin));
  } catch (e) {
    throw new Error(t('err.badPin'));
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
  newCatId, saveCat, removeCat,
  setStatus, resetPin, deleteAccount, deleteSelf, uploadLocal, saveSettings, fail
};
