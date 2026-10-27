// 학생 자료(수행평가 결과표 · 활동 보고서) → 학생별 분석
// 브라우저 안에서만 처리합니다. 이름은 화면 표시용으로만 쓰고 저장하거나 보내지 않습니다.
import { toEumseum, splitSentences, checkText } from './rules.js';
import { JAYUL_CHIPS } from './data.js';

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.\-]/g, ''));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};
export const studentKey = (s) => `${s.grade}|${s.cls}|${s.num}`;

// ---------- 표(엑셀·CSV) → 학생 ----------
const H = {
  grade: /^학년$/, cls: /^반$/, num: /^(번호|번)$/, hakbun: /학번/, name: /이름|성명/,
  total: /총점|합계|총계|환산|^점수$|점수\s*\(?합/, max: /만점|배점합/,
  text: /관찰|내용|소감|의견|특기|피드백|활동|보고|기록|비고|산출물|요약|서술|성찰|느낀|역할/,
  skip: /^(순|순번|no\.?|연번|등급|석차|성취도|성취수준)$/i,
};

function headerRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i].map((c) => String(c ?? '').replace(/\s+/g, ''));
    if (r.some((c) => H.num.test(c) || H.hakbun.test(c))) return i;
  }
  return -1;
}

/** 머리글의 '(10)', '/10', '10점' → 만점 */
const headerMax = (h) => {
  const m = String(h).match(/[(/]\s*(\d+(?:\.\d+)?)\s*점?\s*\)?\s*$/) || String(h).match(/(\d+(?:\.\d+)?)\s*점\s*$/);
  return m ? Number(m[1]) : null;
};
const cleanHeader = (h) => String(h).replace(/\s*[(/]\s*\d+(?:\.\d+)?\s*점?\s*\)?\s*$/, '').replace(/\s*\d+\s*점\s*$/, '').trim();

export function rowsToStudents(rows, defaults = {}) {
  const clean = rows.map((r) => r.map((c) => String(c ?? '').trim()));
  const hi = headerRowIndex(clean);
  if (hi < 0) throw new Error("표의 첫 줄에 '번호'(또는 '학번') 칸이 있어야 학생을 나눌 수 있어요.");
  const head = clean[hi];
  const flat = head.map((h) => h.replace(/\s+/g, ''));
  const col = { grade: -1, cls: -1, num: -1, hakbun: -1, name: -1, total: -1, max: -1 };
  const textCols = [];
  const elemCols = [];
  flat.forEach((h, i) => {
    if (!h) return;
    for (const k of ['grade', 'cls', 'num', 'hakbun', 'name', 'total', 'max']) {
      if (col[k] < 0 && H[k].test(h)) { col[k] = i; return; }
    }
    if (H.skip.test(h)) return;
    if (H.text.test(h)) { textCols.push(i); return; }
    elemCols.push(i);
  });
  const body = clean.slice(hi + 1).filter((r) => r.some(Boolean));
  // 숫자가 거의 없는 칸은 글 칸으로 봄
  const numericElem = elemCols.filter((i) => {
    const vals = body.map((r) => r[i]).filter(Boolean);
    return vals.length && vals.filter((v) => num(v) !== null).length / vals.length >= 0.8;
  });
  for (const i of elemCols) if (!numericElem.includes(i)) textCols.push(i);
  const classMax = {};
  for (const i of numericElem) classMax[i] = headerMax(head[i]) || Math.max(...body.map((r) => num(r[i]) || 0), 0) || null;

  const out = [];
  for (const r of body) {
    let grade = col.grade >= 0 ? num(r[col.grade]) : null;
    let cls = col.cls >= 0 ? num(r[col.cls]) : null;
    let n = col.num >= 0 ? num(r[col.num]) : null;
    if (col.hakbun >= 0 && r[col.hakbun]) {
      const d = String(r[col.hakbun]).replace(/\D/g, '');
      if (d.length === 5) { grade ??= +d[0]; cls ??= +d.slice(1, 3); n ??= +d.slice(3); }
    }
    if (!n) continue;
    const elements = numericElem.map((i) => ({ name: cleanHeader(head[i]), score: num(r[i]), max: classMax[i] }))
      .filter((e) => e.name && e.score !== null);
    let total = col.total >= 0 ? num(r[col.total]) : null;
    let max = col.max >= 0 ? num(r[col.max]) : null;
    if (total !== null && max === null && col.total >= 0) max = headerMax(head[col.total]);
    if (total === null && elements.length) {
      total = elements.reduce((a, e) => a + e.score, 0);
      max = elements.every((e) => e.max) ? elements.reduce((a, e) => a + e.max, 0) : null;
    }
    out.push({
      grade: String(grade || defaults.grade || ''), cls: String(cls || defaults.cls || ''), num: String(n),
      name: col.name >= 0 ? r[col.name] : '',
      score: total, max: max || (total !== null ? 100 : null), elements,
      texts: textCols.map((i) => r[i]).filter(Boolean),
    });
  }
  if (!out.length) throw new Error('학생 줄을 찾지 못했어요. 번호 칸이 비어 있지 않은지 확인해 주세요.');
  return out;
}

