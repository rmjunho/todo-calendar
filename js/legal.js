'use strict';
// 약관 본문의 단일 출처. 회원가입 모달(renderLegalSheet)과 단독 페이지
// terms.html / privacy.html 이 이 객체 하나를 같이 읽는다. 본문을 고칠 곳은
// 여기뿐이다 — 세 군데에 복사해 두면 반드시 어긋난다.
//
// 클래식 스크립트다. import/export 를 붙이지 말 것 (auth/calendar/todo 와 같은
// 전역 스코프를 쓰고, firebase.js 모듈은 전역 렉시컬 바인딩으로 LEGAL 을 읽는다).
//
// version 을 올리면 users/{uid}.agreements.{terms,privacy}.version 에 그대로
// 기록된다. 본문을 실질적으로 바꿨을 때만 올리고, 오타 수정은 그대로 둔다.

const LEGAL = {
  // 버전은 언어별로 나누지 않는다. 동의 기록은 "무엇에" 동의했는지를 남기는
  // 것이고, 그 대상은 정본인 한국어본 하나다.
  version: '1.0',

  ko: {
  terms: {
    title: '이용약관',
    body: `
<p class="meta">시행일: 2026년 7월 25일 · 버전 1.0</p>

<h2>제1조 (목적)</h2>
<p>이 약관은 개인이 운영하는 웹 서비스 <strong>할 일 캘린더</strong>(이하 "서비스")의
이용 조건과 절차, 이용자와 운영자의 권리·의무를 정하는 것을 목적으로 합니다.</p>

<h2>제2조 (계정)</h2>
<ul>
  <li>서비스는 <strong>승인제</strong>로 운영됩니다. 가입을 신청하면 운영자의 승인 후에
      로그인할 수 있습니다.</li>
  <li>로그인에는 <strong>이름과 6자리 PIN</strong>을 사용합니다. 이름은 다른 이용자와
      중복될 수 없습니다.</li>
  <li>PIN은 이용자 본인이 관리해야 합니다. PIN을 잊은 경우 가입 시 등록한 이메일로
      재설정 메일을 받을 수 있습니다.</li>
  <li>계정을 타인에게 양도하거나 공유할 수 없습니다.</li>
</ul>

<h2>제3조 (서비스의 내용)</h2>
<p>서비스는 할 일과 일정을 기록·조회하고 여러 기기 간에 동기화하는 기능을 제공합니다.
서비스는 <strong>무상</strong>으로 제공됩니다.</p>

<h2>제4조 (이용자의 의무)</h2>
<ul>
  <li>타인의 계정을 도용하거나 서비스를 부정한 방법으로 이용해서는 안 됩니다.</li>
  <li>법령을 위반하거나 타인의 권리를 침해하는 내용을 저장해서는 안 됩니다.</li>
  <li>서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.</li>
</ul>

<h2>제5조 (서비스의 변경 및 중단)</h2>
<p>운영자는 서비스의 내용을 변경하거나 제공을 중단할 수 있습니다. 서비스를 종료할 때에는
가능한 범위에서 사전에 공지하고, 이용자가 데이터를 내려받을 수 있도록 합니다.</p>

<h2>제6조 (데이터와 이용 종료)</h2>
<ul>
  <li>이용자가 저장한 할 일·일정 데이터는 이용자의 것입니다.</li>
  <li>탈퇴를 원하는 경우 운영자에게 요청하면 계정과 데이터를 삭제합니다.
      삭제된 데이터는 <strong>복구할 수 없습니다.</strong></li>
  <li>제4조를 위반한 경우 운영자는 계정의 이용을 정지하거나 거절할 수 있습니다.</li>
</ul>

<h2>제7조 (면책)</h2>
<p>서비스는 개인이 무상으로 운영하며, 천재지변·통신 장애·외부 서비스(Google Firebase 등)의
장애 등 운영자의 통제를 벗어난 사유로 발생한 손해에 대해서는 책임을 지지 않습니다.
<strong>중요한 데이터는 별도로 백업해 두시기를 권장합니다.</strong></p>

<h2>제8조 (약관의 변경)</h2>
<p>이 약관은 변경될 수 있습니다. 변경 시에는 서비스 화면에 공지하며, 변경된 약관은
공지한 시점부터 적용됩니다. 변경 내용에 동의하지 않는 경우 이용을 중단하고
탈퇴를 요청할 수 있습니다.</p>

<h2>제9조 (준거법 및 분쟁 해결)</h2>
<p>이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생한 경우
운영자와 이용자는 성실히 협의하여 해결합니다.</p>

<h2>제10조 (준거 언어)</h2>
<p><strong>본 약관은 한국어본을 정본으로 하며, 영문본은 참고용입니다.</strong>
두 본문의 해석이 서로 다른 경우 한국어본이 우선합니다.</p>
`
  },

  privacy: {
    title: '개인정보 처리방침',
    body: `
<p class="meta">시행일: 2026년 7월 25일 · 버전 1.0</p>
<p><strong>할 일 캘린더</strong>(이하 "서비스")는 아래 항목만 수집하며, 목적 외로
이용하지 않습니다.</p>

<h2>1. 수집하는 개인정보 항목과 이용 목적</h2>
<table>
  <tr><th>항목</th><th>이용 목적</th><th>필수 여부</th></tr>
  <tr><td>이름</td><td>서비스 내 이용자 식별 및 로그인 아이디</td><td>필수</td></tr>
  <tr><td>이메일 주소</td><td>PIN 재설정 메일 발송, 운영자의 연락</td><td>필수</td></tr>
  <tr><td>PIN(6자리)</td>
      <td>로그인 인증. Firebase Authentication에 <strong>해시 형태로만</strong> 저장되며
          운영자와 서비스는 <strong>원문을 보관하지 않고 확인할 수도 없습니다.</strong></td>
      <td>필수</td></tr>
  <tr><td>할 일·일정 데이터<br>(제목, 종류, 날짜, 기간, 시간, 카테고리, 반복, 메모, 완료 여부),<br>
          <strong>목표 데이터</strong>(제목, 기한, 카테고리, 메모, 달성 여부),<br>
          및 이용자가 만든 <strong>카테고리 이름·색</strong></td>
      <td>서비스 제공(기록·조회·기기 간 동기화)</td><td>필수</td></tr>
  <tr><td>약관 동의 내역<br>(동의 항목, 버전, 시각, 나이 구분)</td>
      <td>동의 사실의 증빙, 만 14세 미만 이용자 확인</td><td>필수</td></tr>
</table>
<p>이름·이메일·PIN은 <strong>가입 시 이용자가 직접 입력</strong>한 정보이며, 그 외에
자동으로 수집되는 정보(광고 식별자, 위치 정보, 연락처, 사진 등)는 <strong>없습니다.</strong>
서비스는 광고를 게재하지 않고 분석 도구를 사용하지 않습니다.</p>

<h2>2. 보유 및 이용 기간</h2>
<ul>
  <li>보유 기간: <strong>회원 탈퇴 시까지</strong></li>
  <li>탈퇴 시 계정 정보와 할 일·일정 데이터를 <strong>즉시 파기</strong>합니다.
      (전자적 파일은 복구할 수 없는 방법으로 삭제)</li>
  <li>법령에 따라 별도로 보관해야 하는 정보는 없습니다.</li>
</ul>

<h2>3. 제3자 제공</h2>
<p>서비스는 이용자의 개인정보를 <strong>제3자에게 제공하지 않습니다.</strong>
판매·대여하지 않으며, 광고 목적으로 활용하지 않습니다.</p>

<h2>4. 처리 위탁</h2>
<p>서비스 운영에 필요한 범위에서 아래와 같이 개인정보 처리를 위탁하고 있습니다.</p>
<table>
  <tr><th>수탁자</th><th>위탁 업무</th><th>데이터 보관 위치</th></tr>
  <tr><td>Google LLC<br>(Google Firebase)</td>
      <td>계정 인증(Firebase Authentication),
          데이터 저장 및 동기화(Cloud Firestore)</td>
      <td><strong>asia-northeast3 (대한민국 서울)</strong></td></tr>
</table>
<p>수탁자는 위탁받은 업무 목적 외로 개인정보를 이용할 수 없습니다.</p>

<h2>5. 만 14세 미만 아동의 개인정보</h2>
<p>만 14세 미만 아동은 <strong>법정대리인(보호자)의 동의를 받은 후</strong>에만
서비스를 이용할 수 있습니다. 가입 시 나이 구분을 확인하며, 법정대리인은 아동의
개인정보 열람·정정·삭제 및 처리 정지를 요구할 수 있습니다.</p>

<h2>6. 정보주체의 권리와 행사 방법</h2>
<ul>
  <li>이용자는 언제든지 자신의 개인정보에 대한 <strong>열람·정정·삭제·처리 정지</strong>를
      요구할 수 있습니다.</li>
  <li>할 일·일정 데이터는 서비스 화면에서 직접 수정·삭제할 수 있습니다.</li>
  <li>계정 삭제(탈퇴)는 앱의 <strong>설정 → 계정 삭제</strong>에서 직접 하실 수 있으며
      즉시 처리됩니다.</li>
  <li><strong>가입 승인을 받지 못했거나 앱을 이미 삭제한 경우에도</strong>
      <a href="mailto:ij1481534943@gmail.com">ij1481534943@gmail.com</a> 으로 계정 삭제를
      요청하실 수 있습니다. 승인 대기·거절 상태이거나 로그인할 수 없으면 앱 안에서
      탈퇴할 수 없어, 이때는 이 주소가 유일한 창구입니다. 자세한 방법은
      <a href="delete-account.html">계정 삭제 요청 안내</a>를 참고해 주세요.</li>
</ul>

<h2>7. 안전성 확보 조치</h2>
<ul>
  <li>모든 통신은 <strong>HTTPS</strong>로 암호화됩니다.</li>
  <li>PIN은 원문을 저장하지 않고 Firebase Authentication의 해시로만 보관합니다.</li>
  <li>Firestore 보안 규칙으로 <strong>본인의 데이터에만</strong> 접근할 수 있도록
      서버에서 차단합니다. 이용자끼리는 서로의 할 일을 조회할 수 없습니다.</li>
  <li>운영자(관리자)는 <strong>계정 삭제(탈퇴) 처리를 위해</strong> 이용자의 할 일
      데이터, <strong>목표 데이터</strong>, <strong>카테고리 이름·색</strong>에 접근할 수
      있는 권한을 가집니다.
      이 권한은 삭제 처리 외의 목적으로 사용하지 않습니다.</li>
  <li>계정은 운영자 승인제로 운영되어 무단 가입을 차단합니다.</li>
</ul>

<h2>8. 개인정보 보호책임자 및 문의처</h2>
<p>이 서비스는 <strong>개인이 비영리로 운영</strong>하며 사업자 등록을 하지 않았습니다.
따라서 상호·대표자명·사업자등록번호·사업장 주소는 해당 사항이 없습니다.</p>
<table>
  <tr><th>개인정보 보호책임자</th><td>이준호</td></tr>
  <tr><th>문의·요청 이메일</th>
      <td><a href="mailto:ij1481534943@gmail.com">ij1481534943@gmail.com</a></td></tr>
</table>
<p>개인정보 열람·정정·삭제·처리 정지 요청과 계정 삭제(탈퇴) 요청을 위 주소로 보내
주시면 <strong>7일 이내</strong>에 처리하고 회신드립니다.</p>
<p><strong>가입 승인을 받지 못했거나 앱을 이미 삭제한 경우에도 이 주소로 계정 삭제를
요청하실 수 있습니다.</strong> 승인 대기·거절 상태에서는 앱에 로그인할 수 없어
앱 안에서 탈퇴할 수 없으므로, 이때는 이 주소가 유일한 창구입니다. 자세한 방법은
<a href="delete-account.html">계정 삭제 요청 안내</a>를 참고해 주세요.</p>
<p>개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의하실 수 있습니다.</p>
<ul>
  <li>개인정보침해 신고센터 — privacy.kisa.or.kr / 국번 없이 118</li>
  <li>개인정보 분쟁조정위원회 — kopico.go.kr / 1833-6972</li>
</ul>

<h2>9. 준거 언어</h2>
<p><strong>본 처리방침은 한국어본을 정본으로 하며, 영문본은 참고용입니다.</strong>
두 본문의 해석이 서로 다른 경우 한국어본이 우선합니다.</p>

<h2>10. 변경 이력</h2>
<ul>
  <li>버전 1.0 (2026년 7월 25일) — 최초 시행</li>
</ul>
<p>이 방침의 내용이 변경되는 경우 시행 7일 전부터 서비스 화면에 공지합니다.</p>
`
  }
  },

  // ------------------------------------------------------------------ English
  // 참고용 번역이다. 한국어본이 정본 — 본문을 고칠 때는 ko 를 먼저 고치고 맞출 것.
  en: {
  terms: {
    title: 'Terms of Service',
    body: `
<p class="meta">Effective 25 July 2026 · Version 1.0</p>

<h2>1. Purpose</h2>
<p>These terms set out the conditions of use and the rights and obligations of users and the
operator of <strong>Todo Calendar</strong> (the "Service"), a web service run by an individual.</p>

<h2>2. Accounts</h2>
<ul>
  <li>The Service is <strong>approval-based</strong>. After you request an account you can sign in
      only once the operator approves it.</li>
  <li>Signing in uses a <strong>name and a 6-digit PIN</strong>. Names must be unique across users.</li>
  <li>You are responsible for keeping your PIN safe. If you forget it, a reset email can be sent to
      the address you registered at sign-up.</li>
  <li>Accounts may not be transferred to or shared with anyone else.</li>
</ul>

<h2>3. What the Service does</h2>
<p>The Service lets you record and review to-dos and schedules and synchronise them across your
devices. The Service is provided <strong>free of charge</strong>.</p>

<h2>4. Your obligations</h2>
<ul>
  <li>Do not use another person's account or access the Service by improper means.</li>
  <li>Do not store content that breaks the law or infringes the rights of others.</li>
  <li>Do not interfere with the normal operation of the Service.</li>
</ul>

<h2>5. Changes to and suspension of the Service</h2>
<p>The operator may change the Service or stop providing it. If the Service is discontinued, notice
will be given in advance so far as reasonably possible, and users will be able to download their data.</p>

<h2>6. Data and ending your use</h2>
<ul>
  <li>The to-do and schedule data you store belongs to you.</li>
  <li>If you wish to leave, ask the operator and your account and data will be deleted.
      Deleted data <strong>cannot be recovered.</strong></li>
  <li>If you breach section 4, the operator may suspend or refuse the account.</li>
</ul>

<h2>7. Limitation of liability</h2>
<p>The Service is run by an individual free of charge. The operator is not liable for loss arising
from causes beyond the operator's control, such as natural disasters, network failures, or outages of
external services (Google Firebase and the like).
<strong>Please keep your own backup of anything important.</strong></p>

<h2>8. Changes to these terms</h2>
<p>These terms may change. Changes will be announced within the Service and take effect from the time
they are announced. If you do not accept a change, you may stop using the Service and ask to close
your account.</p>

<h2>9. Governing law and disputes</h2>
<p>These terms are interpreted under the laws of the Republic of Korea. If a dispute arises out of
the use of the Service, the operator and the user will make a good-faith effort to resolve it.</p>

<h2>10. Governing language</h2>
<p><strong>The Korean version of these terms is the authoritative text; the English version is
provided for reference only.</strong> If the two differ in meaning, the Korean version prevails.</p>
`
  },

  privacy: {
    title: 'Privacy Policy',
    body: `
<p class="meta">Effective 25 July 2026 · Version 1.0</p>
<p><strong>Todo Calendar</strong> (the "Service") collects only the items below and does not use
them for any other purpose.</p>

<h2>1. What is collected and why</h2>
<table>
  <tr><th>Item</th><th>Purpose</th><th>Required</th></tr>
  <tr><td>Name</td><td>Identifying you within the Service; used as your sign-in ID</td><td>Required</td></tr>
  <tr><td>Email address</td><td>Sending PIN reset emails; contact from the operator</td><td>Required</td></tr>
  <tr><td>PIN (6 digits)</td>
      <td>Sign-in authentication. Stored <strong>only as a hash</strong> in Firebase Authentication;
          neither the operator nor the Service <strong>keeps or can read the original.</strong></td>
      <td>Required</td></tr>
  <tr><td>To-do and schedule data<br>(title, kind, date, duration, time, category, repeat, note, completion),<br>
          <strong>goal data</strong> (title, deadline, category, note, completion),<br>
          and the <strong>category names and colours</strong> the user creates</td>
      <td>Providing the Service (recording, viewing, syncing across devices)</td><td>Required</td></tr>
  <tr><td>Consent records<br>(items agreed, version, time, age bracket)</td>
      <td>Evidence of consent; identifying users under 14</td><td>Required</td></tr>
</table>
<p>Your name, email and PIN are <strong>entered by you at sign-up</strong>. Nothing else is collected
automatically — <strong>no</strong> advertising identifiers, location, contacts or photos. The Service
shows no advertising and uses no analytics tools.</p>

<h2>2. Retention period</h2>
<ul>
  <li>Retained: <strong>until you close your account</strong></li>
  <li>On closure, your account information and to-do data are <strong>destroyed immediately</strong>
      (electronic files are deleted irrecoverably).</li>
  <li>There is no information the operator is required by law to retain separately.</li>
</ul>

<h2>3. Disclosure to third parties</h2>
<p>The Service <strong>does not provide your personal data to third parties.</strong> It is not sold
or rented, and it is not used for advertising.</p>

<h2>4. Processing entrusted to others</h2>
<p>To the extent needed to run the Service, processing is entrusted as follows.</p>
<table>
  <tr><th>Processor</th><th>Entrusted work</th><th>Data location</th></tr>
  <tr><td>Google LLC<br>(Google Firebase)</td>
      <td>Account authentication (Firebase Authentication),
          data storage and synchronisation (Cloud Firestore)</td>
      <td><strong>asia-northeast3 (Seoul, Republic of Korea)</strong></td></tr>
</table>
<p>The processor may not use personal data for any purpose beyond the entrusted work.</p>

<h2>5. Personal data of children under 14</h2>
<p>Children under 14 may use the Service only <strong>after obtaining the consent of a legal
guardian</strong>. The age bracket is confirmed at sign-up, and a legal guardian may request access
to, correction of, deletion of, or suspension of processing of the child's personal data.</p>

<h2>6. Your rights and how to exercise them</h2>
<ul>
  <li>You may at any time request <strong>access, correction, deletion, or suspension of
      processing</strong> of your personal data.</li>
  <li>To-do and schedule data can be edited and deleted directly in the Service.</li>
  <li>You can delete your account yourself under <strong>Settings → Delete account</strong>
      in the app; it takes effect immediately.</li>
  <li><strong>Even if your sign-up was not approved, or you have already removed the app,</strong>
      you can request deletion at
      <a href="mailto:ij1481534943@gmail.com">ij1481534943@gmail.com</a>. If you are pending or
      rejected, or cannot sign in, in-app deletion is unreachable and this address is the only
      route. See the <a href="delete-account.html">account deletion guide</a> for details.</li>
</ul>

<h2>7. Security measures</h2>
<ul>
  <li>All traffic is encrypted with <strong>HTTPS</strong>.</li>
  <li>PINs are never stored in the clear — only as a Firebase Authentication hash.</li>
  <li>Firestore security rules restrict access to <strong>your own data</strong>, enforced on the
      server. Users cannot read each other's to-dos.</li>
  <li>The operator (administrator) holds permission to access users' to-do data,
      <strong>goal data</strong>, and <strong>category names and colours</strong>
      <strong>in order to process account deletion</strong>. This permission is not used for any
      other purpose.</li>
  <li>Accounts are approval-based, which blocks unauthorised sign-ups.</li>
</ul>

<h2>8. Data protection officer and contact</h2>
<p>This Service is <strong>run by an individual on a non-commercial basis</strong> and is not
registered as a business. A trade name, representative, business registration number and business
address therefore do not apply.</p>
<table>
  <tr><th>Data protection officer</th><td>이준호 (Lee Jun-ho)</td></tr>
  <tr><th>Enquiries and requests</th>
      <td><a href="mailto:ij1481534943@gmail.com">ij1481534943@gmail.com</a></td></tr>
</table>
<p>Send requests for access, correction, deletion or suspension of processing — and account deletion
requests — to the address above; they are handled and answered <strong>within 7 days</strong>.</p>
<p><strong>Even if your sign-up was not approved, or you have already removed the app, you can
request account deletion at this address.</strong> While pending or rejected you cannot sign in, so
in-app deletion is unavailable and this address is the only route. See the
<a href="delete-account.html">account deletion guide</a> for details.</p>
<p>To report or seek advice about a privacy infringement, you may contact the following bodies in
the Republic of Korea:</p>
<ul>
  <li>Privacy Infringement Report Centre — privacy.kisa.or.kr / 118 (no area code)</li>
  <li>Personal Information Dispute Mediation Committee — kopico.go.kr / 1833-6972</li>
</ul>

<h2>9. Governing language</h2>
<p><strong>The Korean version of this policy is the authoritative text; the English version is
provided for reference only.</strong> If the two differ in meaning, the Korean version prevails.</p>

<h2>10. Revision history</h2>
<ul>
  <li>Version 1.0 (25 July 2026) — first release</li>
</ul>
<p>If this policy changes, notice will appear in the Service from 7 days before the change takes effect.</p>
`
  }
  }
};

// 화면에 쓸 본문을 고른다. 영문본이 없으면 한국어로 떨어진다.
const legalDoc = (kind) => ((LEGAL[curLang()] || LEGAL.ko)[kind] || LEGAL.ko[kind]);
