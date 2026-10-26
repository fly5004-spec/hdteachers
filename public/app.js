import { SUBJECTS, GWA_CHIPS, HANG_CHIPS, JAYUL_CHIPS, LENGTHS } from './lib/data.js';
import { checkText, applyFix, applyEnding, detectEnding } from './lib/rules.js';
import { generateExample, rephraseExample, shortenExample } from './lib/example.js';

// ---------- 도우미 ----------
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (d, size = 18, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  shrink: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/>',
  undo: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  xc: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  errc: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
};

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- 상태 ----------
function newArea() {
  return {
    grade: '2', cls: '3', num: '1', subject: '', activity: '', role: '',
    chips: [], custom: [], memo: '', length: 'normal',
    text: '', history: [], status: 'idle', source: null,
    emptyErr: false, subjectErr: false, addOpen: false, busy: false, snap: null,
  };
}
const state = { top: 'gwa', sub: 'hang', areas: { gwa: newArea(), jayul: newArea(), hang: newArea() } };
const cur = () => (state.top === 'gwa' ? 'gwa' : state.sub);
const A = () => state.areas[cur()];
const chipsOf = (area) => (area === 'gwa' ? GWA_CHIPS : area === 'hang' ? HANG_CHIPS : JAYUL_CHIPS);
const hasInput = (s) => s.chips.length > 0 || s.custom.length > 0 || s.memo.trim().length > 0;
const studentLabel = (s, area) => `${s.grade}학년 ${s.cls}반 ${s.num}번 · ${area === 'gwa' ? (s.subject || '과목 미선택') : area === 'hang' ? '행동특성 및 종합의견' : '자율·자치활동'}`;

// ---------- 서버 호출 (실패하면 예시 문장) ----------
function localExample(body) {
  if (body.mode === 'rephrase') return rephraseExample(body.text);
  if (body.mode === 'shorten') return shortenExample(body.text);
  return generateExample({ ...body.input, area: body.area });
}
async function callApi(body) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch('api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error('bad');
    const j = await r.json();
    if (typeof j.text !== 'string') throw new Error('bad');
    return j;
  } catch {
    return { text: localExample(body), source: 'example' };
  }
}
// 학생 번호·이름은 서버로 보내지 않음
const payload = (s) => ({
  subject: s.subject, activity: s.activity, role: s.role,
  chips: s.chips, custom: s.custom, memo: s.memo, length: s.length,
});

// ---------- 왼쪽: 입력 ----------
const selOpts = (from, to, v, suffix) => {
  let h = '';
  for (let i = from; i <= to; i++) h += `<option value="${i}"${String(i) === String(v) ? ' selected' : ''}>${i}${suffix}</option>`;
  return h;
};