// ---------- PDF·글 → 학생 ----------
const ID_PATTERNS = [
  /([1-3])\s*학년\s*(\d{1,2})\s*반\s*(\d{1,2})\s*번\s*(?:이름\s*[:：]?\s*)?([가-힣]{2,4})?/,
  /학번\s*[:：]?\s*([1-3])(\d{2})(\d{2})\s*(?:이름|성명)?\s*[:：]?\s*([가-힣]{2,4})?/,
  /(?:^|\s)([1-3])-(\d{1,2})-(\d{1,2})\s*([가-힣]{2,4})?/,
  /(?:^|\s)([1-3])(\d{2})(\d{2})\s+([가-힣]{2,4})(?=\s|$)/,
];

export function findStudentId(text) {
  const head = String(text || '').slice(0, 400);
  for (const re of ID_PATTERNS) {
    const m = head.match(re);
    if (m) return { grade: String(+m[1]), cls: String(+m[2]), num: String(+m[3]), name: m[4] || '' };
  }
  const m = head.match(/(?:^|\s)(\d{1,2})\s*번\s+([가-힣]{2,4})?/);
  if (m) return { grade: '', cls: '', num: String(+m[1]), name: m[2] || '' };
  return null;
}

/** 쪽(page)마다 학생 표시를 찾아 학생별로 묶기. 표시가 없는 쪽은 앞 학생에게 붙임 */
export function pagesToStudents(pages, fileName = '', defaults = {}) {
  const out = [];
  let cur = null;
  for (const p of pages) {
    const id = findStudentId(p);
    if (id) {
      cur = { ...id, grade: id.grade || String(defaults.grade || ''), cls: id.cls || String(defaults.cls || ''), texts: [p] };
      out.push(cur);
    } else if (cur) cur.texts.push(p);
  }
  if (!out.length) {
    const id = findStudentId(String(fileName).replace(/[_.\-]+/g, ' ')) || findStudentId(pages.join('\n'));
    if (!id) return [];
    out.push({ ...id, grade: id.grade || String(defaults.grade || ''), cls: id.cls || String(defaults.cls || ''), texts: pages });
  }
  return out.map((s) => ({ ...s, score: null, max: null, elements: [], texts: [s.texts.join('\n')] }));
}

/** 같은 학생(학년·반·번호) 자료 합치기 */
export function mergeStudents(list) {
  const map = new Map();
  for (const s of list) {
    const k = studentKey(s);
    const cur = map.get(k);
    if (!cur) { map.set(k, { ...s, texts: [...(s.texts || [])], elements: [...(s.elements || [])] }); continue; }
    cur.name ||= s.name;
    if (cur.score === null && s.score !== null) { cur.score = s.score; cur.max = s.max; }
    cur.elements.push(...(s.elements || []));
    cur.texts.push(...(s.texts || []));
  }
  return [...map.values()].sort((a, b) => (+a.grade - +b.grade) || (+a.cls - +b.cls) || (+a.num - +b.num));
}

