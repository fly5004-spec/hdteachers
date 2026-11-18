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
  // '참여 함', '노력 하였음', '선정 되어' → 붙여 씀 (명사 + 하다/되다)
  const re = /([가-힣]{2,}) (하였음|하였고|하였으며|하였다|했음|했고|했으며|하는|하고|하며|하여|하면서|하기|한|할|함|되었음|되었고|되어|되는|된|됐음|됨)(?=[.\s,]|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const prev = m[1];
    if (NO_SPLIT_PREV.test(prev) || PARTICLE_END.test(prev) || /[히이게]$/.test(prev)) continue;
    if (/(하여|되어|하고|되고|하며|되며|해서|하면|아서|어서|으면|니까|는데|하게|은|을|운|인|던|다|요|한|할|된|는)$/.test(prev)) continue;
    if (/^(한|할|된)$/.test(m[2]) && !/(정|성|용|력|구|표|결|획|천|리|사|해|현|여|가)$/.test(prev)) continue;
    out.push({ cat: '띄어쓰기', start: m.index, end: m.index + m[0].length, word: m[0], to: `${prev}${m[2]}`, msg: `'${prev}${m[2]}'처럼 붙여 써요.` });
    re.lastIndex = m.index + m[0].length;
  }
}

// 조사·어미 바로 뒤에 다음 낱말이 붙은 경우: '친구들과함께', '학급생활에적극적으로', '참여하며꾸준히'
const NEXT_WORDS = '말함|말하|말해|적극|성실|꾸준|열심히|자신|친구|함께|스스로|다양|주도|참여|노력|관심|꼼꼼|차분|깊이|바르게|바른|정확|매우|항상|특히|또한|모둠|활동|수업|학급|학교|문제|의견|생각|발표|탐구|실험|과제|결과|내용|역할|태도|능력|모습|보임|보여|이해|해결|협력|배려|책임|선생님|친절|긍정|끝까지|처음|다른|새로운|많은|좋은|뛰어난|우수|높은|깊은|가장|서로|먼저|직접|자료|방법|과정|원리|개념|질문|토의|토론|정리|설명|제시|제안|표현|작성|완성|실천|맡아|맡은|돕|도와|도움|주변|자기|타인|공동체|리더십|성장|향상|흥미|자세|모범';
const JOSA_RE = new RegExp(`([가-힣])(에서|에게|으로|하며|하고|하여|을|를|이|가|은|는|에|로|와|과|도|의|며|고|게)(${NEXT_WORDS})`, 'g');
const NEED_BATCHIM = { 을: true, 이: true, 은: true, 과: true, 으로: true };
const NEED_OPEN = { 를: true, 가: true, 는: true, 와: true };
function josaGlue(text, out) {
  JOSA_RE.lastIndex = 0;
  let m;
  while ((m = JOSA_RE.exec(text))) {
    const [all, prev, josa, next] = m;
    const b = jong(prev) !== 0;
    if (NEED_BATCHIM[josa] && !b) continue;
    if (NEED_OPEN[josa] && b && !(josa === '는' && prev === '하')) continue;
    if (josa === '는' && b) continue;
    // 한 낱말로 굳은 말은 건너뜀
    const word = text.slice(Math.max(0, m.index - 3), m.index + all.length);
    if (/(그동안|이런|그런|저런|이와|그와|이를|그를|이에|그에|도와|모두|서로)$/.test(word.slice(0, word.length - next.length))) continue;
    const start = m.index + 1;
    const end = m.index + all.length;
    out.push({ cat: '띄어쓰기', start, end, word: `${josa}${next}`, to: `${josa} ${next}`, msg: `'${josa}' 뒤의 '${next}'은(는) 띄어 써요.` });
    JOSA_RE.lastIndex = end - next.length;
  }
}

// '활동을하며' → '활동을 하며'
function objHa(text, out) {
  const re = /([가-힣])(을|를)(하였|했|하며|하고|하여|하는|한다|할|함|하기|하면서)/g;
  let m;
  while ((m = re.exec(text))) {
    const b = jong(m[1]) !== 0;
    if ((m[2] === '을') !== b) continue;
    out.push({ cat: '띄어쓰기', start: m.index + 1, end: m.index + m[0].length, word: m[2] + m[3], to: `${m[2]} ${m[3]}`, msg: `'${m[2]}' 뒤의 '${m[3]}'은(는) 띄어 써요.` });
  }
}