function renderLeft() {
  const area = cur();
  const s = A();
  const home = state.top === 'home';
  const sub = home ? `
    <div class="sub" role="tablist" aria-label="작성 항목">
      <button type="button" role="tab" data-sub="jayul" aria-selected="${area === 'jayul'}">자율·자치활동</button>
      <button type="button" role="tab" data-sub="hang" aria-selected="${area === 'hang'}">행동특성 및 종합의견</button>
    </div>` : '';

  const subjectSel = area === 'gwa' ? `
    <label class="fld">과목
      <select class="in" data-field="subject" ${s.subjectErr ? 'style="border-color:#E05353" aria-invalid="true"' : ''}>
        <option value="" ${s.subject ? '' : 'selected'} disabled>과목 고르기</option>
        ${SUBJECTS.map((x) => `<option${x === s.subject ? ' selected' : ''}>${esc(x)}</option>`).join('')}
      </select>
    </label>` : '';

  const step1 = `
    <div class="step">
      <h2 class="sec"><span class="num">1</span>${area === 'gwa' ? '학생과 수업 정하기' : '학생 고르기'}</h2>
      <div class="row">
        <label class="fld">학년<select class="in" data-field="grade">${selOpts(1, 3, s.grade, '학년')}</select></label>
        <label class="fld">반<select class="in" data-field="cls">${selOpts(1, 15, s.cls, '반')}</select></label>
        <label class="fld">번호<select class="in" data-field="num">${selOpts(1, 45, s.num, '번')}</select></label>
        ${subjectSel}
      </div>
      ${s.subjectErr ? `<p class="ferr">${svg(I.errc, 16, 2.5)}과목을 먼저 골라 주세요.</p>` : ''}
      ${area === 'gwa' ? `
      <label class="fld"><span>단원 · 활동 이름 <span class="opt">(선택)</span></span>
        <input class="in" type="text" data-field="activity" value="${esc(s.activity)}" placeholder="예) 빛과 파동 - 거울과 렌즈로 상 만들기 실험" maxlength="80">
      </label>` : ''}
    </div>`;

  const titles = {
    gwa: ['관찰한 모습 고르기', '수업에서 본 학생의 모습을 1개 이상 골라 주세요. 여러 개 고를 수 있어요.', '예) 발표 자료를 깔끔하게 만듦'],
    hang: ['성격·태도 고르기', '한 해 동안 꾸준히 본 모습을 1개 이상 골라 주세요. 여러 개 고를 수 있어요.', '예) 쉬는 시간에 교실 정리를 먼저 함'],
    jayul: ['참여한 활동 고르기', '학생이 참여한 학급·학교 활동을 1개 이상 골라 주세요.', '예) 학급 신문 만들기'],
  }[area];

  const chips = chipsOf(area).map((c, i) => `
    <button type="button" class="chip" data-chip="${i}" aria-pressed="${s.chips.includes(c.label)}">${esc(c.label)}</button>`).join('');
  const custom = s.custom.map((c, i) => `
    <button type="button" class="chip" data-custom="${i}" aria-pressed="true" aria-label="${esc(c)} (누르면 빼기)">${esc(c)}<span class="x" aria-hidden="true">✕</span></button>`).join('');

  const step2 = `
    <div class="step">
      <h2 class="sec"><span class="num">2</span>${titles[0]}</h2>
      <p class="hint">${titles[1]}</p>
      <div class="chips${s.emptyErr ? ' bad' : ''}" id="chips">
        ${chips}${custom}
        <button type="button" class="chip add" data-add-open aria-expanded="${s.addOpen}">${svg(I.plus)}직접 추가</button>
      </div>
      ${s.addOpen ? `
      <div class="addrow">
        <input class="in" type="text" id="addIn" placeholder="${titles[2]}" maxlength="60" aria-label="직접 추가할 내용">
        <button type="button" class="b2 line" data-add-ok style="flex:0 0 auto">추가</button>
      </div>` : ''}
      ${s.emptyErr ? `<p class="ferr" id="emptyMsg">${svg(I.errc, 16, 2.5)}${area === 'hang' ? '성격·태도를' : area === 'jayul' ? '참여한 활동을' : '관찰한 모습을'} 1개 이상 고르거나 아래에 관찰 메모를 적어 주세요.</p>` : ''}
      ${area === 'jayul' ? `
      <label class="fld"><span>맡은 역할 <span class="opt">(선택)</span></span>
        <input class="in" type="text" data-field="role" value="${esc(s.role)}" placeholder="예) 학급 자치회 부회장" maxlength="30">
      </label>` : ''}
    </div>`;

  const ph = area === 'gwa'
    ? '짧은 낱말이나 메모로 적어도 괜찮아요. 예) 렌즈 상 크기 변화 꼼꼼히 측정, 사이드미러 예시 찾아 설명'
    : area === 'hang'
      ? '기억나는 장면을 짧게 적어 주세요. 예) 1인 1역 환경 정리 한 학기 빠짐없이 함'
      : '활동 중 기억나는 모습을 짧게 적어 주세요. 예) 회의 때 발언 순서를 정해 골고루 말하게 함';

  const step3 = `
    <div class="step">
      <h2 class="sec"><span class="num">3</span>${area === 'gwa' ? '선생님' : '담임'} 관찰 메모 <span class="opt">(선택)</span></h2>
      <textarea class="memo${s.emptyErr ? ' bad' : ''}" data-field="memo" aria-label="관찰 메모" placeholder="${ph}" maxlength="1000">${esc(s.memo)}</textarea>
      <div class="fld">문장 길이
        <div class="seg" role="group" aria-label="문장 길이">
          ${LENGTHS.map((l) => `<button type="button" data-length="${l.key}" aria-pressed="${s.length === l.key}">${l.label}</button>`).join('')}
        </div>
      </div>
    </div>`;

  $('#left').innerHTML = `${sub}${step1}${step2}${step3}
    <button type="button" class="go" data-go ${s.status === 'loading' ? 'disabled' : ''}>${svg(I.spark, 22)}생기부 문장 만들기</button>`;
}