// ---------- 글 분석 ----------
const GWA_KEYWORDS = [
  ['수업에 집중하며 적극적으로 참여함', /적극|집중|열심|열정|자발/],
  ['실험·활동 도구를 안전하게 다룸', /실험|도구|기구|장비|안전/],
  ['모둠 활동에서 자기 생각을 말함', /의견|발표|주장|토의|토론|생각을\s?말/],
  ['친구의 의견을 존중하며 협력함', /협력|협동|역할\s?분담|함께|도와|존중/],
  ['궁금한 점을 질문함', /질문|궁금|탐구|조사/],
  ['결과를 표나 그림으로 정리함', /표로|그래프|도표|정리|그림|포스터|시각/],
  ['배운 내용을 실생활과 연결함', /생활|일상|실제|적용|활용/],
  ['과제를 끝까지 성실하게 마무리함', /끝까지|완성|마무리|성실|꼼꼼/],
];

const JAYUL_KEYWORDS = [
  ['학급 회의', /학급\s?회의|회의/],
  ['학생 자치회', /자치회|학생회|대의원/],
  ['학교 행사 (체육대회 등)', /체육대회|운동회|축제|행사|합창|발표회/],
  ['캠페인 활동', /캠페인|홍보|포스터/],
  ['1인 1역', /1인\s?1역|일인일역/],
  ['환경·나눔 활동', /나눔|봉사|기부|환경\s?(정화|보호|지킴이|보전)|쓰레기\s?(줍|줄이)|플로깅/],
];
const ROLE_KEYWORDS = {
  '학급 회의': [['회의 진행', /사회|진행|의장/], ['기록', /서기|기록/], ['의견 제안', /제안|안건/]],
  '학생 자치회': [['임원', /회장|부회장|임원/], ['학급 대표', /대표|대의원/], ['부서 위원', /부서|부원|위원/]],
  '학교 행사 (체육대회 등)': [['응원 담당', /응원/], ['준비 위원', /준비\s?위원|준비를\s?맡|기획/], ['진행 도우미', /도우미|안내|진행/]],
  '캠페인 활동': [['홍보물 제작', /포스터|홍보물|안내문|피켓/], ['기획', /기획|계획/], ['진행', /진행/]],
  '환경·나눔 활동': [['기획', /기획|계획/], ['홍보', /홍보|알리/], ['앞장서 실천', /앞장|솔선/]],
};
const DUTY_KEYWORDS = [['분리배출', /분리배출|재활용/], ['환경 정리', /환경\s?정리|청소|정리정돈/], ['학습 도우미', /학습\s?도우미|멘토/],
  ['급식·우유 도우미', /급식|우유/], ['칠판·전등 관리', /칠판|전등|불\s?끄/], ['창문·환기 관리', /창문|환기/]];
const TITLE_RE = /(학급\s?자치회\s?)?(부회장|회장|부반장|반장)/;

const FIRST_PERSON = /^(저는|나는|제가|내가|저희\s?모둠은|우리\s?모둠은|우리\s?반은|우리는|저희는)\s*/;
const FEELING = /재미있|재밌|좋았|아쉬|힘들|느꼈|싶다|싶었|것\s?같|뿌듯|즐거웠|행복/;
const ACTION = /했|하였|만들|정리|발표|조사|진행|맡|참여|제안|협력|도왔|도와|작성|완성|탐구|실험|설명|기록|준비|계획|그렸|찾/;

/** 학생 글 한 문장 → 교사 관찰 문장(음슴체). 감정 표현이나 바꿀 수 없는 문장은 null */
export function toObservation(sentence) {
  let s = String(sentence || '').replace(/\(예시\)\s*/g, '').replace(/[.!?。]+$/, '').replace(/\s+/g, ' ').trim();
  if (s.length < 10 || s.length > 90) return null;
  if (FEELING.test(s) || !ACTION.test(s)) return null;
  s = s.replace(FIRST_PERSON, '').replace(/저희/g, '모둠').replace(/우리\s?모둠/g, '모둠').replace(/^(그래서|그리고|또|또한|먼저|다음으로)\s*/, '');
  const fixed = toEumseum(s);
  if (!fixed) return null;
  return fixed;
}

const ID_STRIP = [/[1-3]\s*학년\s*\d{1,2}\s*반\s*\d{1,2}\s*번(\s*(이름\s*[:：]?\s*)?[가-힣]{2,4})?/g, /학번\s*[:：]?\s*\d{5}(\s*(이름|성명)?\s*[:：]?\s*[가-힣]{2,4})?/g];

