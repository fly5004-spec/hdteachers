// 맞춤법 · 띄어쓰기 · 문장 부호 점검 (자주 틀리는 것 위주의 규칙 목록)
// 국립국어원 검사기를 대신하지는 못합니다. 학교에서 자주 보이는 실수를 골라 담았습니다.

const isHangul = (c) => !!c && c >= '가' && c <= '힣';
const jong = (c) => (c.charCodeAt(0) - 0xac00) % 28;

// ---------- 맞춤법: [틀린 말, 바른 말] ----------
const SPELL_WORDS = [
  ['됌', '됨'], ['됬', '됐'], ['했슴', '했음'], ['있슴', '있음'], ['없슴', '없음'], ['였슴', '였음'], ['었슴', '었음'],
  ['몇일', '며칠'], ['몇 일', '며칠'], ['금새', '금세'], ['일부로', '일부러'], ['역활', '역할'], ['희안', '희한'],
  ['어떻해', '어떻게'], ['오랫만', '오랜만'], ['오랜동안', '오랫동안'], ['깨끗히', '깨끗이'], ['일일히', '일일이'],
  ['틈틈히', '틈틈이'], ['꼼꼼이', '꼼꼼히'], ['솔직이', '솔직히'], ['곰곰히', '곰곰이'], ['번번히', '번번이'],
  ['가르키', '가리키'], ['들어나', '드러나'], ['들어난', '드러난'], ['할려고', '하려고'], ['할께', '할게'],
  ['않되', '안 되'], ['뒷처리', '뒤처리'], ['윗층', '위층'], ['내노라', '내로라'], ['설겆이', '설거지'],
  ['어의없', '어이없'], ['웬지', '왠지'], ['왠만', '웬만'], ['왠일', '웬일'], ['문안하', '무난하'], ['귀뜸', '귀띔'],
  ['짜집기', '짜깁기'], ['어줍잖', '어쭙잖'], ['설레임', '설렘'], ['되요', '돼요'], ['거에요', '거예요'],
  ['않하', '안 하'], ['안하고', '안 하고'], ['안하는', '안 하는'], ['곰곰이 생각', '곰곰이 생각'],
  ['몇년', '몇 년'], ['돋보여짐', '돋보임'], ['보여짐', '보임'], ['갖춰짐', '갖춤'],
  ['훌륭이', '훌륭히'], ['열심이', '열심히'], ['꾸준이', '꾸준히'], ['성실이', '성실히'], ['차분이', '차분히'],
  ['적극적이 ', '적극적으로 '], ['익숙치', '익숙지'], ['생각치', '생각지'], ['섭섭치', '섭섭지'],
  ['넓직', '널찍'], ['맛있게도', '맛있게도'], ['재작년', '재작년'],
].filter(([a, b]) => a !== b);

// 받침 ㄹ 뒤 '수' (할수 있다 → 할 수 있다)
function lSu(text, out) {
  const re = /([가-힣])수(있|없)/g;
  let m;
  while ((m = re.exec(text))) {
    if (jong(m[1]) !== 8) continue;
    out.push({ cat: '띄어쓰기', start: m.index, end: m.index + m[0].length, word: m[0], to: `${m[1]} 수 ${m[2]}`, msg: "'~ㄹ 수 있다/없다'의 '수'는 띄어 써요." });
  }
}