function clearEmptyErr() {
  const s = A();
  if (!s.emptyErr) return;
  s.emptyErr = false;
  if (s.status === 'empty') s.status = 'idle';
  $('#chips')?.classList.remove('bad');
  $('#emptyMsg')?.remove();
  $('.memo')?.classList.remove('bad');
  renderRight();
}

$('#left').addEventListener('click', (e) => {
  const s = A();
  const area = cur();
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.sub) { state.sub = t.dataset.sub; renderAll(); return; }
  if (t.dataset.chip !== undefined) {
    const label = chipsOf(area)[+t.dataset.chip].label;
    s.chips = s.chips.includes(label) ? s.chips.filter((x) => x !== label) : [...s.chips, label];
    t.setAttribute('aria-pressed', String(s.chips.includes(label)));
    clearEmptyErr();
    return;
  }
  if (t.dataset.custom !== undefined) {
    s.custom.splice(+t.dataset.custom, 1);
    renderLeft();
    return;
  }
  if (t.hasAttribute('data-add-open')) {
    s.addOpen = !s.addOpen;
    renderLeft();
    if (s.addOpen) $('#addIn')?.focus();
    return;
  }
  if (t.hasAttribute('data-add-ok')) { addCustom(); return; }
  if (t.dataset.length) {
    s.length = t.dataset.length;
    t.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
    return;
  }
  if (t.hasAttribute('data-go')) generate();
});

function addCustom() {
  const s = A();
  const v = ($('#addIn')?.value || '').trim();
  if (!v) { $('#addIn')?.focus(); return; }
  if (!s.custom.includes(v)) s.custom.push(v);
  s.addOpen = false;
  s.emptyErr = false;
  if (s.status === 'empty') s.status = 'idle';
  renderLeft();
  renderRight();
}

$('#left').addEventListener('keydown', (e) => {
  if (e.target.id === 'addIn' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addCustom(); }
});

$('#left').addEventListener('input', (e) => {
  const f = e.target.dataset.field;
  if (!f) return;
  const s = A();
  s[f] = e.target.value;
  if (f === 'memo' && s.memo.trim()) clearEmptyErr();
  if (f === 'subject' && s.subjectErr) { s.subjectErr = false; renderLeft(); renderRight(); }
  if (['grade', 'cls', 'num', 'subject'].includes(f)) {
    const tag = $('#r-who');
    if (tag) tag.textContent = studentLabel(s, cur());
  }
});

// ---------- 오른쪽: 결과 ----------
const GROUPS = {
  ending: {
    wait: ['어체', "문장 끝이 '~함, ~했음, ~보임'인지 확인합니다."],
    ok: (r) => ['어체 알맞음', `${r.sentences}문장 모두 교사 관찰 어체로 끝나요.`],
    bad: '오류 · 어체',
  },
  forbidden: {
    wait: ['적으면 안 되는 내용', '교외 대회 수상, 공인어학시험 점수, 부모 직업 등이 있는지 확인합니다.'],
    ok: () => ['적으면 안 되는 내용 없음', '교외 대회 수상, 공인어학시험 점수, 부모 직업 등이 없어요.'],
    bad: '오류 · 적으면 안 되는 내용',
  },
  length: {
    wait: ['분량', '500자(1,500바이트) 안에 들어오는지 확인합니다.'],
    ok: (r) => ['분량 알맞음', `기준의 ${Math.round((r.bytes / r.limit) * 100)}%를 썼어요.`],
    bad: '오류 · 분량',
  },
  compare: {
    wait: ['비교 표현', '다른 학생과 견주거나 순위를 매기는 표현이 있는지 확인합니다.'],
    ok: () => ['비교 표현 없음', '다른 학생과 견주는 표현이 없어요.'],
    bad: '오류 · 비교 표현',
  },
  negative: {
    wait: ['단점 표현', '단점만 적지 않고 나아질 점과 함께 적었는지 확인합니다.'],
    ok: () => ['단점 표현 없음', '단점만 적은 문장이 없어요.'],
    bad: '확인 필요 · 단점 표현',
  },
};

let lastCheck = null;