// '꾸준히노력함', '함께모둠' → 부사 뒤 띄어 씀 ('함께하다'처럼 한 낱말은 제외)
const ADVERBS = '함께|꾸준히|열심히|성실히|적극적으로|능동적으로|자발적으로|스스로|매우|항상|특히|또한|먼저|직접|끝까지|차분히|꼼꼼히|자세히|분명히|정확히|바르게|즐겁게|성실하게|꾸준하게|적극적이고|무척|아주|더욱|점차|점점|조금씩|하나씩|끝내';
const ADV_RE = new RegExp(`(^|[\\s"'(])(${ADVERBS})([가-힣])`, 'g');
function adverbGlue(text, out) {
  ADV_RE.lastIndex = 0;
  let m;
  while ((m = ADV_RE.exec(text))) {
    const adv = m[2];
    const next = text.slice(m.index + m[1].length + adv.length);
    if (/^(하|해|했|한|할|함|의|도|는|만|와|과|이|가|을|를|에|로|부터|까지|씩)/.test(next)) continue;
    const start = m.index + m[1].length;
    const end = start + adv.length + 1;
    out.push({ cat: '띄어쓰기', start, end, word: adv + m[3], to: `${adv} ${m[3]}`, msg: `'${adv}' 뒤는 띄어 써요.` });
    ADV_RE.lastIndex = end - 1;
  }
}

// 의존 명사·자주 틀리는 띄어쓰기
const DEP_RULES = [
  { re: /(\s수)(있|없)/g, to: (m) => `${m[1]} ${m[2]}`, msg: "'수 있다/없다'는 띄어 써요." },
  { re: /([할볼줄알갈쓸올])줄(알|몰|모르)/g, to: (m) => `${m[1]} 줄 ${m[2]}`, msg: "'~ㄹ 줄 알다/모르다'는 띄어 써요." },
  { re: /(하는|되는|한|된)(대로|만큼|바)(?=[\s,.을를이가]|$)/g, to: (m) => `${m[1]} ${m[2]}`, msg: '의존 명사는 앞말과 띄어 써요.' },
  { re: /([가-힣\d])(동안)/g, to: (m) => `${m[1]} ${m[2]}`, msg: "'동안'은 앞말과 띄어 써요.", skip: /(그|오랫|한|이|저)동안$/ },
  { re: /([가-힣])(뿐)(?=[\s,.만이]|$)/g, to: (m) => `${m[1]} ${m[2]}`, msg: "'뿐'은 앞말과 띄어 써요(조사로 쓰일 때는 붙여 써요).", skip: /(할|될|을|ㄹ)뿐$/ , only: /(할|될|볼|있을|없을|했을)뿐/ },
];
function depNouns(text, out) {
  for (const r of DEP_RULES) {
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(text))) {
      const chunk = text.slice(Math.max(0, m.index - 2), m.index + m[0].length);
      if (r.skip && r.skip.test(chunk)) continue;
      if (r.only && !r.only.test(chunk)) continue;
      out.push({ cat: '띄어쓰기', start: m.index, end: m.index + m[0].length, word: m[0], to: r.to(m), msg: r.msg });
    }
  }
}

// 너무 길게 붙은 어절: 어디를 띄울지 모를 때는 확인만 요청
function longWords(text, out) {
  const re = /[가-힣]{10,}/g;
  let m;
  while ((m = re.exec(text))) {
    out.push({ cat: '띄어쓰기', start: m.index, end: m.index + m[0].length, word: m[0], to: null, msg: `'${m[0]}'이(가) 너무 길게 붙어 있어요. 띄어 쓸 곳이 빠지지 않았는지 확인해 주세요.` });
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
  const r8 = /([가-힣])[ \t]*(?=\n)/g;
  while ((m = r8.exec(text))) add(m.index + 1, m.index + 1, '.', '줄 끝 문장에 마침표(.)가 없어요.', '');
  const trimmed = text.replace(/\s+$/, '');
  if (trimmed && !/[.!?！？)\]’”'"]$/.test(trimmed)) add(trimmed.length, trimmed.length, '.', '마지막 문장 끝에 마침표(.)가 없어요.', '');
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
  josaGlue(t, out);
  objHa(t, out);
  adverbGlue(t, out);
  depNouns(t, out);
  // 긴 어절 경고는 다른 띄어쓰기 지적이 없는 곳에만
  const longs = [];
  longWords(t, longs);
  for (const L of longs) if (!out.some((x) => x.cat === '띄어쓰기' && x.start < L.end && x.end > L.start)) out.push(L);
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
