import { SUBJECTS, GWA_CHIPS, HANG_CHIPS, JAYUL_CHIPS, CLOSINGS, LENGTHS } from './lib/data.js?v=11';
import { checkText, applyFix, applyEnding, detectEnding } from './lib/rules.js?v=11';
import { generateExample, rephraseExample, shortenExample } from './lib/example.js?v=11';
import { recordKey, recordsToXlsx, xlsxFileName, AREA_SHEETS } from './lib/records.js?v=11';
import { levelsFor, levelCount, scoreToLevel, stripCode } from './lib/achievement.js?v=11';
import { parseStandardsFile, standardsTemplate } from './lib/standards.js?v=11';
import { LEVEL_CUTS } from './lib/data.js?v=11';
import { analyzeGwa, analyzeJayul, studentKey, RESULT_TEMPLATE_ROWS } from './lib/analyze.js?v=11';
import { readStudentFiles } from './lib/intake.js?v=11';
import { buildXlsx } from './lib/xlsx.js?v=11';
import { spellCheck, applySpellFix, applyAllSpell } from './lib/spell.js?v=11';
import { findDuplicates } from './lib/dup.js?v=11';
import { rowsToItems, pastedToItems, reviewAll, reviewToXlsx, reviewTemplate, CHECK_KINDS } from './lib/review.js?v=11';
import { readXlsxRows as readRows, parseCsv as csvParse, decodeText as decodeBuf } from './lib/standards.js?v=11';

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
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  sheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M12 11v8"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  load: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
};

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ---------- 저장 목록 (이 브라우저에만 보관) ----------
const STORE_KEY = 'sgb-saved-v1';
function loadSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
const STD_KEY = 'sgb-standards-v1';
function loadStandards() {
  try {
    const v = JSON.parse(localStorage.getItem(STD_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}
function persistStandards() {
  try { localStorage.setItem(STD_KEY, JSON.stringify(state.standards)); return true; } catch { return false; }
}
function persistSaved() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.saved));
    return true;
  } catch { return false; }
}

// ---------- 상태 ----------
function newArea() {
  return {
    grade: '2', cls: '3', num: '1', subject: '', activity: '', roleTitle: '',
    types: [], chips: [], custom: [], roles: {}, roleCustom: {}, closing: null, analysis: null,
    memo: '', length: 'normal',
    level: null, levelMode: 'pick', score: '', scoreMax: '100', standardCode: '',
    text: '', history: [], status: 'idle', source: null,
    emptyErr: false, subjectErr: false, addOpen: false, busy: false, snap: null,
  };
}
const state = {
  roster: { gwa: null, jayul: null }, // 올린 학생 자료 (메모리에만, 새로고침하면 사라짐)
  top: 'gwa', sub: 'hang',
  areas: { gwa: newArea(), jayul: newArea(), hang: newArea() },
  saved: loadSaved(),
  standards: loadStandards(),
};
const cur = () => (state.top === 'gwa' ? 'gwa' : state.sub);
const A = () => state.areas[cur()];
const chipsOf = (area) => (area === 'gwa' ? GWA_CHIPS : area === 'hang' ? HANG_CHIPS : JAYUL_CHIPS);
const hasInput = (s) => s.chips.length > 0 || s.custom.length > 0 || s.memo.trim().length > 0 || !!currentStandard(s)
  || (s === state.areas.gwa && (!!effectiveLevel(s) || !!(s.analysis && ((s.analysis.strengths || []).length || (s.analysis.growth || []).length))));
const standardsOf = (subject) => state.standards[String(subject || '').trim()] || [];
function currentStandard(s) {
  if (!s.standardCode) return null;
  return standardsOf(s.subject).find((x, i) => stdId(x, i) === s.standardCode) || null;
}
const stdId = (x, i) => `${i}:${x.code || ''}`;
/** 지금 적용되는 성취수준 (직접 고른 수준 또는 점수로 계산한 수준) */
function effectiveLevel(s) {
  const lv = s.levelMode === 'score' ? scoreToLevel(s.score, s.scoreMax, s.subject) : s.level;
  return lv && levelsFor(s.subject).includes(lv) ? lv : null;
}
const areaShort = { gwa: '과세특', jayul: '자율·자치', hang: '행발' };
const studentText = (r) => `${r.grade}학년 ${r.cls}반 ${r.num}번`;
const studentLabel = (s, area) => `${studentText(s)} · ${area === 'gwa' ? (s.subject || '과목 미선택') : area === 'hang' ? '행동특성 및 종합의견' : '자율·자치활동'}`;

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
// 학생 학년·반·번호는 서버로 보내지 않음
// 수행평가 점수는 보내지 않고, 계산된 수준만 씀
const payload = (s) => ({
  level: cur() === 'gwa' ? effectiveLevel(s) : null,
  standard: cur() === 'gwa' ? currentStandard(s) : null,
  subject: s.subject, activity: s.activity, roleTitle: s.roleTitle,
  types: s.types, chips: s.chips, custom: s.custom, roles: s.roles, roleCustom: s.roleCustom,
  closing: s.closing, memo: s.memo, length: s.length,
  analysis: cur() === 'gwa' && s.analysis ? { strengths: s.analysis.strengths || [], growth: s.analysis.growth || [] } : null,
});

// ---------- 왼쪽: 입력 ----------
const selOpts = (from, to, v, suffix) => {
  let h = '';
  for (let i = from; i <= to; i++) h += `<option value="${i}"${String(i) === String(v) ? ' selected' : ''}>${i}${suffix}</option>`;
  return h;
};
const chipBtn = (attr, i, label, on, extra = '') => `<button type="button" class="chip${extra}" ${attr}="${i}" aria-pressed="${on}">${esc(label)}</button>`;