function renderRight() {
  const area = cur();
  const s = A();
  const hasText = !!s.text.trim();

  let body;
  if (s.status === 'loading') {
    body = `<div class="empty"><div class="spin" aria-hidden="true"></div><strong>문장을 만들고 있어요</strong><p>잠시만 기다려 주세요.</p></div>`;
  } else if (s.status === 'empty') {
    body = `<div class="empty none" role="status">
      <div class="eic">${svg(I.inbox, 28)}</div>
      <strong>내용 없음: 문장을 만들 재료가 없어요</strong>
      <p>왼쪽 2번에서 ${area === 'hang' ? '성격·태도를' : area === 'jayul' ? '참여한 활동을' : '관찰한 모습을'} 1개 이상 고르거나<br>3번에 관찰 메모를 적은 뒤 다시 눌러 주세요.</p></div>`;
  } else if (!hasText) {
    body = `<div class="empty">
      <div class="eic">${svg(I.pen, 28)}</div>
      <strong>아직 만든 문장이 없어요</strong>
      <p>왼쪽에서 ${area === 'hang' ? '성격·태도를' : area === 'jayul' ? '참여한 활동을' : '관찰한 모습을'} 고르고 '생기부 문장 만들기'를 눌러 주세요.<br>만든 문장은 여기에서 바로 고칠 수 있어요.</p></div>`;
  } else {
    body = `<div class="ed-wrap">
      <div class="ed-back" id="edBack" aria-hidden="true"></div>
      <label class="sr" for="ed">생기부 문장</label>
      <textarea class="ed" id="ed" spellcheck="false"></textarea></div>`;
  }

  $('#right').innerHTML = `
    <div class="rhead"><h2 class="sec">생기부에 담을 문장</h2><span id="r-pill"></span></div>
    <div id="r-alert"></div>
    <div class="bar" role="toolbar" aria-label="문장 고치기 도구" id="r-bar"></div>
    <div id="r-body">${body}</div>
    <div class="etag" id="r-tag"></div>
    <div class="meter" id="r-meter"></div>
    <div class="step"><h3 class="ctitle">기재요령 점검</h3><ul class="checks" id="r-checks"></ul></div>
    <div id="r-note"></div>
    <div class="acts" id="r-acts"></div>`;

  const ed = $('#ed');
  if (ed) {
    ed.value = s.text;
    autosize();
  }
  refresh();
}

function autosize() {
  const ed = $('#ed');
  if (!ed) return;
  ed.style.height = 'auto';
  ed.style.height = Math.max(ed.scrollHeight + 4, 240) + 'px';
}