const SPACE_RULES = [
  { re: /(하는|되는|있는|없는|하던|이런|그런|저런|어떤|모든|새로운|다양한|배운|알게 된)것/g, to: (m) => `${m[1]} 것`, msg: "'것'은 앞말과 띄어 써요." },
  { re: /(할|될|볼|있을|없을|했을|하였을|갈|올|만들|읽을|쓸)때/g, to: (m) => `${m[1]} 때`, msg: "'때'는 앞말과 띄어 써요." },
  { re: /뿐만아니라/g, to: () => '뿐만 아니라', msg: "'뿐만 아니라'로 띄어 써요." },
  { re: /뿐아니라/g, to: () => '뿐 아니라', msg: "'뿐 아니라'로 띄어 써요." },
  { re: /([을를])(통해|통하여|위해|위하여|바탕으로)/g, to: (m) => `${m[1]} ${m[2]}`, msg: '조사 뒤의 말은 띄어 써요.' },
  { re: /(에)(대해|대한|대하여|따라|따른|관해|관한|있어서)/g, to: (m) => `${m[1]} ${m[2]}`, msg: '조사 뒤의 말은 띄어 써요.' },
  { re: /(로)(인해|인한|인하여)/g, to: (m) => `${m[1]} ${m[2]}`, msg: '조사 뒤의 말은 띄어 써요.' },
  { re: /([와과])(같이|함께)(?=[\s.,])/g, to: (m) => `${m[1]} ${m[2]}`, msg: "'~와 같이/함께'는 띄어 써요." },
  { re: /하기(위해|위하여|때문에)/g, to: (m) => `하기 ${m[1]}`, msg: "'하기 위해/때문에'는 띄어 써요." },
];

const DEUNG_OK = /(갈|평|대|균|고|초|중|우|열|전|소|점|신호|가로|형광|차|동|상|하|일|이|삼|부|등|촛)$/;
function deung(text, out) {
  const re = /([가-힣]+)등(?=[을를이에과와의은는도\s,.])/g;
  let m;
  while ((m = re.exec(text))) {
    if (DEUNG_OK.test(m[1]) || m[1].length < 2) continue;
    const start = m.index + m[1].length;
    out.push({ cat: '띄어쓰기', start: m.index, end: start + 1, word: m[0], to: `${m[1]} 등`, msg: "'등'은 앞말과 띄어 써요." });
  }
}

// '발표 함' → '발표함' (명사 + 함/했음/됨)
const NO_SPLIT_PREV = /^(잘|못|안|다|더|꼭|늘|또|함께|같이|모두|서로|많이|가장|매우|아주|좀|자주|끝까지|스스로)$/;
const PARTICLE_END = /[을를이가은는도만에서로와과게히고며지께나야든]$/;
function nounHam(text, out) {
  const re = /([가-힣]{2,}) (함|했음|하였음|됨|되었음)(?=[.\s,]|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const prev = m[1];
    if (NO_SPLIT_PREV.test(prev) || PARTICLE_END.test(prev)) continue;
    const start = m.index + prev.length;
    out.push({ cat: '띄어쓰기', start: m.index, end: m.index + m[0].length, word: m[0], to: `${prev}${m[2]}`, msg: `'${prev}${m[2]}'처럼 붙여 써요.` });
  }
}