function rolesBox(s) {
  const list = [...s.chips, ...s.custom];
  if (!list.length) return '';
  const rows = list.map((label, i) => {
    const c = JAYUL_CHIPS.find((x) => x.label === label);
    const opts = c ? (c.duty || Object.keys(c.roles || {})) : [];
    const v = s.roles[label] || '';
    const optHtml = [
      `<option value=""${v === '' ? ' selected' : ''}>${c && c.duty ? '맡은 일 고르기 (참여만)' : '참여만 했어요'}</option>`,
      ...opts.map((o) => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(o)}</option>`),
      `<option value="__custom"${v === '__custom' ? ' selected' : ''}>직접 입력</option>`,
    ].join('');
    return `
      <div class="role-row">
        <span class="role-name">${esc(label)}</span>
        <select class="in" data-role="${i}" aria-label="${esc(label)} 역할">${optHtml}</select>
        ${v === '__custom' ? `<input class="in" type="text" data-rolecustom="${i}" value="${esc(s.roleCustom[label] || '')}" placeholder="예) 안건 정리" maxlength="20" aria-label="${esc(label)} 역할 직접 입력">` : ''}
      </div>`;
  }).join('');
  return `
    <div class="roles">
      <p class="group-label">활동별 역할 <span class="opt">고르지 않으면 '참여한 모습'으로 써요</span></p>
      ${rows}
    </div>`;
}

// ---------- 학생 자료(수행평가 결과 · 활동 보고서) ----------
function savedFor(area, st, subject) {
  return state.saved.find((r) => r.area === area && r.grade === st.grade && r.cls === st.cls && r.num === st.num
    && (area !== 'gwa' || r.subject === subject));
}

function rosterBox(area, s) {
  if (area === 'hang') return '';
  const R = state.roster[area];
  const what = area === 'gwa' ? '수행평가 결과(엑셀·CSV·PDF)' : '학생 활동 보고서(PDF·엑셀·텍스트)';
  if (!R) {
    return `
    <div class="upload-box roster-empty">
      <strong>${svg(I.load, 18)}학생 자료로 한 번에 쓰기 <span class="opt">(선택)</span></strong>
      <span>${what}를 올리면 학생마다 내용을 분석해 문장을 만들어요. 이전·다음 버튼으로 한 명씩 넘기며 확인할 수 있어요.</span>
      <div class="mini-row">
        <button type="button" class="mini" data-roster-upload>${svg(I.load, 16)}자료 올리기</button>
        <button type="button" class="mini" data-roster-template>${svg(I.sheet, 16)}양식 내려받기</button>
      </div>
    </div>`;
  }
  const st = R.students[R.idx];
  const savedN = R.students.filter((x) => savedFor(area, x, s.subject)).length;
  const an = st ? (area === 'gwa' ? analyzeGwa(st) : analyzeJayul(st)) : null;
  const lv = area === 'gwa' && st && st.score !== null ? scoreToLevel(st.score, st.max, s.subject) : null;
  const found = [];
  if (area === 'gwa' && st && st.score !== null) found.push(['수행평가', `${st.score} / ${st.max ?? '?'}${lv ? ` → ${lv} 수준` : ''}`]);
  if (an && an.strengths && an.strengths.length) found.push(['잘한 요소', an.strengths.join(', ')]);
  if (an && an.growth && an.growth.length) found.push(['더 노력할 요소', an.growth.join(', ')]);
  if (an && an.chips.length) found.push([area === 'gwa' ? '찾은 모습' : '찾은 활동', an.chips.join(', ')]);
  if (an && an.roles && Object.keys(an.roles).length) found.push(['찾은 역할', Object.entries(an.roles).map(([k, v]) => `${k.replace(/\s*\(.*?\)/, '')}: ${v}`).join(', ')]);
  if (an && an.roleTitle) found.push(['직책', an.roleTitle]);
  if (an && an.highlights.length) found.push(['꼭 넣을 장면', an.highlights.join(' / ')]);
  const raw = st ? st.texts.join(' ').replace(/\s+/g, ' ').trim() : '';
  return `
    <div class="roster">
      <div class="roster-nav">
        <button type="button" class="b2 line" data-roster-prev ${R.idx > 0 ? '' : 'disabled'}>${svg('<path d="m15 18-6-6 6-6"/>', 20)}이전</button>
        <select class="in" data-roster-select aria-label="학생 고르기">
          ${R.students.map((x, i) => `<option value="${i}"${i === R.idx ? ' selected' : ''}>${esc(`${x.grade}학년 ${x.cls}반 ${x.num}번 ${x.name || ''}`.trim())}${savedFor(area, x, s.subject) ? ' ✓' : ''}</option>`).join('')}
        </select>
        <button type="button" class="b2 line" data-roster-next ${R.idx < R.students.length - 1 ? '' : 'disabled'}>다음${svg('<path d="m9 18 6-6-6-6"/>', 20)}</button>
      </div>
      <div class="mini-row roster-meta">
        <span class="opt">${R.idx + 1} / ${R.students.length}명 · 저장 ${savedN}명</span>
        <button type="button" class="mini" data-roster-upload>${svg(I.load, 16)}자료 더 올리기</button>
        <button type="button" class="mini danger" data-roster-clear>${svg(I.trash, 16)}자료 닫기</button>
      </div>
      ${R.notes.length ? `<ul class="roster-notes">${R.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <details class="found" open>
        <summary>이 학생 자료에서 찾은 내용</summary>
        ${found.length ? `<dl>${found.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="hint">자료에서 찾은 내용이 없어요. 아래에서 직접 골라 주세요.</p>'}
        ${raw ? `<p class="raw"><span class="opt">원문 일부</span> ${esc(raw.length > 220 ? raw.slice(0, 220) + '…' : raw)}</p>` : ''}
      </details>
    </div>`;
}

/** 자료 속 한 학생을 화면에 채우고 바로 문장 만들기 */
function applyStudent(area, idx) {
  const R = state.roster[area];
  if (!R || !R.students[idx]) return;
  R.idx = idx;
  const st = R.students[idx];
  const s = state.areas[area];
  Object.assign(s, {
    grade: st.grade || s.grade, cls: st.cls || s.cls, num: st.num,
    custom: [], roleCustom: {}, text: '', history: [], status: 'idle', source: null,
    emptyErr: false, subjectErr: false, addOpen: false, snap: null,
  });
  const rec = savedFor(area, s, s.subject);
  if (rec) {
    const inp = rec.input || {};
    Object.assign(s, {
      chips: inp.chips || [], custom: inp.custom || [], roles: inp.roles || {}, roleCustom: inp.roleCustom || {},
      roleTitle: inp.roleTitle || '', memo: inp.memo || '', level: rec.level || null, levelMode: 'pick',
      analysis: inp.analysis || null, text: rec.text, status: 'done',
    });
    renderAll();
    toast(`${s.num}번은 이미 저장한 문장이 있어 불러왔어요.`);
    return;
  }
  if (area === 'gwa') {
    const an = analyzeGwa(st);
    Object.assign(s, { chips: an.chips, memo: an.highlights.join('. ') + (an.highlights.length ? '.' : ''), analysis: an });
    if (st.score !== null) Object.assign(s, { levelMode: 'score', score: String(st.score), scoreMax: String(st.max || 100), level: null });
    else Object.assign(s, { level: null, score: '' });
  } else {
    const an = analyzeJayul(st);
    Object.assign(s, { chips: an.chips, roles: an.roles, roleTitle: an.roleTitle, memo: an.highlights.join('. ') + (an.highlights.length ? '.' : '') });
  }
  if (area === 'gwa' && !s.subject) {
    s.subjectErr = true;
    renderAll();
    toast('과목을 고르면 바로 문장을 만들어요.');
    return;
  }
  if (!hasInput(s)) {
    renderAll();
    toast('이 학생 자료에서 찾은 내용이 없어요. 직접 골라 주세요.');
    return;
  }
  generate();
}

async function uploadStudentFiles(files) {
  const area = cur();
  const s = A();
  toast('자료를 읽고 있어요…');
  const { students, notes } = await readStudentFiles(files, { grade: s.grade, cls: s.cls });
  if (!students.length) {
    toast(notes[0] || '학생 자료를 찾지 못했어요.');
    if (state.roster[area]) { state.roster[area].notes = notes; renderLeft(); }
    return;
  }
  const prev = state.roster[area];
  let list = students;
  if (prev) {
    const map = new Map(prev.students.map((x) => [studentKey(x), x]));
    for (const x of students) {
      const p0 = map.get(studentKey(x));
      if (p0) {
        p0.texts.push(...x.texts); p0.elements.push(...x.elements);
        if (p0.score === null) { p0.score = x.score; p0.max = x.max; }
        p0.name ||= x.name;
      } else map.set(studentKey(x), x);
    }
    list = [...map.values()].sort((a, b) => (+a.grade - +b.grade) || (+a.cls - +b.cls) || (+a.num - +b.num));
  }
  state.roster[area] = { students: list, idx: 0, notes };
  toast(`학생 ${list.length}명의 자료를 불러왔어요.${notes.length ? ` (읽지 못한 파일 ${notes.length}개)` : ''}`);
  applyStudent(area, 0);
}

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

  const cutsText = LEVEL_CUTS[levelCount(s.subject)]
    .map(([l, c], i, arr) => (i === arr.length - 1 ? `그 아래 ${l}` : `${c}% 이상 ${l}`)).join(' · ');
  const stds = standardsOf(s.subject);
  const lv = effectiveLevel(s);
  const achieve = area === 'gwa' ? `
    <div class="step">
      <h2 class="sec"><span class="num">2</span>성취기준과 성취수준 <span class="opt">(선택)</span></h2>
      <p class="hint">고르면 학생 수준에 맞게 표현의 깊이를 바꿔 써요. 점수와 수준(A~E)은 문장에 적히지 않아요.</p>
      <p class="group-label">성취기준</p>
      ${stds.length ? `
        <select class="in" data-field="standardCode" aria-label="성취기준">
          <option value="">고르지 않음</option>
          ${stds.map((x, i) => {
            const t = `${x.code ? x.code + ' ' : ''}${stripCode(x.text)}`;
            return `<option value="${esc(stdId(x, i))}"${stdId(x, i) === s.standardCode ? ' selected' : ''}>${esc(t.length > 70 ? t.slice(0, 70) + '…' : t)}</option>`;
          }).join('')}
        </select>
        <div class="mini-row"><span class="opt">${esc(s.subject)} 성취기준 ${stds.length}개를 불러왔어요.</span>
          <button type="button" class="mini" data-std-upload>${svg(I.load, 16)}다시 올리기</button>
          <button type="button" class="mini danger" data-std-clear>${svg(I.trash, 16)}지우기</button></div>` : `
        <div class="upload-box">
          <span>${s.subject ? `${esc(s.subject)} ` : ''}성취기준 파일(엑셀·CSV)을 올리면 목록에서 골라 쓸 수 있어요.</span>
          <div class="mini-row">
            <button type="button" class="mini" data-std-upload>${svg(I.load, 16)}파일 올리기</button>
            <button type="button" class="mini" data-std-template>${svg(I.sheet, 16)}양식 내려받기</button>
          </div>
        </div>`}
      <p class="group-label">성취수준</p>
      <div class="seg" role="group" aria-label="성취수준 입력 방법">
        <button type="button" data-levelmode="pick" aria-pressed="${s.levelMode === 'pick'}">수준 고르기</button>
        <button type="button" data-levelmode="score" aria-pressed="${s.levelMode === 'score'}">수행평가 점수로</button>
      </div>
      ${s.levelMode === 'pick' ? `
      <div class="chips">
        ${levelsFor(s.subject).map((l) => `<button type="button" class="chip sm lv" data-level="${l}" aria-pressed="${s.level === l}">${l}</button>`).join('')}
        <button type="button" class="chip sm" data-level="" aria-pressed="${!s.level}">고르지 않음</button>
      </div>` : `
      <div class="score-row">
        <label class="fld">점수<input class="in" type="number" inputmode="decimal" min="0" step="0.5" data-field="score" value="${esc(s.score)}" placeholder="예) 85"></label>
        <label class="fld">만점<input class="in" type="number" inputmode="decimal" min="1" step="0.5" data-field="scoreMax" value="${esc(s.scoreMax)}"></label>
        <div class="level-out" id="levelOut" aria-live="polite">${lv ? `→ ${lv} 수준` : '점수를 넣으면 수준이 나와요'}</div>
      </div>`}
      <p class="hint">${s.subject ? esc(s.subject) : '이 과목'} 기준: ${cutsText} (학교 기준이 다르면 '수준 고르기'를 써 주세요)</p>
    </div>` : '';

  const titles = {
    gwa: ['관찰한 모습 고르기', '수업에서 본 학생의 모습을 1개 이상 골라 주세요. 여러 개 고를 수 있어요.', '예) 발표 자료를 깔끔하게 만듦'],
    hang: ['성격·태도 고르기', '한 해 동안 꾸준히 본 모습을 1개 이상 골라 주세요. 여러 개 고를 수 있어요.', '예) 쉬는 시간에 교실 정리를 먼저 함'],
    jayul: ['참여한 활동과 역할 고르기', '학생이 참여한 활동을 고른 뒤, 활동마다 맡은 역할을 골라 주세요.', '예) 학급 신문 만들기'],
  }[area];

  const types = '';

  const chips = chipsOf(area).map((c, i) => chipBtn('data-chip', i, c.label, s.chips.includes(c.label))).join('');
  const custom = s.custom.map((c, i) => `
    <button type="button" class="chip" data-custom="${i}" aria-pressed="true" aria-label="${esc(c)} (누르면 빼기)">${esc(c)}<span class="x" aria-hidden="true">✕</span></button>`).join('');

  const step2 = `
    <div class="step">
      <h2 class="sec"><span class="num">${area === 'gwa' ? 3 : 2}</span>${titles[0]}</h2>
      <p class="hint">${titles[1]}</p>
      ${types}
      <div class="chips${s.emptyErr ? ' bad' : ''}" id="chips">
        ${chips}${custom}
        <button type="button" class="chip add" data-add-open aria-expanded="${s.addOpen}">${svg(I.plus)}직접 추가</button>
      </div>
      ${s.addOpen ? `
      <div class="addrow">
        <input class="in" type="text" id="addIn" placeholder="${titles[2]}" maxlength="60" aria-label="직접 추가할 내용">
        <button type="button" class="b2 line" data-add-ok style="flex:0 0 auto">추가</button>
      </div>` : ''}
      ${s.emptyErr ? `<p class="ferr" id="emptyMsg">${svg(I.errc, 16, 2.5)}${area === 'hang' ? '성격·태도를' : area === 'jayul' ? '참여한 활동을' : '관찰한 모습을'} 1개 이상 골라 주세요.</p>` : ''}
      ${area === 'jayul' ? rolesBox(s) : ''}
      ${area === 'jayul' ? `
      <label class="fld"><span>학급 직책 <span class="opt">(선택)</span></span>
        <input class="in" type="text" data-field="roleTitle" value="${esc(s.roleTitle)}" placeholder="예) 학급 자치회 부회장" maxlength="30">
      </label>` : ''}
    </div>`;

  const step3 = `
    <div class="step">
      <h2 class="sec"><span class="num">${area === 'gwa' ? 4 : 3}</span>마무리 한 줄과 길이</h2>
      <p class="group-label">마무리 한 줄 <span class="opt">(선택 · 하나만)</span></p>
      <div class="chips">${(CLOSINGS[area] || []).map((c, i) => chipBtn('data-closing', i, c.label, s.closing === c.label, ' sm')).join('')}</div>
      <div class="fld">문장 길이
        <div class="seg" role="group" aria-label="문장 길이">
          ${LENGTHS.map((l) => `<button type="button" data-length="${l.key}" aria-pressed="${s.length === l.key}">${l.label}</button>`).join('')}
        </div>
      </div>
    </div>`;

  const ph = area === 'gwa'
    ? '예) 렌즈 상 크기 변화를 꼼꼼히 측정함'
    : area === 'hang'
      ? '예) 1인 1역 환경 정리를 한 학기 동안 빠짐없이 함'
      : '예) 회의 때 발언 순서를 정해 골고루 말하게 함';

  const step4 = `
    <div class="step">
      <h2 class="sec"><span class="num">${area === 'gwa' ? 5 : 4}</span>꼭 넣고 싶은 장면 <span class="opt">(선택)</span></h2>
      <p class="hint">비워 두어도 문장이 만들어져요. 이 학생만의 특별한 장면이 있을 때만 한 줄로 적어 주세요.</p>
      <textarea class="memo memo-sm" data-field="memo" aria-label="꼭 넣고 싶은 장면" placeholder="${ph}" maxlength="500">${esc(s.memo)}</textarea>
    </div>`;

  $('#left').innerHTML = `${sub}${rosterBox(area, s)}${step1}${achieve}${step2}${step3}${step4}
    <button type="button" class="go" data-go ${s.status === 'loading' ? 'disabled' : ''}>${svg(I.spark, 22)}생기부 문장 만들기</button>`;
}

function clearEmptyErr() {
  const s = A();
  if (!s.emptyErr) return;
  s.emptyErr = false;
  if (s.status === 'empty') s.status = 'idle';
  $('#chips')?.classList.remove('bad');
  $('#emptyMsg')?.remove();
  renderRight();
}

$('#left').addEventListener('click', (e) => {
  if (state.top === 'check') return;
  const s = A();
  const area = cur();
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.sub) { state.sub = t.dataset.sub; renderAll(); return; }
  if (t.hasAttribute('data-roster-upload')) { $('#dataFile').click(); return; }
  if (t.hasAttribute('data-roster-template')) {
    const T = RESULT_TEMPLATE_ROWS[area];
    downloadBytes(buildXlsx([{ name: area === 'gwa' ? '수행평가 결과' : '활동 보고서', columns: T.columns.map(([header, width]) => ({ header, width, wrap: width > 30 })), rows: T.rows }]),
      area === 'gwa' ? 'suhaeng_result_yangsik.xlsx' : 'jayul_report_yangsik.xlsx');
    toast('양식을 내려받았어요. 예시 줄을 지우고 학생 자료를 붙여 넣어 주세요.');
    return;
  }
  if (t.hasAttribute('data-roster-prev')) { applyStudent(area, state.roster[area].idx - 1); return; }
  if (t.hasAttribute('data-roster-next')) { applyStudent(area, state.roster[area].idx + 1); return; }
  if (t.hasAttribute('data-roster-clear')) {
    armOrRun(t, '한 번 더 누르면 닫아요', () => { state.roster[area] = null; renderLeft(); toast('올린 자료를 닫았어요. 저장한 문장은 그대로 있어요.'); });
    return;
  }
  if (t.dataset.levelmode) { s.levelMode = t.dataset.levelmode; renderLeft(); return; }
  if (t.dataset.level !== undefined) { s.level = t.dataset.level || null; renderLeft(); return; }
  if (t.hasAttribute('data-std-upload')) {
    if (!s.subject) { s.subjectErr = true; renderLeft(); toast('성취기준을 올리기 전에 과목을 먼저 골라 주세요.'); return; }
    $('#stdFile').click();
    return;
  }
  if (t.hasAttribute('data-std-template')) {
    downloadBytes(standardsTemplate(s.subject || '과학'), 'seongchwigijun_yangsik.xlsx');
    toast('성취기준 양식을 내려받았어요. 예시 줄을 지우고 학교 성취기준을 붙여 넣어 주세요.');
    return;
  }
  if (t.hasAttribute('data-std-clear')) {
    armOrRun(t, '한 번 더 누르면 지워요', () => {
      delete state.standards[s.subject];
      persistStandards();
      Object.values(state.areas).forEach((a) => { if (a.subject === s.subject) a.standardCode = ''; });
      renderLeft();
      toast(`${s.subject} 성취기준을 지웠어요.`);
    });
    return;
  }
  if (t.dataset.closing !== undefined) {
    const v = CLOSINGS[area][+t.dataset.closing].label;
    s.closing = s.closing === v ? null : v;
    t.parentElement.querySelectorAll('[data-closing]').forEach((b) => b.setAttribute('aria-pressed', String(CLOSINGS[area][+b.dataset.closing].label === s.closing)));
    return;
  }
  if (t.dataset.chip !== undefined) {
    const label = chipsOf(area)[+t.dataset.chip].label;
    const on = !s.chips.includes(label);
    s.chips = on ? [...s.chips, label] : s.chips.filter((x) => x !== label);
    if (!on) { delete s.roles[label]; delete s.roleCustom[label]; }
    if (area === 'jayul') {
      if (s.emptyErr) { s.emptyErr = false; if (s.status === 'empty') s.status = 'idle'; }
      renderLeft(); renderRight(); return;
    }
    t.setAttribute('aria-pressed', String(on));
    clearEmptyErr();
    return;
  }
  if (t.dataset.custom !== undefined) {
    const label = s.custom[+t.dataset.custom];
    s.custom.splice(+t.dataset.custom, 1);
    delete s.roles[label]; delete s.roleCustom[label];
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

$('#left').addEventListener('change', (e) => {
  if (state.top === 'check') return;
  if (e.target.hasAttribute('data-roster-select')) { applyStudent(cur(), +e.target.value); return; }
  if (e.target.dataset.role === undefined) return;
  const s = A();
  const label = [...s.chips, ...s.custom][+e.target.dataset.role];
  s.roles[label] = e.target.value;
  renderLeft();
  if (e.target.value === '__custom') $(`[data-rolecustom="${e.target.dataset.role}"]`)?.focus();
});

$('#left').addEventListener('input', (e) => {
  if (state.top === 'check') return;
  const s = A();
  if (e.target.dataset.rolecustom !== undefined) {
    const label = [...s.chips, ...s.custom][+e.target.dataset.rolecustom];
    s.roleCustom[label] = e.target.value;
    return;
  }
  const f = e.target.dataset.field;
  if (!f) return;
  s[f] = e.target.value;
  if (f === 'memo' && s.memo.trim()) clearEmptyErr();
  if (f === 'subject') {
    s.subjectErr = false;
    s.standardCode = '';
    if (s.level && !levelsFor(s.subject).includes(s.level)) s.level = null;
    renderLeft(); renderRight();
    if (cur() === 'gwa' && state.roster.gwa && !s.text && hasInput(s)) generate();
  }
  if (f === 'standardCode') clearEmptyErr();
  if (f === 'score' || f === 'scoreMax') {
    const lv = effectiveLevel(s);
    const out = $('#levelOut');
    if (out) out.textContent = lv ? `→ ${lv} 수준` : (s.score === '' ? '점수를 넣으면 수준이 나와요' : '점수와 만점을 확인해 주세요');
  }
  if (['grade', 'cls', 'num', 'subject'].includes(f)) {
    const tag = $('#r-who');
    if (tag) tag.textContent = studentLabel(s, cur());
  }
});

// ---------- 오른쪽: 결과 ----------
const GROUPS = {
  spell: {
    wait: ['맞춤법·띄어쓰기·문장 부호', '자주 틀리는 표현을 확인합니다.'],
    ok: () => ['맞춤법·띄어쓰기·문장 부호 확인', '자주 틀리는 표현이 없어요.'],
    bad: '확인 필요 · 맞춤법·띄어쓰기·문장 부호',
  },
  dup: {
    wait: ['다른 학생과 같은 문장', '저장한 다른 학생 문장과 6어절 이상 겹치는지 확인합니다.'],
    ok: () => ['다른 학생과 겹치지 않음', '저장한 다른 학생 문장과 6어절 이상 겹치지 않아요.'],
    bad: '확인 필요 · 다른 학생과 같은 문장(6어절 이상)',
  },
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

function renderRight() {
  const area = cur();
  const s = A();
  const hasText = !!s.text.trim();
  const what = area === 'hang' ? '성격·태도를' : area === 'jayul' ? '참여한 활동을' : '관찰한 모습을';

  let body;
  if (s.status === 'loading') {
    body = `<div class="empty"><div class="spin" aria-hidden="true"></div><strong>문장을 만들고 있어요</strong><p>잠시만 기다려 주세요.</p></div>`;
  } else if (s.status === 'empty') {
    body = `<div class="empty none" role="status">
      <div class="eic">${svg(I.inbox, 28)}</div>
      <strong>내용 없음: 문장을 만들 재료가 없어요</strong>
      <p>왼쪽 2번에서 ${what} 1개 이상 고른 뒤 다시 눌러 주세요.</p></div>`;
  } else if (!hasText) {
    body = `<div class="empty">
      <div class="eic">${svg(I.pen, 28)}</div>
      <strong>아직 만든 문장이 없어요</strong>
      <p>왼쪽에서 ${what} 고르고 '생기부 문장 만들기'를 눌러 주세요.<br>만든 문장은 여기에서 바로 고칠 수 있어요.</p></div>`;
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
  if (ed) { ed.value = s.text; autosize(); }
  refresh();
}

function autosize() {
  const ed = $('#ed');
  if (!ed) return;
  ed.style.height = 'auto';
  ed.style.height = Math.max(ed.scrollHeight + 4, 240) + 'px';
}

/** 편집기는 그대로 두고 나머지(상태·점검·버튼)만 다시 그림 */
/** 기재요령 점검 + 맞춤법·띄어쓰기 + 저장한 다른 학생과 6어절 중복 */
function fullCheck(text, area, s) {
  const r = checkText(text, area);
  for (const x of spellCheck(text)) {
    r.issues.push({
      id: `sp-${x.id}`, group: 'spell', cat: x.cat, severity: 'warn', start: x.start, end: x.end, word: x.word,
      message: `[${x.cat}] ${x.msg}`, fix: x.to !== null && x.to !== undefined ? { kind: 'spell', label: '고치기', raw: x } : null,
    });
  }
  const others = state.saved.filter((o) => o.area === area && !(o.grade === s.grade && o.cls === s.cls && o.num === s.num && (area !== 'gwa' || o.subject === s.subject)));
  if (others.length && text.trim()) {
    const d = findDuplicates([{ id: 'cur', text }, ...others.map((o) => ({ id: o.id, text: o.text }))]);
    const label = (id) => { const o = others.find((x) => x.id === id); return o ? `${o.grade}-${o.cls}-${o.num}번` : ''; };
    for (const sp of d.byId.cur || []) {
      r.issues.push({
        id: `dp-${sp.start}`, group: 'dup', severity: 'warn', start: sp.start, end: sp.end, word: sp.text,
        message: `저장한 다른 학생(${sp.others.map(label).slice(0, 5).join(', ')}${sp.others.length > 5 ? ' 외' : ''})의 문장과 ${sp.words}어절이 겹쳐요. 사이버 감사에서 조회될 수 있으니 이 학생에 맞게 바꿔 써 주세요.`,
        fix: null,
      });
    }
  }
  r.issues.sort((a, b) => a.start - b.start);
  r.warnings = r.issues.filter((i) => i.severity === 'warn');
  return r;
}

function refresh() {
  const area = cur();
  const s = A();
  const hasText = !!s.text.trim();
  const r = hasText ? fullCheck(s.text, area, s) : null;
  const loading = s.status === 'loading';

  let pill;
  if (loading) pill = `<span class="pill load">만드는 중…</span>`;
  else if (s.status === 'empty') pill = `<span class="pill none">내용 없음</span>`;
  else if (!hasText) pill = `<span class="pill wait">대기 중</span>`;
  else if (r.errors.length) pill = `<span class="pill err">${svg(I.alert, 16, 2.5)}오류 ${r.errors.length}건</span>`;
  else pill = `<span class="pill ok">${svg(I.check, 16, 2.5)}점검 통과${r.warnings.length ? ` · 확인 ${r.warnings.length}건` : ''}</span>`;
  $('#r-pill').innerHTML = pill;

  $('#r-alert').innerHTML = r && r.errors.length ? `
    <div class="alert" role="alert">${svg(I.alert, 22)}<div><strong>오류: 기재요령에 맞지 않는 표현이 ${r.errors.length}곳 있어요</strong>빨간 밑줄 부분을 고치면 복사하고 저장할 수 있어요.</div></div>` : '';

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

  const ed = $('#ed');
  if (ed) {
    ed.classList.toggle('bad', !!(r && r.errors.length));
    $('#edBack').innerHTML = highlight(s.text, r);
  }

  $('#r-tag').innerHTML = hasText ? `
    <span>${s.source === 'example' ? '<span class="src">예시 문장 (AI 연결 전)</span> ' : ''}문장을 눌러 직접 고칠 수 있어요. 고치면 바로 다시 점검합니다.</span>
    <span id="r-who">${esc(studentLabel(s, area))}</span>` : `<span></span><span id="r-who">${esc(studentLabel(s, area))}</span>`;

  const bytes = r ? r.bytes : 0;
  const chars = r ? r.chars : 0;
  const limit = r ? r.limit : 1500;
  const pct = Math.min(100, Math.round((bytes / limit) * 100));
  $('#r-meter').innerHTML = `
    <div class="meter-top"><span><b>${chars.toLocaleString()}자</b> · ${bytes.toLocaleString()}바이트</span><span>기준 ${Math.round(limit / 3).toLocaleString()}자 (${limit.toLocaleString()}바이트)</span></div>
    <div class="track" role="progressbar" aria-label="분량" aria-valuemin="0" aria-valuemax="${limit}" aria-valuenow="${bytes}"><div class="fill${bytes > limit ? ' over' : pct >= 90 ? ' hi' : ''}" style="width:${pct}%"></div></div>`;

  const groups = [...(area === 'hang' ? ['ending', 'forbidden', 'length', 'compare', 'negative'] : ['ending', 'forbidden', 'length', 'compare']), 'spell', 'dup'];
  $('#r-checks').innerHTML = groups.map((g) => checkItem(g, r, s.text)).join('');

  $('#r-note').innerHTML = hasText ? `
    <div class="note">${svg(I.info, 18)}<span>만든 문장이 학생의 실제 ${area === 'hang' ? '모습' : '활동'}과 맞는지 꼭 확인해 주세요.</span></div>` : '';

  const ok = hasText && r && !r.errors.length && !loading;
  $('#r-acts').innerHTML = `
    <button type="button" class="b2 line" data-act="copy" ${ok ? '' : 'disabled'}>${svg(I.copy, 20)}복사하기</button>
    <button type="button" class="b2 solid" data-act="save" ${ok ? '' : 'disabled'}>${svg(I.save, 20)}저장하고 다음 학생${svg(I.arrow, 20)}</button>`;
}

function highlight(text, r) {
  if (!r) return esc(text) + '\n';
  const marks = [];
  for (const i of r.issues) {
    if (i.start < 0) continue;
    const ranges = i.ranges || [[i.start, i.end]];
    for (const [a, b] of ranges) marks.push({ a, b, w: i.severity === 'warn', d: i.group === 'dup' });
  }
  marks.sort((x, y) => x.a - y.a);
  let out = '';
  let pos = 0;
  for (const m of marks) {
    if (m.a < pos) continue;
    out += esc(text.slice(pos, m.a)) + `<mark${m.d ? ' class="dp"' : m.w ? ' class="w"' : ''}>${esc(text.slice(m.a, m.b))}</mark>`;
    pos = m.b;
  }
  return out + esc(text.slice(pos)) + '\n';
}

function checkItem(group, r, text) {
  const g = GROUPS[group];
  if (!r) return `<li class="ck wait"><span class="ic">${svg(I.circle, 20)}</span><div><b>${g.wait[0]}</b>${g.wait[1]}</div></li>`;
  const list = r.issues.filter((i) => i.group === group);
  if (!list.length) {
    const [t, d] = g.ok(r);
    return `<li class="ck"><span class="ic">${svg(I.check, 20, 2.5)}</span><div><b>${t}</b>${d}</div></li>`;
  }
  const warn = list.every((i) => i.severity === 'warn');
  const rows = list.map((i) => {
    let fix = '';
    if (i.group === 'spell') {
      fix = `<div class="fixrow"><span class="quote">${esc((i.word || '').trim() ? i.word : (i.word === '' ? '문장 끝' : '빈칸'))}</span>${i.fix ? `<span aria-hidden="true">→</span><span class="to">${esc((i.fix.raw.to || '').trim() ? i.fix.raw.to : (i.fix.raw.to === '' ? '(지우기)' : '(빈칸)'))}</span><button type="button" class="fixbtn" data-fix="${i.id}">고치기</button>` : ''}</div>`;
      return `<div>${esc(i.message)}${fix}</div>`;
    }
    if (i.group === 'dup') {
      return `<div>${esc(i.message)}<div class="fixrow"><span class="quote">${esc(i.word.length > 60 ? i.word.slice(0, 60) + '…' : i.word)}</span></div></div>`;
    }
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

$('#right').addEventListener('focusin', (e) => { if (e.target.id === 'ed') A().snap = A().text; });
$('#right').addEventListener('input', (e) => {
  if (state.top === 'check') return;
  if (e.target.id !== 'ed') return;
  const s = A();
  if (s.snap !== null) { s.history.push(s.snap); s.snap = null; }
  s.text = e.target.value;
  autosize();
  refresh();
});

$('#right').addEventListener('click', async (e) => {
  if (state.top === 'check') return;
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  const s = A();
  const area = cur();

  if (t.dataset.ending) { setText(applyEnding(s.text, t.dataset.ending)); return; }
  if (t.dataset.fix) {
    const issue = fullCheck(s.text, area, s).issues.find((i) => i.id === t.dataset.fix);
    if (issue && issue.fix && issue.fix.kind === 'spell') setText(applySpellFix(s.text, issue.fix.raw));
    else if (issue) setText(applyFix(s.text, issue));
    return;
  }
  if (t.dataset.tool === 'undo') {
    if (s.history.length) setText(s.history.pop(), { record: false });
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
  if (t.dataset.act === 'save') saveAndNext();
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

// ---------- 저장 · 다음 학생 ----------
function saveAndNext() {
  const s = A();
  const area = cur();
  const r = checkText(s.text, area);
  if (r.errors.length) { toast('오류를 고친 뒤에 저장할 수 있어요.'); return; }
  const rec = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    area, grade: s.grade, cls: s.cls, num: s.num, subject: area === 'gwa' ? s.subject : '',
    level: area === 'gwa' ? effectiveLevel(s) || '' : '',
    text: s.text.trim(), chars: r.chars, bytes: r.bytes, savedAt: new Date().toISOString(),
    input: payload(s),
  };
  const key = recordKey(rec);
  const before = state.saved.length;
  state.saved = state.saved.filter((x) => recordKey(x) !== key);
  const replaced = state.saved.length < before;
  state.saved.push(rec);
  const stored = persistSaved();

  const R = state.roster[area];
  if (R) {
    if (R.idx < R.students.length - 1) {
      toast(`저장했어요 (모두 ${state.saved.length}개). 다음 학생으로 넘어가요.`);
      applyStudent(area, R.idx + 1);
    } else {
      renderAll();
      toast('마지막 학생까지 저장했어요! 아래에서 엑셀로 내려받아 주세요.');
      $('#saved').scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }
  const n = Math.min(Number(s.num) + 1, 45);
  Object.assign(s, {
    num: String(n), chips: [], custom: [], roles: {}, roleCustom: {}, roleTitle: '', memo: '',
    level: null, score: '',
    text: '', history: [], status: 'idle', source: null, emptyErr: false, addOpen: false, snap: null,
  });
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (!stored) toast('이 브라우저에서는 목록을 보관할 수 없어요. 엑셀로 바로 내려받아 주세요.');
  else toast(`${replaced ? '같은 학생의 문장을 새로 바꿔 저장했어요' : '저장했어요'} (모두 ${state.saved.length}개). ${n}번 학생으로 넘어갔어요.`);
}

// ---------- 저장한 문장 목록 ----------
function renderSaved() {
  const list = [...state.saved].sort((a, b) =>
    ['gwa', 'jayul', 'hang'].indexOf(a.area) - ['gwa', 'jayul', 'hang'].indexOf(b.area)
    || (+a.grade - +b.grade) || (+a.cls - +b.cls) || (+a.num - +b.num));
  const count = (k) => state.saved.filter((x) => x.area === k).length;
  const summary = ['gwa', 'jayul', 'hang'].map((k) => `${areaShort[k]} ${count(k)}`).join(' · ');

  const rows = list.map((r) => `
    <tr>
      <td><span class="tag">${areaShort[r.area]}</span></td>
      <td class="nowrap">${esc(studentText(r))}${r.area === 'gwa' && r.subject ? `<br><span class="opt">${esc(r.subject)}</span>` : ''}</td>
      <td><div class="clamp">${esc(r.text)}</div></td>
      <td class="nowrap num-cell">${Number(r.bytes).toLocaleString()}</td>
      <td class="nowrap">
        <button type="button" class="mini" data-load="${esc(r.id)}">${svg(I.load, 16)}불러오기</button>
        <button type="button" class="mini danger" data-del="${esc(r.id)}">${svg(I.trash, 16)}삭제</button>
      </td>
    </tr>`).join('');

  $('#saved').innerHTML = `
    <div class="rhead">
      <div>
        <h2 class="sec">${svg(I.sheet, 22)}저장한 문장 <span class="count">${state.saved.length}개</span></h2>
        <p class="hint">${state.saved.length ? summary : "'저장하고 다음 학생'을 누르면 여기에 모여요."}</p>
      </div>
      <div class="acts">
        <button type="button" class="b2 solid" data-xlsx ${state.saved.length ? '' : 'disabled'}>${svg(I.sheet, 20)}엑셀로 내려받기</button>
        <button type="button" class="b2 line" data-clear ${state.saved.length ? '' : 'disabled'}>${svg(I.trash, 20)}목록 비우기</button>
      </div>
    </div>
    ${list.length ? `
    <div class="table-wrap">
      <table class="saved-table">
        <thead><tr><th scope="col">영역</th><th scope="col">학생</th><th scope="col">문장</th><th scope="col">바이트</th><th scope="col"><span class="sr">관리</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>` : ''}
    <p class="note">${svg(I.info, 18)}<span>저장한 문장은 이 컴퓨터의 이 브라우저에만 남아요. 다른 컴퓨터에서는 보이지 않아요. 공용 컴퓨터라면 엑셀로 내려받은 뒤 '목록 비우기'를 눌러 주세요.</span></p>`;
}

function armOrRun(btn, label, run) {
  if (btn.dataset.armed) { run(); return; }
  btn.dataset.armed = '1';
  const old = btn.innerHTML;
  btn.innerHTML = label;
  setTimeout(() => { if (btn.isConnected) { btn.innerHTML = old; delete btn.dataset.armed; } }, 3000);
}

function downloadBytes(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadXlsx() {
  downloadBytes(recordsToXlsx(state.saved), xlsxFileName());
  const sheets = ['gwa', 'jayul', 'hang'].filter((k) => state.saved.some((x) => x.area === k)).map((k) => AREA_SHEETS[k].sheet);
  toast(`엑셀 파일을 내려받았어요 (${sheets.join(', ')} 시트).`);
}

function loadRecord(id) {
  const r = state.saved.find((x) => x.id === id);
  if (!r) return;
  state.top = r.area === 'gwa' ? 'gwa' : 'home';
  if (r.area !== 'gwa') state.sub = r.area;
  const s = state.areas[r.area];
  const inp = r.input || {};
  Object.assign(s, newArea(), {
    grade: r.grade, cls: r.cls, num: r.num, subject: r.subject || s.subject,
    activity: inp.activity || '', roleTitle: inp.roleTitle || '',
    types: inp.types || [], chips: inp.chips || [], custom: inp.custom || [],
    roles: inp.roles || {}, roleCustom: inp.roleCustom || {}, closing: inp.closing || null,
    memo: inp.memo || '', length: inp.length || 'normal',
    level: r.level || null, levelMode: 'pick',
    standardCode: inp.standard ? (standardsOf(r.subject).map((x, i) => [x, i]).find(([x]) => x.code === inp.standard.code && x.text === inp.standard.text) || []).map(([x, i]) => stdId(x, i))[0] || '' : '',
    text: r.text, status: 'done',
  });
  if (r.area === 'gwa') s.subject = r.subject;
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`${studentText(r)} ${areaShort[r.area]} 문장을 불러왔어요. 고친 뒤 다시 저장하면 바뀌어요.`);
}

$('#saved').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  if (t.hasAttribute('data-xlsx')) { downloadXlsx(); return; }
  if (t.hasAttribute('data-clear')) {
    armOrRun(t, '한 번 더 누르면 모두 지워요', () => {
      state.saved = [];
      persistSaved();
      renderSaved();
      toast('저장한 문장을 모두 지웠어요.');
    });
    return;
  }
  if (t.dataset.load) { loadRecord(t.dataset.load); return; }
  if (t.dataset.del) {
    armOrRun(t, '정말 삭제', () => {
      state.saved = state.saved.filter((x) => x.id !== t.dataset.del);
      persistSaved();
      renderSaved();
      toast('삭제했어요.');
    });
  }
});

// ---------- 학생 자료 파일 올리기 ----------
$('#dataFile').addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])];
  e.target.value = '';
  if (files.length) await uploadStudentFiles(files);
});

// ---------- 성취기준 파일 올리기 ----------
$('#stdFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const s = A();
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('파일이 너무 커요(5MB 이하).');
    const rows = await parseStandardsFile(file.name, await file.arrayBuffer(), s.subject);
    const bySubject = {};
    for (const r of rows) (bySubject[r.subject || s.subject] ||= []).push({ code: r.code, text: r.text, levels: r.levels, grade: r.grade });
    Object.assign(state.standards, bySubject);
    const ok = persistStandards();
    if (!bySubject[s.subject]) {
      const first = Object.keys(bySubject)[0];
      if (first && SUBJECTS.includes(first)) s.subject = first;
    }
    s.standardCode = '';
    renderLeft();
    const summary = Object.entries(bySubject).map(([k, v]) => `${k} ${v.length}개`).join(', ');
    toast(`성취기준을 불러왔어요: ${summary}${ok ? '' : ' (이 브라우저에는 보관되지 않아요)'}`);
  } catch (err) {
    toast(err && err.message ? err.message : '파일을 읽지 못했어요.');
  }
});

// ---------- 문장 만들기 ----------
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

// ---------- 생기부 점검 탭 ----------
const CK = {
  area: 'gwa', mode: 'paste', paste: '', kinds: new Set(CHECK_KINDS.map((k) => k.key)),
  items: [], source: '', review: null, filter: 'issues', shown: 30, editing: null, fromSaved: false, multi: false,
};
const AREA_LABEL = { gwa: '교과 세부능력 및 특기사항', hang: '행동특성 및 종합의견', jayul: '자율·자치활동' };

function renderCheckLeft() {
  const savedN = state.saved.length;
  $('#left').innerHTML = `
    <div class="checker-head">
      <h2 class="sec">${svg(I.check, 24, 2.5)}문장 점검기</h2>
      <p class="hint">점검할 생기부 문장을 붙여 넣고 <b>점검하기</b>를 누르세요. 맞춤법 · 띄어쓰기 · 문장 부호 · 기재요령(어체·금지 표현·분량)을 한 번에 확인해요.</p>
    </div>
    <textarea class="memo checker-input" data-cpaste aria-label="점검할 문장" placeholder="예) 실험에 적극적으로 참여 함.모둠원과 협력하여 할수있는 일을 찾고 역활을 성실이 수행함">${esc(CK.paste)}</textarea>
    <label class="multi"><input type="checkbox" data-cmulti ${CK.multi ? 'checked' : ''}>
      <span>여러 학생 내용을 <b>한 줄에 한 명씩</b> 넣었어요 <span class="opt">— 학생끼리 6어절 이상 같은 문장도 찾아요</span></span></label>
    <div class="acts">
      <button type="button" class="go" data-crun>${svg(I.check, 22, 2.5)}점검하기</button>
      <button type="button" class="b2 line" data-cclear style="flex:0 0 auto">지우기</button>
    </div>
    <details class="more"${CK.mode !== 'paste' ? ' open' : ''}>
      <summary>엑셀 파일이나 저장한 문장으로 한꺼번에 점검하기</summary>
      <div class="mini-row">
        <button type="button" class="mini" data-cfile>${svg(I.load, 16)}엑셀·CSV 파일 올리기</button>
        <button type="button" class="mini" data-ctemplate>${svg(I.sheet, 16)}양식 내려받기</button>
        <button type="button" class="mini" data-csaved ${savedN ? '' : 'disabled'}>${svg(I.save, 16)}저장한 문장 점검 (${savedN}개)</button>
      </div>
      ${CK.source && CK.mode !== 'paste' ? `<p class="hint">${esc(CK.source)} · ${CK.items.length}명을 점검했어요.</p>` : ''}
    </details>
    <p class="note">${svg(I.info, 18)}<span>맞춤법·띄어쓰기는 생기부에서 자주 틀리는 표현을 중심으로 점검해요. 모든 오류를 찾지는 못하니 나이스 입력 전 한 번 더 확인해 주세요. 넣은 내용은 이 브라우저 안에서만 점검하고 어디에도 보내지 않아요.</span></p>`;
}

function segClasses(text, ranges) {
  // 겹치는 표시를 조각으로 나눠 그리기
  const cuts = new Set([0, text.length]);
  for (const r of ranges) { cuts.add(r.a); cuts.add(r.b); }
  const pts = [...cuts].filter((x) => x >= 0 && x <= text.length).sort((a, b) => a - b);
  let out = '';
  const zeros = new Set(ranges.filter((r) => r.a === r.b && r.a < text.trimEnd().length).map((r) => r.a));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (zeros.has(a)) out += '<mark class="hl-pu miss" title="마침표가 없어요">␣</mark>';
    const cls = [...new Set(ranges.filter((r) => r.a <= a && r.b >= b && r.b > r.a).map((r) => r.c))];
    const piece = esc(text.slice(a, b));
    out += cls.length ? `<mark class="${cls.join(' ')}">${piece}</mark>` : piece;
  }
  const tailMissing = ranges.some((r) => r.a === r.b && r.a >= text.trimEnd().length);
  return out + (tailMissing ? '<mark class="hl-pu miss" title="마침표가 없어요">␣</mark>' : '');
}

const CAT_CLASS = { 맞춤법: 'hl-sp', 띄어쓰기: 'hl-ws', '문장 부호': 'hl-pu' };
const CAT_TAG = { dup: '중복', 맞춤법: '맞춤법', 띄어쓰기: '띄어쓰기', '문장 부호': '문장 부호', rules: '기재요령' };

function checkCard(x, r) {
  const ranges = [
    ...r.dups.map((d) => ({ a: d.start, b: d.end, c: 'hl-dup' })),
    ...r.spell.map((sp) => ({ a: sp.start, b: sp.end, c: CAT_CLASS[sp.cat] })),
    ...r.rules.filter((i) => i.start >= 0).flatMap((i) => (i.ranges || [[i.start, i.end]]).map(([a, b]) => ({ a, b, c: 'hl-rl' }))),
  ];
  const rows = [
    ...r.dups.map((d) => `<li><span class="ctag t-dup">중복</span><span>${esc(d.words)}어절이 <b>${esc(d.otherLabels.slice(0, 6).join(', '))}${d.otherLabels.length > 6 ? ` 외 ${d.otherLabels.length - 6}명` : ''}</b>과 같아요: “${esc(d.text.length > 50 ? d.text.slice(0, 50) + '…' : d.text)}”</span></li>`),
    ...r.spell.map((sp) => `<li><span class="ctag ${CAT_CLASS[sp.cat]}">${esc(sp.cat)}</span><span>${esc(sp.msg)}</span>${sp.to !== null && sp.to !== undefined ? `<button type="button" class="mini" data-cfix="${esc(x.id)}|${esc(sp.id)}">고치기</button>` : ''}</li>`),
    ...r.rules.map((i) => `<li><span class="ctag t-rl">${i.severity === 'warn' ? '확인' : '기재요령'}</span><span>${esc(i.message)}</span></li>`),
  ].join('');
  const editing = CK.editing === x.id;
  return `
    <article class="ccard${r.total ? ' has' : ''}">
      <header class="ccard-h">
        <b>${esc(x.label)}</b>${x.subject ? `<span class="opt">${esc(x.subject)}</span>` : ''}
        ${x.text !== x.original ? '<span class="tag">고침</span>' : ''}
        <span class="opt ccard-bytes${r.bytes > r.limit ? ' over' : ''}">${r.chars}자 · ${r.bytes.toLocaleString()}바이트</span>
        ${r.total ? `<span class="pill err">${r.total}건</span>` : `<span class="pill ok">${svg(I.check, 14, 2.5)}통과</span>`}
      </header>
      ${editing
        ? `<textarea class="memo cedit" data-cedit="${esc(x.id)}" aria-label="${esc(x.label)} 내용 고치기">${esc(x.text)}</textarea>`
        : `<p class="ctext">${segClasses(x.text, ranges)}</p>`}
      ${rows ? `<ul class="clist">${rows}</ul>` : ''}
      <div class="mini-row">
        ${editing
          ? `<button type="button" class="mini" data-cdone="${esc(x.id)}">${svg(I.check, 16, 2.5)}다 고쳤어요 (다시 점검)</button>`
          : `<button type="button" class="mini" data-cedit-open="${esc(x.id)}">${svg(I.pen, 16)}직접 고치기</button>`}
        ${r.fixable ? `<button type="button" class="mini" data-cfixall="${esc(x.id)}">자동 고침 ${r.fixable}개 적용</button>` : ''}
        ${x.text !== x.original ? `<button type="button" class="mini" data-crevert="${esc(x.id)}">${svg(I.undo, 16)}원래대로</button>` : ''}
        <button type="button" class="mini" data-ccopy="${esc(x.id)}">${svg(I.copy, 16)}복사하기</button>
      </div>
    </article>`;
}

function renderCheckRight() {
  const R = CK.review;
  if (!R) {
    $('#right').innerHTML = `
      <div class="rhead"><h2 class="sec">점검 결과</h2><span class="pill wait">대기 중</span></div>
      <div class="empty"><div class="eic">${svg(I.check, 28, 2.5)}</div><strong>위에 문장을 넣고 '점검하기'를 눌러 주세요</strong>
        <p>틀린 곳을 색으로 표시하고, 고칠 방법을 알려 드려요.</p></div>
      <div class="alert soft">${svg(I.alert, 22)}<div><strong>같은 문장 중복 기재 주의</strong>교과세특·행동특성 및 종합의견에 <b>6어절 이상 같은 문장</b>이 <b>2명 이상</b>에게 있으면 사이버 감사 점검에서 모두 조회되고, 책임은 입력 교사에게 있어요.</div></div>`;
    return;
  }
  const S = R.summary;
  const byId = Object.fromEntries(R.results.map((r) => [r.id, r]));
  if (CK.items.length === 1 && CK.mode === 'paste' && !CK.multi) {
    const r0 = R.results[0];
    const st = (n, l) => `<div class="stat${n ? ' bad' : ''}"><b>${n}</b><span>${l}</span></div>`;
    $('#right').innerHTML = `
      <div class="rhead"><h2 class="sec">점검 결과</h2>
        ${r0.total ? `<span class="pill err">${svg(I.alert, 16, 2.5)}고칠 곳 ${r0.total}개</span>` : `<span class="pill ok">${svg(I.check, 16, 2.5)}문제를 찾지 못했어요</span>`}</div>
      <div class="stats">${st(r0.counts['맞춤법'], '맞춤법')}${st(r0.counts['띄어쓰기'], '띄어쓰기')}${st(r0.counts['문장 부호'], '문장 부호')}${st(r0.counts.rules, '기재요령')}</div>
      ${r0.fixable ? `<button type="button" class="b2 solid" data-cfixall="*" style="width:100%">자동으로 고칠 수 있는 것 모두 고치기 (${r0.fixable}개)</button>` : ''}
      <div class="legend"><span><mark class="hl-sp">맞춤법</mark></span><span><mark class="hl-ws">띄어쓰기</mark></span><span><mark class="hl-pu">문장 부호</mark></span><span><mark class="hl-rl">기재요령</mark></span></div>
      <div class="clist-wrap">${checkCard({ ...CK.items[0], label: '입력한 문장' }, r0)}</div>`;
    return;
  }
  const list = CK.items.filter((x) => CK.filter === 'all' || byId[x.id].total);
  const stat = (n, l, c = '') => `<div class="stat${n && c ? ` ${c}` : ''}"><b>${n}</b><span>${l}</span></div>`;
  const groups = R.groups.slice(0, 12).map((g) => `<li><span class="ctag t-dup">${g.ids.length}명</span><span>“${esc(g.text.length > 70 ? g.text.slice(0, 70) + '…' : g.text)}”<br><span class="opt">${esc(g.labels.slice(0, 10).join(', '))}${g.labels.length > 10 ? ` 외 ${g.labels.length - 10}명` : ''}</span></span></li>`).join('');
  $('#right').innerHTML = `
    <div class="rhead"><h2 class="sec">점검 결과 <span class="opt">${CK.items.length}명</span></h2>
      ${S.withIssues ? `<span class="pill err">${svg(I.alert, 16, 2.5)}확인할 학생 ${S.withIssues}명</span>` : `<span class="pill ok">${svg(I.check, 16, 2.5)}모두 통과</span>`}</div>
    <div class="stats">
      ${stat(S.students, '학생')}${stat(S.dupStudents, '중복 문장 학생', 'bad')}${stat(S['맞춤법'], '맞춤법', 'bad')}
      ${stat(S['띄어쓰기'], '띄어쓰기', 'bad')}${stat(S['문장 부호'], '문장 부호', 'bad')}${stat(S.rules, '기재요령', 'bad')}
    </div>
    ${R.groups.length ? `
    <section class="dupbox">
      <h3 class="ctitle">${svg(I.alert, 18)}여러 학생에게 겹치는 문장 ${R.groups.length}개 <span class="opt">(6어절 이상)</span></h3>
      <p class="hint">사이버 감사에서 조회될 수 있어요. 학생마다 다르게 고쳐 주세요.</p>
      <ul class="clist">${groups}</ul>
      ${R.groups.length > 12 ? `<p class="hint">외 ${R.groups.length - 12}개는 엑셀 결과의 '중복 문장' 시트에서 볼 수 있어요.</p>` : ''}
    </section>` : ''}
    <div class="acts">
      <button type="button" class="b2 line" data-cfixall="*" ${S.fixable ? '' : 'disabled'}>자동으로 고칠 수 있는 것 모두 고치기 (${S.fixable}개)</button>
      <button type="button" class="b2 solid" data-cxlsx>${svg(I.sheet, 20)}점검 결과 엑셀로 내려받기</button>
    </div>
    ${CK.fromSaved && CK.items.some((x) => x.text !== x.original) ? `<button type="button" class="b2 line" data-capply style="width:100%">${svg(I.save, 20)}고친 내용을 저장한 문장 목록에 반영하기</button>` : ''}
    <div class="legend"><span><mark class="hl-dup">중복</mark></span><span><mark class="hl-sp">맞춤법</mark></span><span><mark class="hl-ws">띄어쓰기</mark></span><span><mark class="hl-pu">문장 부호</mark></span><span><mark class="hl-rl">기재요령</mark></span></div>
    <div class="seg" role="group" aria-label="보기">
      <button type="button" data-cfilter="issues" aria-pressed="${CK.filter === 'issues'}">확인할 학생만 (${S.withIssues})</button>
      <button type="button" data-cfilter="all" aria-pressed="${CK.filter === 'all'}">전체 (${S.students})</button>
    </div>
    <div class="clist-wrap">
      ${list.slice(0, CK.shown).map((x) => checkCard(x, byId[x.id])).join('') || '<p class="hint">확인할 학생이 없어요. 👍</p>'}
    </div>
    ${list.length > CK.shown ? `<button type="button" class="b2 line" data-cmore style="width:100%">더 보기 (${list.length - CK.shown}명 남음)</button>` : ''}`;
}

function runReview(keepScroll) {
  const y = window.scrollY;
  CK.review = CK.items.length ? reviewAll(CK.items, CK.area, [...CK.kinds]) : null;
  renderCheckRight();
  if (keepScroll) window.scrollTo(0, y);
}

$('#left').addEventListener('click', (e) => {
  if (state.top !== 'check') return;
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  if (t.dataset.carea) { CK.area = t.dataset.carea; renderCheckLeft(); if (CK.items.length) runReview(); return; }
  if (t.dataset.cmode) { CK.mode = t.dataset.cmode; renderCheckLeft(); return; }
  if (t.dataset.ckind) {
    const k = t.dataset.ckind;
    if (CK.kinds.has(k)) CK.kinds.delete(k); else CK.kinds.add(k);
    t.setAttribute('aria-pressed', String(CK.kinds.has(k)));
    return;
  }
  if (t.hasAttribute('data-cfile')) { $('#checkFile').click(); return; }
  if (t.hasAttribute('data-ctemplate')) { downloadBytes(reviewTemplate(), 'jeomgeom_yangsik.xlsx'); toast('양식을 내려받았어요.'); return; }
  if (t.hasAttribute('data-csaved')) {
    const order = ['gwa', 'jayul', 'hang'];
    const list = [...state.saved].sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area)
      || (+a.grade - +b.grade) || (+a.cls - +b.cls) || (+a.num - +b.num));
    CK.items = list.map((r, i) => ({ id: `r${i}`, savedId: r.id, area: r.area, label: `${r.grade}-${r.cls}-${r.num}번 ${areaShort[r.area]}`, grade: r.grade, cls: r.cls, num: r.num, name: '', subject: r.subject || '', text: r.text, original: r.text }));
    CK.mode = 'saved';
    CK.fromSaved = true;
    CK.source = '저장한 문장';
    toast(`저장한 문장 ${CK.items.length}개를 불러와 점검했어요.`);
    runReview();
    return;
  }
  if (t.hasAttribute('data-cclear')) {
    CK.paste = ''; CK.items = []; CK.review = null; CK.mode = 'paste'; CK.source = '';
    renderCheckLeft(); renderCheckRight(); $('[data-cpaste]')?.focus();
    return;
  }
  if (t.hasAttribute('data-crun')) runPasteCheck();
});

function runPasteCheck() {
  const raw = CK.paste.replace(/\r\n?/g, '\n').trim();
  if (!raw) { toast('점검할 문장을 넣어 주세요.'); $('[data-cpaste]')?.focus(); return; }
  CK.mode = 'paste';
  CK.fromSaved = false;
  CK.source = '';
  CK.items = CK.multi ? pastedToItems(raw) : [{ id: 'r0', label: '입력한 문장', grade: '', cls: '', num: '', name: '', subject: '', text: raw, original: raw }];
  if (!CK.items.length) { toast('점검할 문장을 넣어 주세요.'); return; }
  CK.shown = 30;
  CK.editing = null;
  runReview();
  $('#right').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('#left').addEventListener('change', (e) => {
  if (state.top !== 'check') return;
  if (e.target.hasAttribute('data-cmulti')) CK.multi = e.target.checked;
});
$('#left').addEventListener('keydown', (e) => {
  if (state.top !== 'check') return;
  if (e.target.hasAttribute('data-cpaste') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runPasteCheck(); }
});
$('#left').addEventListener('input', (e) => {
  if (state.top !== 'check') return;
  if (e.target.hasAttribute('data-cpaste')) {
    CK.paste = e.target.value;
    // 엑셀에서 여러 칸을 복사해 넣으면 여러 학생으로 봄
    if (!CK.multi && CK.paste.includes('\t')) {
      CK.multi = true;
      const cb = $('[data-cmulti]');
      if (cb) cb.checked = true;
      toast('엑셀에서 복사한 내용이라 여러 학생으로 나눠 점검할게요.');
    }
  }
});

$('#checkFile').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    if (/\.xls$/i.test(f.name)) throw new Error("예전 엑셀(.xls)은 읽을 수 없어요. '.xlsx'로 저장해 올려 주세요.");
    const buf = await f.arrayBuffer();
    const rows = /\.xlsx$/i.test(f.name) ? await readRows(buf) : csvParse(decodeBuf(buf));
    CK.items = rowsToItems(rows);
    CK.fromSaved = false;
    CK.mode = 'file';
    CK.source = f.name;
    renderCheckLeft();
    runReview();
    toast(`학생 ${CK.items.length}명의 내용을 불러와 점검했어요.`);
  } catch (err) {
    toast(err && err.message ? err.message : '파일을 읽지 못했어요.');
  }
});

$('#right').addEventListener('click', (e) => {
  if (state.top !== 'check') return;
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  const item = (id) => CK.items.find((x) => x.id === id);
  if (t.dataset.cfilter) { CK.filter = t.dataset.cfilter; CK.shown = 30; renderCheckRight(); return; }
  if (t.hasAttribute('data-cmore')) { CK.shown += 30; runReview(true); return; }
  if (t.dataset.cfix) {
    const [id, sid] = t.dataset.cfix.split('|');
    const x = item(id);
    const sp = spellCheck(x.text).find((q) => q.id === sid);
    if (sp) x.text = applySpellFix(x.text, sp);
    runReview(true);
    return;
  }
  if (t.dataset.cfixall) {
    const targets = t.dataset.cfixall === '*' ? CK.items : [item(t.dataset.cfixall)];
    let n = 0;
    for (const x of targets) { const nt = applyAllSpell(x.text); if (nt !== x.text) { x.text = nt; n++; } }
    runReview(true);
    toast(`${n}명의 내용을 자동으로 고쳤어요. 고친 내용을 꼭 읽어 봐 주세요.`);
    return;
  }
  if (t.dataset.ceditOpen) { CK.editing = t.dataset.ceditOpen; runReview(true); $(`[data-cedit="${t.dataset.ceditOpen}"]`)?.focus(); return; }
  if (t.dataset.cdone) {
    const ta = $(`[data-cedit="${t.dataset.cdone}"]`);
    if (ta) item(t.dataset.cdone).text = ta.value;
    CK.editing = null;
    runReview(true);
    return;
  }
  if (t.dataset.ccopy) {
    copy(item(t.dataset.ccopy).text).then((ok) => toast(ok ? '복사했어요.' : '복사하지 못했어요. 직접 선택해 복사해 주세요.'));
    return;
  }
  if (t.dataset.crevert) { const x = item(t.dataset.crevert); x.text = x.original; runReview(true); return; }
  if (t.hasAttribute('data-cxlsx')) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    downloadBytes(reviewToXlsx(CK.items, CK.review), `jeomgeom_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.xlsx`);
    toast("점검 결과를 내려받았어요. '점검 결과'와 '중복 문장' 시트가 들어 있어요.");
    return;
  }
  if (t.hasAttribute('data-capply')) {
    let n = 0;
    for (const x of CK.items) {
      if (!x.savedId || x.text === x.original) continue;
      const rec = state.saved.find((r) => r.id === x.savedId);
      if (!rec) continue;
      const c = checkText(x.text, rec.area);
      Object.assign(rec, { text: x.text, chars: c.chars, bytes: c.bytes, savedAt: new Date().toISOString() });
      x.original = x.text;
      n++;
    }
    persistSaved();
    renderSaved();
    runReview(true);
    toast(`저장한 문장 ${n}개에 고친 내용을 반영했어요.`);
  }
});

// ---------- 탭 ----------
document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-top]');
  if (!t) return;
  state.top = t.dataset.top;
  renderAll();
});

function renderAll() {
  document.querySelectorAll('[data-top]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.top === state.top)));
  document.body.classList.toggle('mode-check', state.top === 'check');
  if (state.top === 'check') { renderCheckLeft(); renderCheckRight(); renderSaved(); return; }
  renderLeft();
  renderRight();
  renderSaved();
}

window.addEventListener('resize', autosize);
renderAll();
