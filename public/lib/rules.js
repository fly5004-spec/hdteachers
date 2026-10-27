// 생기부 기재요령 점검 규칙 (브라우저·서버 공용)
// 주의: 금지 항목 목록과 글자 수 기준은 학교에서 올해 기재요령으로 다시 확인해야 합니다.

export const LIMIT_BYTES = { gwa: 1500, jayul: 1500, hang: 1500 };

// ---------- 한글 도우미 ----------
const isHangul = (c) => !!c && c >= '가' && c <= '힣';
const jong = (c) => (c.charCodeAt(0) - 0xac00) % 28;
const withJong = (c, j) => String.fromCharCode(c.charCodeAt(0) - jong(c) + j);
const J_N = 4, J_L = 8, J_LM = 10, J_M = 16, J_B = 17;

/** NEIS 방식 바이트: 한글 등 3, 영문·숫자·공백 1, 줄바꿈 2 */
export function neisBytes(text) {
  let b = 0;
  for (const ch of String(text).replace(/\r/g, '')) {
    if (ch === '\n') b += 2;
    else b += ch.charCodeAt(0) > 127 ? 3 : 1;
  }
  return b;
}

export function charCount(text) {
  return [...String(text).replace(/\r/g, '')].length;
}

/** 받침에 따라 '으로/로' */
export function josaRo(word) {
  const last = String(word).trim().slice(-1);
  if (!isHangul(last)) return '로';
  const j = jong(last);
  return j === 0 || j === J_L ? '로' : '으로';
}

/** 받침에 따라 '을/를' */
export function josaEul(word) {
  const last = String(word).trim().slice(-1);
  if (!isHangul(last)) return '를';
  return jong(last) === 0 ? '를' : '을';
}

/** 문장 끝이 교사 관찰 어체(음슴체: ~함, ~했음, ~보임, ~됨 ...)인지 */
export function endsOk(core) {
  const last = core.trim().slice(-1);
  if (!isHangul(last)) return false;
  const j = jong(last);
  return j === J_M || j === J_LM;
}

/** 동사 어간을 명사형(음슴체)으로: 가 -> 감, 만들 -> 만듦, 찾 -> 찾음 */
function nominalizeStem(stem) {
  const last = stem.slice(-1);
  if (!isHangul(last)) return stem + '함';
  const j = jong(last);
  if (j === 0) return stem.slice(0, -1) + withJong(last, J_M);
  if (j === J_L) return stem.slice(0, -1) + withJong(last, J_LM);
  return stem + '음';
}

const ENDING_RULES = [
  [/(하였|했)습니다$/, '함'], [/합니다$/, '함'],
  [/(하였|했)어요$/, '함'], [/해요$/, '함'],
  [/(되었|됐)습니다$/, '됨'], [/됩니다$/, '됨'],
  [/(보였|보입)니다$/, '보임'], [/(보였|보인)다$/, '보임'],
  [/(하였|했)다$/, '함'], [/한다$/, '함'], [/하다$/, '함'],
  [/(되었|됐)다$/, '됨'], [/된다$/, '됨'],
  [/입니다$/, '임'], [/이(었)?다$/, '임'],
  [/있(었)?(습니)?다$/, '있음'], [/없(었)?(습니)?다$/, '없음'],
];

/**
 * 한 문장(마침표 제외)의 끝을 음슴체로 바꾼다. 바꿀 수 없으면 null.
 */
export function toEumseum(core) {
  const s = core.trim();
  if (!s) return null;
  if (endsOk(s)) return s;
  for (const [re, rep] of ENDING_RULES) {
    if (re.test(s)) return s.replace(re, rep);
  }
  let m;
  if ((m = s.match(/^(.*?)(았|었|였)(습니)?다$/))) return nominalizeStem(m[1]);
  if ((m = s.match(/^(.*?)습니다$/))) return nominalizeStem(m[1]);
  if ((m = s.match(/^(.*)(.)니다$/)) && isHangul(m[2]) && jong(m[2]) === J_B) {
    return nominalizeStem(m[1] + withJong(m[2], 0));
  }
  if ((m = s.match(/^(.*?)는다$/))) return nominalizeStem(m[1]);
  if ((m = s.match(/^(.*)(.)다$/))) {
    const prev = m[2];
    if (isHangul(prev) && jong(prev) === J_N) return nominalizeStem(m[1] + withJong(prev, 0));
    return nominalizeStem(m[1] + prev);
  }
  return null;
}