function punctuation(text, out) {
  const add = (start, end, to, msg, word) => out.push({ cat: '문장 부호', start, end, word: word ?? text.slice(start, end), to, msg });
  let m;
  const r1 = / +([.,])/g;
  while ((m = r1.exec(text))) add(m.index, m.index + m[0].length, m[1], '문장 부호 앞에는 띄어 쓰지 않아요.');
  const r2 = /([.,])(?=[가-힣A-Za-z'"‘“(])/g;
  while ((m = r2.exec(text))) {
    if (m[1] === '.' && /\d$/.test(text.slice(0, m.index)) && /^\d/.test(text.slice(m.index + 1))) continue;
    add(m.index, m.index + 1, m[1] + ' ', '마침표·쉼표 뒤에는 한 칸 띄어 써요.');
  }
  const r3 = /\.{2,}|,{2,}|,\.|\.,|…/g;
  while ((m = r3.exec(text))) add(m.index, m.index + m[0].length, m[0][0] === ',' && m[0] !== ',.' ? ',' : '.', '문장 부호가 겹쳤어요.');
  const r4 = /[!?！？]+/g;
  while ((m = r4.exec(text))) add(m.index, m.index + m[0].length, '.', '생기부 문장은 마침표(.)로 끝내요.');
  const r5 = /[~∼]/g;
  while ((m = r5.exec(text))) add(m.index, m.index + 1, null, "물결표(~)는 말로 풀어 써 주세요(예: '3~4월' → '3월부터 4월까지').");
  const r6 = /([(\[‘“'"]) +| +([)\]’”])/g;
  while ((m = r6.exec(text))) add(m.index, m.index + m[0].length, (m[1] || m[2]), '괄호·따옴표 안쪽은 띄어 쓰지 않아요.');
  const r7 = /[※★☆■□●◆◇▶►▲△♥♡→←↑↓✓✔❤☞]|[\u{1F300}-\u{1FAFF}]/gu;
  while ((m = r7.exec(text))) add(m.index, m.index + m[0].length, null, '특수 기호·이모티콘은 쓰지 않아요.');
  // 짝이 맞지 않는 괄호·따옴표
  const pairs = [['(', ')'], ['[', ']'], ['‘', '’'], ['“', '”']];
  for (const [a, b] of pairs) {
    const na = text.split(a).length - 1;
    const nb = text.split(b).length - 1;
    if (na !== nb) {
      const i = text.lastIndexOf(na > nb ? a : b);
      add(i, i + 1, null, `여는 '${a}'와 닫는 '${b}'의 짝이 맞지 않아요.`);
    }
  }
  for (const q of ["'", '"']) {
    const n = text.split(q).length - 1;
    if (n % 2) { const i = text.lastIndexOf(q); add(i, i + 1, null, `따옴표(${q})의 짝이 맞지 않아요.`); }
  }
  const trimmed = text.replace(/\s+$/, '');
  if (trimmed && !/[.)\]’”'"]$/.test(trimmed)) add(trimmed.length, trimmed.length, '.', '마지막 문장 끝에 마침표(.)가 없어요.', '');
}

function spaces(text, out) {
  let m;
  const r = / {2,}/g;
  while ((m = r.exec(text))) out.push({ cat: '띄어쓰기', start: m.index, end: m.index + m[0].length, word: m[0], to: ' ', msg: '빈칸이 두 번 이상 있어요.' });
  const lead = text.match(/^\s+/);
  if (lead) out.push({ cat: '띄어쓰기', start: 0, end: lead[0].length, word: lead[0], to: '', msg: '맨 앞에 빈칸이 있어요.' });
}

/** 점검: [{ id, cat:'맞춤법'|'띄어쓰기'|'문장 부호', start, end, word, to(null=자동 고침 없음), msg }] */
export function spellCheck(text) {
  const t = String(text || '');
  const out = [];
  for (const [bad, good] of SPELL_WORDS) {
    let i = t.indexOf(bad);
    while (i >= 0) {
      out.push({ cat: '맞춤법', start: i, end: i + bad.length, word: bad, to: good, msg: `'${bad}' → '${good}'` });
      i = t.indexOf(bad, i + bad.length);
    }
  }
  lSu(t, out);
  for (const r of SPACE_RULES) {
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(t))) out.push({ cat: '띄어쓰기', start: m.index, end: m.index + m[0].length, word: m[0], to: r.to(m), msg: r.msg });
  }
  deung(t, out);
  nounHam(t, out);
  spaces(t, out);
  punctuation(t, out);
  // 겹치는 지적은 하나만
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  const res = [];
  let lastEnd = -1;
  for (const x of out) {
    if (x.start < lastEnd && x.end > x.start) continue;
    res.push(x);
    lastEnd = Math.max(lastEnd, x.end);
  }
  return res.map((x, i) => ({ ...x, id: `s${i}` }));
}

/** 고치기 하나 */
export function applySpellFix(text, issue) {
  if (!issue || issue.to === null || issue.to === undefined) return text;
  let to = issue.to;
  // '할수' 처럼 앞뒤에 이미 빈칸이 있으면 겹치지 않게
  if (to.startsWith(' ') && /\s$/.test(text.slice(0, issue.start))) to = to.trimStart();
  if (to.endsWith(' ') && /^\s/.test(text.slice(issue.end))) to = to.trimEnd();
  return text.slice(0, issue.start) + to + text.slice(issue.end);
}

/** 자동으로 고칠 수 있는 것 모두 고치기 (뒤에서부터) */
export function applyAllSpell(text) {
  let t = String(text || '');
  for (let round = 0; round < 3; round++) {
    const list = spellCheck(t).filter((x) => x.to !== null && x.to !== undefined);
    if (!list.length) break;
    for (const x of [...list].sort((a, b) => b.start - a.start)) t = applySpellFix(t, x);
  }
  return t;
}