/** 편집기는 그대로 두고 나머지(상태·점검·버튼)만 다시 그림 */
function refresh() {
  const area = cur();
  const s = A();
  const hasText = !!s.text.trim();
  const r = hasText ? checkText(s.text, area) : null;
  lastCheck = r;
  const loading = s.status === 'loading';

  // 상태 표시
  let pill;
  if (loading) pill = `<span class="pill load">만드는 중…</span>`;
  else if (s.status === 'empty') pill = `<span class="pill none">내용 없음</span>`;
  else if (!hasText) pill = `<span class="pill wait">대기 중</span>`;
  else if (r.errors.length) pill = `<span class="pill err">${svg(I.alert, 16, 2.5)}오류 ${r.errors.length}건</span>`;
  else pill = `<span class="pill ok">${svg(I.check, 16, 2.5)}점검 통과</span>`;
  $('#r-pill').innerHTML = pill;

  $('#r-alert').innerHTML = r && r.errors.length ? `
    <div class="alert" role="alert">${svg(I.alert, 22)}<div><strong>오류: 기재요령에 맞지 않는 표현이 ${r.errors.length}곳 있어요</strong>빨간 밑줄 부분을 고치면 복사할 수 있어요.</div></div>` : '';

  // 도구막대
  const off = !hasText || loading || s.busy ? 'disabled' : '';
  const end = hasText ? detectEnding(s.text) : 'ham';
  $('#r-bar').innerHTML = `
    <span class="gl">끝맺음</span>
    <button type="button" class="tb" data-ending="ham" aria-pressed="${end === 'ham'}" ${off}>~함</button>
    <button type="button" class="tb" data-ending="haess" aria-pressed="${end === 'haess'}" ${off}>~했음</button>
    <button type="button" class="tb" data-ending="boim" aria-pressed="${end === 'boim'}" ${off}>~보임</button>
    <span class="sep" aria-hidden="true"></span>
    <button type="button" class="tb" data-tool="rephrase" ${off}>${svg(I.pen)}다른 표현으로 다듬기</button>
    <button type="button" class="tb" data-tool="shorten" ${off}>${svg(I.shrink)}더 짧게</button>
    <button type="button" class="tb" data-tool="undo" ${s.history.length && !loading && !s.busy ? '' : 'disabled'}>${svg(I.undo)}되돌리기</button>`;

  // 편집기 표시
  const ed = $('#ed');
  if (ed) {
    ed.classList.toggle('bad', !!(r && r.errors.length));
    $('#edBack').innerHTML = highlight(s.text, r);
  }

  // 출처·학생
  $('#r-tag').innerHTML = hasText ? `
    <span>${s.source === 'example' ? '<span class="src">예시 문장 (AI 연결 전)</span> ' : ''}문장을 눌러 직접 고칠 수 있어요. 고치면 바로 다시 점검합니다.</span>
    <span id="r-who">${esc(studentLabel(s, area))}</span>` : `<span></span><span id="r-who">${esc(studentLabel(s, area))}</span>`;

  // 글자 수
  const bytes = r ? r.bytes : 0;
  const chars = r ? r.chars : 0;
  const limit = r ? r.limit : 1500;
  const pct = Math.min(100, Math.round((bytes / limit) * 100));
  $('#r-meter').innerHTML = `
    <div class="meter-top"><span><b>${chars.toLocaleString()}자</b> · ${bytes.toLocaleString()}바이트</span><span>기준 ${Math.round(limit / 3).toLocaleString()}자 (${limit.toLocaleString()}바이트)</span></div>
    <div class="track" role="progressbar" aria-label="분량" aria-valuemin="0" aria-valuemax="${limit}" aria-valuenow="${bytes}"><div class="fill${bytes > limit ? ' over' : pct >= 90 ? ' hi' : ''}" style="width:${pct}%"></div></div>`;

  // 점검 목록
  const groups = area === 'hang' ? ['ending', 'forbidden', 'length', 'compare', 'negative'] : ['ending', 'forbidden', 'length', 'compare'];
  $('#r-checks').innerHTML = groups.map((g) => checkItem(g, r, s.text)).join('');

  $('#r-note').innerHTML = hasText ? `
    <div class="note">${svg(I.info, 18)}<span>만든 문장이 학생의 실제 ${area === 'hang' ? '모습' : '활동'}과 맞는지 꼭 확인한 뒤 나이스(NEIS)에 붙여 넣어 주세요.</span></div>` : '';

  const canCopy = hasText && r && !r.errors.length && !loading;
  $('#r-acts').innerHTML = `
    <button type="button" class="b2 solid" data-act="copy" ${canCopy ? '' : 'disabled'}>${svg(I.copy, 20)}복사하기</button>
    <button type="button" class="b2 line" data-act="next" ${hasText && !loading ? '' : 'disabled'}>다음 학생 쓰기${svg(I.arrow, 20)}</button>`;
}

function highlight(text, r) {
  if (!r) return esc(text) + '\n';
  const marks = [];
  for (const i of r.issues) {
    if (i.start < 0) continue;
    const ranges = i.ranges || [[i.start, i.end]];
    for (const [a, b] of ranges) marks.push({ a, b, w: i.severity === 'warn' });
  }
  marks.sort((x, y) => x.a - y.a);
  let out = '';
  let pos = 0;
  for (const m of marks) {
    if (m.a < pos) continue;
    out += esc(text.slice(pos, m.a)) + `<mark${m.w ? ' class="w"' : ''}>${esc(text.slice(m.a, m.b))}</mark>`;
    pos = m.b;
  }
  return out + esc(text.slice(pos)) + '\n';
}

function checkItem(group, r, text) {
  const g = GROUPS[group];
  if (!r) {
    return `<li class="ck wait"><span class="ic">${svg(I.circle, 20)}</span><div><b>${g.wait[0]}</b>${g.wait[1]}</div></li>`;
  }
  const list = r.issues.filter((i) => i.group === group);
  if (!list.length) {
    const [t, d] = g.ok(r);
    return `<li class="ck"><span class="ic">${svg(I.check, 20, 2.5)}</span><div><b>${t}</b>${d}</div></li>`;
  }
  const warn = list.every((i) => i.severity === 'warn');
  const rows = list.map((i) => {
    let fix = '';
    if (i.group === 'ending' && i.fix) {
      fix = `<div class="fixrow"><span class="from">${esc(i.word)}</span><span aria-hidden="true">→</span><span class="to">${esc(i.fix.to)}</span><button type="button" class="fixbtn" data-fix="${i.id}">바꾸기</button></div>`;
    } else if (i.group !== 'length' && i.group !== 'ending') {
      const words = (i.ranges || [[i.start, i.end]]).map(([a, b]) => text.slice(a, b));
      fix = `<div class="fixrow"><span class="quote">${esc([...new Set(words)].join(' · '))}</span>${i.fix ? `<button type="button" class="fixbtn" data-fix="${i.id}">${i.fix.label}</button>` : ''}</div>`;
    }
    return `<div>${esc(i.message)}${fix}</div>`;
  }).join('');
  return `<li class="ck ${warn ? 'warn' : 'bad'}"><span class="ic">${svg(warn ? I.alert : I.xc, 20, 2.5)}</span><div><b>${g.bad}${list.length > 1 ? ` (${list.length}건)` : ''}</b><div class="iss">${rows}</div></div></li>`;
}