function highlightsFrom(texts, max = 2, name = '') {
  const scored = [];
  for (const t0 of texts) {
    let t = String(t0);
    for (const re of ID_STRIP) t = t.replace(re, '\n');
    if (name) t = t.split(name).join('');
    for (const s of splitSentences(t.replace(/\s*\n\s*/g, ' '))) {
      const obs = toObservation(s.text);
      if (!obs) continue;
      if (checkText(obs + '.', 'gwa').errors.some((e) => e.group === 'forbidden' || e.group === 'compare')) continue;
      const score = (obs.match(ACTION) || []).length + (/(모둠|친구|발표|정리|자료|실험|조사)/.test(obs) ? 1 : 0);
      scored.push({ obs, score });
    }
  }
  const seen = new Set();
  return scored.sort((a, b) => b.score - a.score)
    .filter((x) => (seen.has(x.obs) ? false : seen.add(x.obs)))
    .slice(0, max).map((x) => x.obs);
}

/** 과세특 분석: 점수, 강점·성장 요소, 관찰 모습, 꼭 넣을 장면 */
export function analyzeGwa(st) {
  const all = (st.texts || []).join(' ');
  const chips = GWA_KEYWORDS.filter(([, re]) => re.test(all)).map(([l]) => l).slice(0, 3);
  const strengths = [];
  const growth = [];
  for (const e of st.elements || []) {
    if (!e.max) continue;
    const r = e.score / e.max;
    if (r >= 0.9) strengths.push(e.name);
    else if (r < 0.6) growth.push(e.name);
  }
  return { chips, strengths: strengths.slice(0, 2), growth: growth.slice(0, 2), highlights: highlightsFrom(st.texts || [], 2, st.name) };
}

/** 자율·자치 분석: 활동, 활동별 역할, 직책, 꼭 넣을 장면 */
export function analyzeJayul(st) {
  const all = (st.texts || []).join(' ');
  const chips = JAYUL_KEYWORDS.filter(([, re]) => re.test(all)).map(([l]) => l);
  const roles = {};
  const used = [];
  for (const c of chips) {
    if (c === '1인 1역') {
      const d = DUTY_KEYWORDS.find(([, re]) => re.test(all));
      if (d) { roles[c] = d[0]; used.push(d[1]); }
      continue;
    }
    const r = (ROLE_KEYWORDS[c] || []).find(([, re]) => re.test(all));
    if (r && JAYUL_CHIPS.find((x) => x.label === c)?.roles?.[r[0]]) { roles[c] = r[0]; used.push(r[1]); }
  }
  const t = all.match(TITLE_RE);
  const roleTitle = t ? (t[1] ? `학급 자치회 ${t[2]}` : t[2]) : '';
  // 역할 문장과 겹치는 장면은 빼서 같은 말이 반복되지 않게
  const highlights = highlightsFrom(st.texts || [], 4, st.name).filter((h) => !used.some((re) => re.test(h))).slice(0, 2);
  return { chips, roles, roleTitle, highlights };
}

/** 양식(.xlsx 행) */
export const RESULT_TEMPLATE_ROWS = {
  gwa: {
    columns: [['학년', 6], ['반', 6], ['번호', 6], ['이름', 10], ['점수', 8], ['만점', 8], ['평가 요소1 (10)', 14], ['평가 요소2 (10)', 14], ['관찰 내용', 60]],
    rows: [[2, 3, 1, '(예시)', 17, 20, 9, 8, '(예시) 모둠 실험에서 측정값을 표로 정리하고 결과를 발표함'],
      [2, 3, 2, '(예시)', 12, 20, 5, 7, '(예시) 실험 도구를 안전하게 다루며 끝까지 참여함']],
  },
  jayul: {
    columns: [['학년', 6], ['반', 6], ['번호', 6], ['이름', 10], ['활동 보고서 내용', 90]],
    rows: [[2, 3, 1, '(예시)', '(예시) 저는 학급 회의에서 서기를 맡아 회의 내용을 기록했습니다. 환경 캠페인 포스터를 만들어 게시했습니다.'],
      [2, 3, 2, '(예시)', '(예시) 체육대회에서 응원 도구를 친구들과 함께 만들었습니다.']],
  },
};