/** 메모 조각처럼 끝맺음이 없는 말도 문장으로: '꼼꼼히 측정' -> '꼼꼼히 측정함' */
export function toEumseumLoose(core) {
  const s = core.trim().replace(/[.!?。]+$/, '');
  if (!s) return '';
  const fixed = toEumseum(s);
  if (fixed) return fixed;
  if (/(편|모습|학생|친구|태도|성격|경우|사람|편이)$/.test(s)) return s.replace(/편이$/, '편') + '임';
  const last = s.slice(-1);
  if (isHangul(last)) return s + '함';
  return s;
}

/** 문장 나누기 (위치 정보 포함) */
export function splitSentences(text) {
  const out = [];
  const re = /[^.!?\n]+(?:[.!?]+|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (!body) continue;
    const start = m.index + lead;
    const core = body.replace(/[.!?'"’”)\]]+$/, '');
    out.push({ start, end: start + body.length, text: body, core, coreEnd: start + core.length });
  }
  return out;
}

// ---------- 적으면 안 되는 내용 ----------
export const FORBIDDEN = [
  { cat: '공인어학시험', re: /토익|TOEIC|토플|TOEFL|텝스|TEPS|토셀|TOSEL|IELTS|아이엘츠|HSK|JLPT|JPT|오픽|OPIc|DELE|DELF/gi,
    msg: '공인어학시험 이름과 점수는 적을 수 없어요.' },
  { cat: '대회·수상', re: /(?<!(체육|합창|운동|스포츠|학급\s?대항\s?))대회|올림피아드|경시|금상|은상|동상|최우수상|우수상|장려상|입상|수상(?!\s?스키)|대상을\s?(받|수상)/g,
    msg: '대회 참가나 수상 실적은 이 칸에 적을 수 없어요. 수업·활동 안에서 보인 모습으로 바꿔 주세요.' },
  { cat: '자격증·인증', re: /자격증|능력검정|검정시험|급수를?\s?취득|컴활|ITQ|기능사/g,
    msg: '자격증·인증시험 내용은 적을 수 없어요.' },
  { cat: '부모 정보', re: /(아버지|어머니|부모님?|아빠|엄마)(의|가|께서|는|님)?\s?[^.\s]{0,8}\s?(직업|직장|회사|교수|의사|변호사|판사|검사|대표|사장|공무원|의원|경찰)/g,
    msg: '부모의 직업 등 사회·경제적 지위는 적을 수 없어요.' },
  { cat: '사교육', re: /학원|과외|인터넷\s?강의|인강/g,
    msg: '사교육과 관련된 내용은 적을 수 없어요.' },
  { cat: '해외 활동', re: /어학연수|해외\s?(봉사|연수|캠프|탐방)|교환학생/g,
    msg: '해외 활동 실적은 적을 수 없어요.' },
  { cat: '논문·특허·출간', re: /소논문|논문|특허|출판|출간|학회/g,
    msg: '논문·특허·책 출간 실적은 적을 수 없어요.' },
  { cat: '외부 기관', re: /(대학교?|대학원)\s?(캠프|프로그램|연구소|교수)/g,
    msg: '대학 등 외부 기관 프로그램은 적을 수 없어요.' },
  { cat: '점수·등급', re: /\d+\s?점(?!검)|점수|성취\s?수준|[A-E]\s?(등급|수준)|\d\s?등급|만점/g,
    msg: '점수, 등급, 성취수준(A~E)은 문장에 적지 않아요. 수준에 맞는 활동 모습으로 써 주세요.' },
  { cat: '장학·모의고사', re: /장학생|장학금|모의고사|모의평가/g,
    msg: '장학생 선발, 모의고사 성적은 적을 수 없어요.' },
];

export const COMPARE = {
  re: /(반|학급|학년|전교|우리\s?반)에서\s?(가장|제일|1등|일등|최고)|다른\s?(학생|친구)들?보다|누구보다|타의 추종|최고의 학생/g,
  msg: '다른 학생과 견주는 표현은 쓰지 않아요. 학생 자신의 모습만 적어 주세요.',
};

export const NEGATIVE = {
  re: /산만|게으르|게을러|불성실|이기적|버릇없|문제\s?행동|자주 지각|폭력|반항/g,
  msg: '단점만 적지 말고 나아진 점이나 나아질 가능성과 함께 적어 주세요.',
};

function expandToWord(text, start, end) {
  let s = start, e = end;
  while (s > 0 && !/\s/.test(text[s - 1])) s--;
  while (e < text.length && !/[\s.!?]/.test(text[e])) e++;
  return [s, e];
}

function sentenceOf(sentences, pos) {
  return sentences.find((x) => pos >= x.start && pos < x.end) || null;
}

/**
 * 전체 점검. issues: { id, cat, group, severity, start, end, message, fix }
 * group: ending | forbidden | length | compare | negative
 */
export function checkText(text, area = 'gwa') {
  const t = String(text || '');
  const issues = [];
  const sentences = splitSentences(t);
  let n = 0;

  // 1) 어체
  for (const s of sentences) {
    if (!/[가-힣]/.test(s.core)) continue;
    if (endsOk(s.core)) continue;
    const wordStartInCore = Math.max(s.core.lastIndexOf(' ') + 1, 0);
    const word = s.core.slice(wordStartInCore);
    const fixedCore = toEumseum(s.core);
    const to = fixedCore ? fixedCore.slice(wordStartInCore) : null;
    issues.push({
      id: 'e' + n++, group: 'ending', cat: '어체', severity: 'error',
      start: s.start + wordStartInCore, end: s.coreEnd,
      sentStart: s.start, sentEnd: s.end,
      word,
      message: to
        ? `'${word}'는 쓰지 않아요. 교사 관찰 어체로 바꿔 주세요.`
        : `문장 끝 '${word}'을(를) '~함, ~했음, ~보임'처럼 바꿔 주세요.`,
      fix: to && to !== word ? { kind: 'replace', label: '바꾸기', from: word, to } : null,
    });
  }

  // 2) 적으면 안 되는 내용 (문장마다 하나로 묶음)
  const bySentence = new Map();
  for (const rule of FORBIDDEN) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(t))) {
      if (!m[0]) { rule.re.lastIndex++; continue; }
      const [ws, we] = expandToWord(t, m.index, m.index + m[0].length);
      const sent = sentenceOf(sentences, m.index);
      const key = sent ? sent.start : ws;
      const cur = bySentence.get(key);
      if (cur) {
        cur.ranges.push([ws, we]);
        if (!cur.cats.includes(rule.cat)) cur.cats.push(rule.cat);
      } else {
        bySentence.set(key, { sent, ranges: [[ws, we]], cats: [rule.cat], msg: rule.msg });
      }
    }
  }
  for (const v of bySentence.values()) {
    const starts = v.ranges.map((r) => r[0]);
    const ends = v.ranges.map((r) => r[1]);
    issues.push({
      id: 'f' + n++, group: 'forbidden', cat: v.cats.join(' · '), severity: 'error',
      start: Math.min(...starts), end: Math.max(...ends), ranges: v.ranges,
      sentStart: v.sent ? v.sent.start : Math.min(...starts),
      sentEnd: v.sent ? v.sent.end : Math.max(...ends),
      message: v.msg,
      fix: v.sent ? { kind: 'removeSentence', label: '문장 빼기' } : null,
    });
  }

  // 3) 비교 표현
  COMPARE.re.lastIndex = 0;
  let cm;
  while ((cm = COMPARE.re.exec(t))) {
    const sent = sentenceOf(sentences, cm.index);
    issues.push({
      id: 'c' + n++, group: 'compare', cat: '비교 표현', severity: 'error',
      start: cm.index, end: cm.index + cm[0].length,
      sentStart: sent ? sent.start : cm.index, sentEnd: sent ? sent.end : cm.index + cm[0].length,
      word: cm[0], message: COMPARE.msg,
      fix: sent ? { kind: 'removeSentence', label: '문장 빼기' } : null,
    });
  }

  // 4) 단점 표현 (행발만, 주의)
  if (area === 'hang') {
    NEGATIVE.re.lastIndex = 0;
    let nm;
    while ((nm = NEGATIVE.re.exec(t))) {
      const [ws, we] = expandToWord(t, nm.index, nm.index + nm[0].length);
      issues.push({
        id: 'n' + n++, group: 'negative', cat: '단점 표현', severity: 'warn',
        start: ws, end: we, word: t.slice(ws, we), message: NEGATIVE.msg, fix: null,
      });
    }
  }

  // 5) 분량
  const bytes = neisBytes(t);
  const limit = LIMIT_BYTES[area] || 1500;
  if (bytes > limit) {
    issues.push({
      id: 'l' + n++, group: 'length', cat: '분량', severity: 'error',
      start: -1, end: -1,
      message: `기준보다 ${bytes - limit}바이트 많아요. '더 짧게'를 눌러 줄여 주세요.`, fix: null,
    });
  }

  issues.sort((a, b) => (a.start - b.start));
  return {
    issues,
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warn'),
    bytes, chars: charCount(t), limit,
    sentences: sentences.length,
  };
}