function setText(next, { record = true } = {}) {
  const s = A();
  if (record && next !== s.text) s.history.push(s.text);
  if (s.history.length > 30) s.history.shift();
  s.text = next;
  const ed = $('#ed');
  if (ed) { ed.value = next; autosize(); refresh(); } else renderRight();
}

// 편집기 입력
$('#right').addEventListener('focusin', (e) => { if (e.target.id === 'ed') A().snap = A().text; });
$('#right').addEventListener('input', (e) => {
  if (e.target.id !== 'ed') return;
  const s = A();
  if (s.snap !== null) { s.history.push(s.snap); s.snap = null; }
  s.text = e.target.value;
  autosize();
  refresh();
});

$('#right').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  const s = A();
  const area = cur();

  if (t.dataset.ending) {
    setText(applyEnding(s.text, t.dataset.ending));
    return;
  }
  if (t.dataset.fix) {
    const issue = checkText(s.text, area).issues.find((i) => i.id === t.dataset.fix);
    if (issue) setText(applyFix(s.text, issue));
    return;
  }
  if (t.dataset.tool === 'undo') {
    if (!s.history.length) return;
    setText(s.history.pop(), { record: false });
    return;
  }
  if (t.dataset.tool === 'rephrase' || t.dataset.tool === 'shorten') {
    s.busy = true;
    refresh();
    toast(t.dataset.tool === 'rephrase' ? '다른 표현으로 다듬고 있어요…' : '문장을 줄이고 있어요…');
    const res = await callApi({ mode: t.dataset.tool, area, text: s.text, input: payload(s) });
    s.busy = false;
    if (A() !== s) return;
    if (!res.text || res.text === s.text) { refresh(); toast('바꿀 표현을 찾지 못했어요. 직접 고쳐 주세요.'); return; }
    s.source = res.source;
    setText(res.text);
    return;
  }
  if (t.dataset.act === 'copy') {
    const ok = await copy(s.text);
    toast(ok ? '복사했어요. 나이스(NEIS)에 붙여 넣어 주세요.' : '복사하지 못했어요. 문장을 직접 선택해 복사해 주세요.');
    return;
  }
  if (t.dataset.act === 'next') nextStudent();
});

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function nextStudent() {
  const s = A();
  const n = Math.min(Number(s.num) + 1, 45);
  Object.assign(s, {
    num: String(n), chips: [], custom: [], memo: '', role: '', text: '', history: [],
    status: 'idle', source: null, emptyErr: false, addOpen: false, snap: null,
  });
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`${n}번 학생으로 넘어갔어요.`);
}

async function generate() {
  const s = A();
  const area = cur();
  if (area === 'gwa' && !s.subject) {
    s.subjectErr = true;
    renderLeft();
    $('[data-field="subject"]')?.focus();
    return;
  }
  if (!hasInput(s)) {
    s.status = 'empty';
    s.emptyErr = true;
    if (s.text) s.history.push(s.text);
    s.text = '';
    s.source = null;
    renderAll();
    return;
  }
  s.emptyErr = false;
  s.status = 'loading';
  renderAll();
  const res = await callApi({ mode: 'generate', area, input: payload(s) });
  if (s.text) s.history.push(s.text);
  s.text = res.text || '';
  s.source = res.source;
  s.status = s.text ? 'done' : 'empty';
  if (A() === s) renderAll();
  if (res.notice) toast(res.notice);
}

// ---------- 탭 ----------
document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-top]');
  if (!t) return;
  state.top = t.dataset.top;
  renderAll();
});

function renderAll() {
  document.querySelectorAll('[data-top]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.top === state.top)));
  renderLeft();
  renderRight();
}

window.addEventListener('resize', autosize);
renderAll();