/** 점검 결과의 고치기 실행 */
export function applyFix(text, issue) {
  if (!issue || !issue.fix) return text;
  if (issue.fix.kind === 'replace') {
    return text.slice(0, issue.start) + issue.fix.to + text.slice(issue.end);
  }
  if (issue.fix.kind === 'removeSentence') {
    return (text.slice(0, issue.sentStart) + text.slice(issue.sentEnd)).replace(/[ \t]{2,}/g, ' ').trim();
  }
  return text;
}

// ---------- 끝맺음 바꾸기 (~함 / ~했음 / ~보임) ----------
function toHamBase(core) {
  return core
    .replace(/하는 모습을 보임$/, '함')
    .replace(/되는 모습을 보임$/, '됨')
    .replace(/했음$/, '함')
    .replace(/되었음$/, '됨');
}

function fromHamBase(base, mode) {
  if (mode === 'haess') {
    if (base.endsWith('함')) return base.slice(0, -1) + '했음';
    if (base.endsWith('됨')) return base.slice(0, -1) + '되었음';
  }
  if (mode === 'boim') {
    if (base.endsWith('함')) return base.slice(0, -1) + '하는 모습을 보임';
    if (base.endsWith('됨')) return base.slice(0, -1) + '되는 모습을 보임';
  }
  return base;
}

/** mode: 'ham' | 'haess' | 'boim' */
export function applyEnding(text, mode) {
  const sentences = splitSentences(text);
  let out = '';
  let pos = 0;
  for (const s of sentences) {
    out += text.slice(pos, s.start);
    const tail = s.text.slice(s.core.length);
    out += fromHamBase(toHamBase(s.core), mode) + tail;
    pos = s.end;
  }
  out += text.slice(pos);
  return out;
}

/** 지금 문장들이 주로 어떤 끝맺음인지 */
export function detectEnding(text) {
  const cores = splitSentences(text).map((s) => s.core);
  const c = { ham: 0, haess: 0, boim: 0 };
  for (const k of cores) {
    if (/모습을 보임$/.test(k)) c.boim++;
    else if (/(했|되었)음$/.test(k)) c.haess++;
    else if (/[함됨]$/.test(k)) c.ham++;
  }
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'ham';
}
